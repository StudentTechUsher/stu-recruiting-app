import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/recruiter/candidates/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getRecruiterCandidateDiscoveryMock,
  recordRecruiterCandidateActionMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getRecruiterCandidateDiscoveryMock: vi.fn(),
  recordRecruiterCandidateActionMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/recruiter/candidate-discovery", () => ({
  getRecruiterCandidateDiscovery: getRecruiterCandidateDiscoveryMock,
  recordRecruiterCandidateAction: recordRecruiterCandidateActionMock,
}));

describe("recruiter candidates route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "recruiter-1",
      org_id: "org-1",
      persona: "recruiter",
      assignment_ids: [],
    });
    hasPersonaMock.mockReturnValue(true);
  });

  it("returns candidate list payload", async () => {
    getRecruiterCandidateDiscoveryMock.mockResolvedValue({
      provider: "greenhouse",
      summary: {
        total_candidates: 1,
        matched_students: 1,
        unmatched_candidates: 0,
        recommendation_buckets: { recommended: 1, hold: 0, manual_review: 0 },
        top_reason_codes: [{ reason_code: "RANKED_NORMAL", count: 1 }],
      },
      candidates: [
        {
          candidate_key: "greenhouse:123",
          full_name: "Student One",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
      has_more: false,
      timeline_preview_by_candidate_key: {},
    });

    const response = await GET(new Request("http://localhost/api/recruiter/candidates?page=1&page_size=25"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(1);
    expect(payload.data.candidates[0].candidate_key).toBe("greenhouse:123");
  });

  it("validates candidate action payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/recruiter/candidates", {
        method: "POST",
        body: JSON.stringify({ candidate_key: "x" }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_candidate_action_payload" });
  });

  it("records candidate action payload", async () => {
    recordRecruiterCandidateActionMock.mockResolvedValue({ recorded: true });

    const response = await POST(
      new Request("http://localhost/api/recruiter/candidates", {
        method: "POST",
        body: JSON.stringify({
          candidate_key: "greenhouse:123",
          action_name: "flag_for_review",
          details: { source: "test" },
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("recorded");
    expect(recordRecruiterCandidateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateKey: "greenhouse:123",
        actionName: "flag_for_review",
      })
    );
  });
});
