import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/recruiter/candidates/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  listRecruiterReviewCandidatesMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  listRecruiterReviewCandidatesMock: vi.fn(),
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
  listRecruiterReviewCandidates: listRecruiterReviewCandidatesMock,
}));

describe("recruiter candidates route", () => {
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

  it("returns candidate list payload", async () => {
    listRecruiterReviewCandidatesMock.mockResolvedValue({
      provider: "greenhouse",
      candidates: [
        {
          candidate_key: "greenhouse:app-1",
          candidate_id: "cand-1",
          application_id: "app-1",
          employer_id: "org-1",
          job_role: "Data Analyst",
          full_name: "Student One",
          identity_state: "resolved",
          identity_source: "canonical_linked",
          identity_reason: null,
          capability_summary: [],
          evidence_indicator: { verified: 0, pending: 0, unverified: 0 },
          current_stage: "Phone Screen",
          applied_at: "2026-03-20T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
      has_more: false,
      job_roles: ["Data Analyst"],
    });

    const response = await GET(new Request("http://localhost/api/recruiter/candidates?page=1&page_size=25"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.resource).toBe("review_candidates");
    expect(payload.data.total).toBe(1);
    expect(payload.data.candidates[0].candidate_key).toBe("greenhouse:app-1");
    expect(getEventNames(infoSpy)).toContain("recruiter.candidate_search_performed");
  });

  it("emits handled failure metric for unauthorized search access", async () => {
    hasPersonaMock.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/recruiter/candidates"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "forbidden" });
    expect(getEventNames(warnSpy)).toContain("recruiter.candidate_search_performed.failed");
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
    const response = await POST(
      new Request("http://localhost/api/recruiter/candidates", {
        method: "POST",
        body: JSON.stringify({
          candidate_key: "greenhouse:123",
          action_name: "flag_for_review",
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("disabled_in_phase1");
  });
});
