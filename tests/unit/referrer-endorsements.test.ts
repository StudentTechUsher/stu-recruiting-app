import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as resolveStudentPost } from "@/app/api/referrer/students/resolve/route";
import { POST as saveEndorsementPost } from "@/app/api/referrer/endorsements/route";

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

const makeReferrerContext = () => ({
  authenticated: true,
  user_id: "ref-1",
  org_id: "org-1",
  persona: "referrer" as const,
  assignment_ids: [],
  profile: {
    id: "ref-1",
    role: "referrer" as const,
    personal_info: {
      full_name: "Jordan Referrer"
    },
    auth_preferences: {},
    onboarding_completed_at: "2026-03-18T00:00:00.000Z"
  },
  session_source: "mock" as const,
  session_user: {
    id: "ref-1",
    email: "jordan@acme.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {}
  }
});

describe("referrer students resolve route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue(makeReferrerContext());
  });

  it("rejects invalid profile URL input", async () => {
    const response = await resolveStudentPost(
      new Request("https://app.example.com/api/referrer/students/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_url: "not a url" })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_profile_url" });
  });

  it("resolves a student by slug and returns existing endorsement", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          profile_id: "student-1",
          share_slug: "abc123xyz890",
          full_name: "Student One",
          avatar_url: "https://cdn.example.com/avatar.png"
        }
      ],
      error: null
    });
    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          endorsement_text: "Consistently delivers.",
          updated_at: "2026-03-18T01:00:00.000Z",
          created_at: "2026-03-17T01:00:00.000Z"
        }
      ]
    });
    const eqSecondMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqFirstMock = vi.fn().mockReturnValue({ eq: eqSecondMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqFirstMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    getSupabaseServerClientMock.mockResolvedValue({
      rpc: rpcMock,
      from: fromMock
    });

    const response = await resolveStudentPost(
      new Request("https://app.example.com/api/referrer/students/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_url: "https://app.example.com/profile/abc123xyz890" })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.student.full_name).toBe("Student One");
    expect(payload.data.existing_endorsement.endorsement_text).toBe("Consistently delivers.");
    expect(rpcMock).toHaveBeenCalledWith("resolve_student_share_profile", { input_slug: "abc123xyz890" });
  });
});

describe("referrer endorsements route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue(makeReferrerContext());
  });

  it("rejects endorsement text that exceeds max length", async () => {
    const response = await saveEndorsementPost(
      new Request("https://app.example.com/api/referrer/endorsements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_url: "https://app.example.com/profile/abc123xyz890",
          endorsement: "a".repeat(4001)
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "endorsement_too_long" });
  });

  it("upserts endorsement snapshot fields for a resolved student", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          profile_id: "student-1",
          share_slug: "abc123xyz890",
          full_name: "Student One",
          avatar_url: "https://cdn.example.com/student.png"
        }
      ],
      error: null
    });

    const referrersLimitMock = vi.fn().mockResolvedValue({
      data: [
        {
          referrer_data: {
            full_name: "Jordan Referrer",
            company: "Acme",
            position: "Director",
            linkedin_url: "https://linkedin.com/in/jordan-referrer"
          }
        }
      ]
    });
    const referrersEqMock = vi.fn().mockReturnValue({ limit: referrersLimitMock });
    const referrersSelectMock = vi.fn().mockReturnValue({ eq: referrersEqMock });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const endorsementsSelectMock = vi.fn().mockReturnValue({ upsert: upsertMock });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "referrers") return { select: referrersSelectMock };
      if (table === "endorsements") return { upsert: upsertMock, select: endorsementsSelectMock };
      throw new Error(`unexpected table: ${table}`);
    });

    getSupabaseServerClientMock.mockResolvedValue({
      rpc: rpcMock,
      from: fromMock
    });

    const response = await saveEndorsementPost(
      new Request("https://app.example.com/api/referrer/endorsements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_url: "https://app.example.com/profile/abc123xyz890",
          endorsement: "Strong ownership and communication."
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        student_profile_id: "student-1",
        referrer_profile_id: "ref-1",
        student_share_slug: "abc123xyz890",
        student_full_name: "Student One",
        referrer_full_name: "Jordan Referrer",
        referrer_company: "Acme",
        referrer_position: "Director",
        endorsement_text: "Strong ownership and communication."
      }),
      { onConflict: "referrer_profile_id,student_profile_id" }
    );
  });
});
