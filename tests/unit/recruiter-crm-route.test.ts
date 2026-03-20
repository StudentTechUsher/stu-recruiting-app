import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/recruiter/candidate-relationship-manager/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getCandidateRelationshipManagerDataMock,
  addCandidateCRMNoteMock,
  addCandidateCRMReminderMock,
  updateCandidateCRMReminderStatusMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getCandidateRelationshipManagerDataMock: vi.fn(),
  addCandidateCRMNoteMock: vi.fn(),
  addCandidateCRMReminderMock: vi.fn(),
  updateCandidateCRMReminderStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/recruiter/crm", () => ({
  getCandidateRelationshipManagerData: getCandidateRelationshipManagerDataMock,
  addCandidateCRMNote: addCandidateCRMNoteMock,
  addCandidateCRMReminder: addCandidateCRMReminderMock,
  updateCandidateCRMReminderStatus: updateCandidateCRMReminderStatusMock,
}));

describe("recruiter crm route", () => {
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

  it("returns forbidden when requester lacks persona access", async () => {
    hasPersonaMock.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/recruiter/candidate-relationship-manager"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns crm data", async () => {
    getCandidateRelationshipManagerDataMock.mockResolvedValue({
      timeline: [],
      notes: [],
      reminders: [],
    });

    const response = await GET(
      new Request("http://localhost/api/recruiter/candidate-relationship-manager?candidate_key=greenhouse:123")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(getCandidateRelationshipManagerDataMock).toHaveBeenCalledWith({
      orgId: "org-1",
      candidateKey: "greenhouse:123",
    });
  });

  it("validates payload shape", async () => {
    const response = await POST(
      new Request("http://localhost/api/recruiter/candidate-relationship-manager", {
        method: "POST",
        body: JSON.stringify({ type: "note", candidate_key: "abc" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_crm_payload" });
  });

  it("creates a note event", async () => {
    addCandidateCRMNoteMock.mockResolvedValue({
      note_id: "note-1",
      candidate_key: "greenhouse:123",
      student_profile_id: null,
      note_text: "Strong systems interview.",
      created_at: "2026-03-19T00:00:00.000Z",
      updated_at: "2026-03-19T00:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/recruiter/candidate-relationship-manager", {
        method: "POST",
        body: JSON.stringify({
          type: "note",
          candidate_key: "greenhouse:123",
          note_text: "Strong systems interview.",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(addCandidateCRMNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        userId: "recruiter-1",
        candidateKey: "greenhouse:123",
      })
    );
  });
});
