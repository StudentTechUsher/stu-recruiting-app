import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureApiUnexpectedExceptionMock } = vi.hoisted(() => ({
  captureApiUnexpectedExceptionMock: vi.fn(),
}));

vi.mock("@/lib/observability/sentry", () => ({
  captureApiUnexpectedException: captureApiUnexpectedExceptionMock,
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
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
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

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.event_name).toBe("student.profile_saved");
    expect(payload.request_id).toBe("req-profile-1");
    expect(payload.trace_id).toBe(TRACE_ID);
    expect(payload.route).toBe("/api/student/profile");
    expect(payload.persona).toBe("student");
    expect(payload.org_id).toBe("org-1");
  });

  it("attaches sentry_event_id for unexpected exceptions", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.event_name).toBe("student.profile_save.unexpected");
    expect(payload.sentry_event_id).toBe("sentry-evt-1");
    expect(payload.error_code).toBe("unexpected_exception");
    expect(payload.outcome).toBe("unexpected_failure");
  });
});
