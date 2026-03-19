import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/recruiter/endorsements/route";

const { getAuthContextMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock
}));

describe("recruiter endorsements route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forbidden for student persona", async () => {
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      org_id: "org-1",
      persona: "student",
      assignment_ids: [],
      profile: { onboarding_completed_at: "2026-03-10T00:00:00.000Z" }
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns endorsements for recruiter persona", async () => {
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "recruiter-1",
      org_id: "org-1",
      persona: "recruiter",
      assignment_ids: [],
      profile: { onboarding_completed_at: "2026-03-10T00:00:00.000Z" }
    });

    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          endorsement_id: "endorsement-1",
          student_profile_id: "student-1",
          student_share_slug: "abc123xyz890",
          student_full_name: "Student One",
          student_avatar_url: null,
          referrer_full_name: "Jordan Referrer",
          referrer_company: "Acme",
          referrer_position: "Director",
          referrer_linkedin_url: "https://linkedin.com/in/jordan-referrer",
          endorsement_text: "Strong ownership and communication.",
          updated_at: "2026-03-18T00:00:00.000Z"
        }
      ]
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    getSupabaseServerClientMock.mockResolvedValue({
      from: fromMock
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.endorsements).toHaveLength(1);
    expect(payload.data.endorsements[0].student_full_name).toBe("Student One");
  });
});
