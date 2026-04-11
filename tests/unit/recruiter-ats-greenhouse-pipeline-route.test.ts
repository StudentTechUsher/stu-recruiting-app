import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthContextMock, hasPersonaMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

describe("recruiter greenhouse pipeline route", () => {
  const originalGreenhouseApiKey = process.env.GREENHOUSE_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doUnmock("@/lib/ats/greenhouse");

    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "recruiter-1",
      org_id: "org-1",
      persona: "recruiter",
      assignment_ids: [],
    });
    hasPersonaMock.mockReturnValue(true);

    delete process.env.GREENHOUSE_API_KEY;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalGreenhouseApiKey === undefined) {
      delete process.env.GREENHOUSE_API_KEY;
    } else {
      process.env.GREENHOUSE_API_KEY = originalGreenhouseApiKey;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("returns 400 for real missing Greenhouse configuration", async () => {
    const { GET } = await import("@/app/api/recruiter/ats/greenhouse/pipeline/route");

    const response = await GET(new Request("http://localhost/api/recruiter/ats/greenhouse/pipeline"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "Greenhouse integration not configured" });
  });

  it("does not treat generic Error('greenhouse_not_configured') as typed config error", async () => {
    vi.doMock("@/lib/ats/greenhouse", async () => {
      const actual = await vi.importActual<typeof import("@/lib/ats/greenhouse")>(
        "@/lib/ats/greenhouse"
      );

      return {
        ...actual,
        fetchGreenhousePipeline: vi
          .fn()
          .mockRejectedValue(new Error("greenhouse_not_configured")),
      };
    });

    const { GET } = await import("@/app/api/recruiter/ats/greenhouse/pipeline/route");

    await expect(
      GET(new Request("http://localhost/api/recruiter/ats/greenhouse/pipeline"))
    ).rejects.toThrow("greenhouse_not_configured");
  });
});
