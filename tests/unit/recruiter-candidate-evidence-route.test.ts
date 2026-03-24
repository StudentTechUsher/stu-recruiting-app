import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/recruiter/candidates/[applicationId]/evidence/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getRecruiterReviewCandidateEvidenceMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getRecruiterReviewCandidateEvidenceMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/recruiter/review-candidates", () => ({
  getRecruiterReviewCandidateEvidence: getRecruiterReviewCandidateEvidenceMock,
}));

describe("recruiter candidate evidence route", () => {
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

  it("returns evidence detail payload", async () => {
    getRecruiterReviewCandidateEvidenceMock.mockResolvedValue({
      application_id: "app-1",
      candidate_id: "cand-1",
      identity_state: "resolved",
      identity_source: "canonical_linked",
      identity_reason: null,
      full_name: "Taylor Candidate",
      job_role: "Data Analyst",
      capability_summary: [],
      selected_capability_id: null,
      artifacts: [],
      panel_state: "panel_no_evidence",
    });

    const response = await GET(new Request("http://localhost/api/recruiter/candidates/app-1/evidence"), {
      params: Promise.resolve({ applicationId: "app-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.resource).toBe("review_candidate_evidence");
    expect(payload.data.detail.application_id).toBe("app-1");
  });

  it("returns bad request when application is missing", async () => {
    const response = await GET(new Request("http://localhost/api/recruiter/candidates//evidence"), {
      params: Promise.resolve({ applicationId: "" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_application_id" });
  });
});
