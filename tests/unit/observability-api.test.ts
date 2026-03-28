import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureApiUnexpectedExceptionMock,
  resolveSentryEnabledMock,
  captureMessageMock,
  withScopeMock,
  setTagMock,
  setContextMock,
  setLevelMock,
} = vi.hoisted(() => ({
  captureApiUnexpectedExceptionMock: vi.fn(),
  resolveSentryEnabledMock: vi.fn(),
  captureMessageMock: vi.fn(),
  withScopeMock: vi.fn(),
  setTagMock: vi.fn(),
  setContextMock: vi.fn(),
  setLevelMock: vi.fn(),
}));

vi.mock("@/lib/observability/sentry", () => ({
  captureApiUnexpectedException: captureApiUnexpectedExceptionMock,
  resolveSentryEnabled: resolveSentryEnabledMock,
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: captureMessageMock,
  withScope: withScopeMock,
}));

import {
  createApiObsContext,
  logApiUnexpectedError,
  recordProductMetric,
  resolveCorrelation,
  toActorSurrogate,
} from "@/lib/observability/api";

const TRACE_ID = "0123456789abcdef0123456789abcdef";
const SPAN_ID = "0123456789abcdef";

describe("observability api helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSentryEnabledMock.mockReturnValue(true);
    captureMessageMock.mockReturnValue("sentry-msg-1");
    withScopeMock.mockImplementation((callback: (scope: unknown) => unknown) =>
      callback({
        setTag: setTagMock,
        setContext: setContextMock,
        setLevel: setLevelMock,
      })
    );
  });

  it("resolves request_id and trace_id from incoming headers", () => {
    const correlation = resolveCorrelation(
      new Request("http://localhost/api/test", {
        headers: {
          "x-request-id": "req-123",
          "sentry-trace": `${TRACE_ID}-${SPAN_ID}-1`,
        },
      })
    );

    expect(correlation.request_id).toBe("req-123");
    expect(correlation.trace_id).toBe(TRACE_ID);
  });

  it("builds deterministic actor surrogates", () => {
    expect(toActorSurrogate("student-1")).toBe(toActorSurrogate("student-1"));
    expect(toActorSurrogate("   ")).toBeUndefined();
  });

  it("emits product metrics with correlation fields", () => {
    const context = createApiObsContext({
      request: new Request("http://localhost/api/student/profile", {
        method: "POST",
        headers: {
          "x-request-id": "req-profile-1",
          "sentry-trace": `${TRACE_ID}-${SPAN_ID}-1`,
        },
      }),
      routeTemplate: "/api/student/profile",
      component: "student_profile",
      operation: "save",
    });

    recordProductMetric(context, "student.profile_saved", {
      persona: "student",
      orgId: "org-1",
      actorIdSurrogate: "h_actor",
      details: {
        profile_completeness_pct: 100,
      },
    });

    expect(captureMessageMock).toHaveBeenCalledWith("student.profile_saved", "info");
    expect(setTagMock).toHaveBeenCalledWith("request_id", "req-profile-1");
    expect(setTagMock).toHaveBeenCalledWith("trace_id", TRACE_ID);
    expect(setTagMock).toHaveBeenCalledWith("persona", "student");
    expect(setTagMock).toHaveBeenCalledWith("org_id", "org-1");
    expect(setContextMock).toHaveBeenCalledWith(
      "observability_event",
      expect.objectContaining({
        event_name: "student.profile_saved",
        route: "/api/student/profile",
      })
    );
  });

  it("attaches sentry_event_id for unexpected exceptions", () => {
    captureApiUnexpectedExceptionMock.mockReturnValue("sentry-evt-1");

    const context = createApiObsContext({
      request: new Request("http://localhost/api/student/profile", { method: "POST" }),
      routeTemplate: "/api/student/profile",
      component: "student_profile",
      operation: "save",
    });

    const sentryEventId = logApiUnexpectedError({
      context,
      eventName: "student.profile_save.unexpected",
      error: new Error("boom"),
      errorCode: "unexpected_exception",
      persona: "student",
    });

    expect(sentryEventId).toBe("sentry-evt-1");
    expect(captureMessageMock).toHaveBeenCalledWith("student.profile_save.unexpected", "error");
    expect(setContextMock).toHaveBeenCalledWith(
      "observability_event",
      expect.objectContaining({
        event_name: "student.profile_save.unexpected",
        sentry_event_id: "sentry-evt-1",
        error_code: "unexpected_exception",
        outcome: "unexpected_failure",
      })
    );
  });
});
