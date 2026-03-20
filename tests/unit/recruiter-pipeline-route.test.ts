import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/recruiter/pipeline/route";

const { getAuthContextMock, hasPersonaMock, getRecruiterCandidateDiscoveryMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getRecruiterCandidateDiscoveryMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/recruiter/candidate-discovery", () => ({
  getRecruiterCandidateDiscovery: getRecruiterCandidateDiscoveryMock,
}));

describe("recruiter pipeline route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forbidden when persona is not allowed", async () => {
    getAuthContextMock.mockResolvedValue({ persona: "student" });
    hasPersonaMock.mockReturnValue(false);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns pipeline provider + summary", async () => {
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "recruiter-1",
      org_id: "org-1",
      persona: "recruiter",
      assignment_ids: [],
    });
    hasPersonaMock.mockReturnValue(true);
    getRecruiterCandidateDiscoveryMock.mockResolvedValue({
      provider: "greenhouse",
      summary: {
        total_candidates: 12,
        matched_students: 5,
        unmatched_candidates: 7,
        recommendation_buckets: {
          recommended: 2,
          hold: 1,
          manual_review: 9,
        },
        top_reason_codes: [{ reason_code: "NO_STUDENT_MATCH", count: 7 }],
      },
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.provider).toBe("greenhouse");
    expect(payload.data.summary.total_candidates).toBe(12);
  });
});
