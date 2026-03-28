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
let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

const getEventNames = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .map((entry: unknown[]) => {
      try {
        const payload = JSON.parse(String(entry[0])) as { event_name?: string };
        return payload.event_name;
      } catch {
        return undefined;
      }
    })
    .filter((value: unknown): value is string => typeof value === "string");

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
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(getEventNames(infoSpy)).toContain("recruiter.candidate_profile_opened");
  });

  it("returns bad request when application is missing", async () => {
    const response = await GET(new Request("http://localhost/api/recruiter/candidates//evidence"), {
      params: Promise.resolve({ applicationId: "" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_application_id" });
    expect(getEventNames(warnSpy)).toContain("recruiter.candidate_profile_opened.failed");
  });
});
