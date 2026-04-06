import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __unsafe__resetStudentQueryCache,
  __unsafe__ttlByResourceMs,
  fetchStudentQuery,
  invalidateStudentCacheForMutation,
  setStudentQueryCacheScope,
} from "@/lib/client/student-query-cache";

const okJson = (payload: unknown) =>
  ({
    ok: true,
    json: async () => payload,
  }) as Response;

describe("student query cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __unsafe__resetStudentQueryCache();
    vi.stubGlobal(
      "window",
      {
        location: {
          origin: "https://app.example.com",
          pathname: "/student/dashboard",
        },
      } as unknown as Window
    );
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    __unsafe__resetStudentQueryCache();
  });

  it("normalizes query params and keys cache by scope", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(okJson({ ok: true, data: { dashboard: { identity: { cache_scope: "scope-1" } } } }));
    setStudentQueryCacheScope("scope-1");

    await fetchStudentQuery({
      path: "/api/student/dashboard?b=2&a=1",
      resource: "dashboard",
    });
    await fetchStudentQuery({
      path: "/api/student/dashboard?a=1&b=2",
      resource: "dashboard",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns stale data and revalidates in the background", async () => {
    let nowMs = 0;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    const fetchMock = vi.mocked(fetch);
    const stalePayload = { ok: true, data: { dashboard: { value: "stale" } } };
    const freshPayload = { ok: true, data: { dashboard: { value: "fresh" } } };
    fetchMock
      .mockResolvedValueOnce(okJson(stalePayload))
      .mockResolvedValueOnce(okJson(freshPayload));
    setStudentQueryCacheScope("scope-1");

    const initial = await fetchStudentQuery<{ ok: true; data: { dashboard: { value: string } } }>({
      path: "/api/student/dashboard",
      resource: "dashboard",
    });
    expect(initial.data.dashboard.value).toBe("stale");

    nowMs = __unsafe__ttlByResourceMs.dashboard + 1;
    const staleRead = await fetchStudentQuery<{ ok: true; data: { dashboard: { value: string } } }>({
      path: "/api/student/dashboard",
      resource: "dashboard",
    });
    expect(staleRead.data.dashboard.value).toBe("stale");

    await new Promise((resolve) => setTimeout(resolve, 0));
    const freshRead = await fetchStudentQuery<{ ok: true; data: { dashboard: { value: string } } }>({
      path: "/api/student/dashboard",
      resource: "dashboard",
    });
    expect(freshRead.data.dashboard.value).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates only mapped namespaces for profile mutation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(okJson({ ok: true, data: { dashboard: { version: 1 } } }))
      .mockResolvedValueOnce(okJson({ ok: true, data: { identity: { cache_scope: "scope-1" }, profile: { version: 1 } } }))
      .mockResolvedValueOnce(okJson({ ok: true, data: { artifacts: [{ id: "a1" }] } }))
      .mockResolvedValueOnce(okJson({ ok: true, data: { dashboard: { version: 2 } } }))
      .mockResolvedValueOnce(okJson({ ok: true, data: { identity: { cache_scope: "scope-1" }, profile: { version: 2 } } }));

    setStudentQueryCacheScope("scope-1");
    await fetchStudentQuery({ path: "/api/student/dashboard", resource: "dashboard" });
    await fetchStudentQuery({ path: "/api/student/profile", resource: "profile_full" });
    await fetchStudentQuery({ path: "/api/student/artifacts", resource: "artifacts" });

    invalidateStudentCacheForMutation("/api/student/profile");

    await fetchStudentQuery({ path: "/api/student/dashboard", resource: "dashboard" });
    await fetchStudentQuery({ path: "/api/student/profile", resource: "profile_full" });
    await fetchStudentQuery({ path: "/api/student/artifacts", resource: "artifacts" });

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
