import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";
import { buildClaimSessionCookieValue } from "@/lib/auth/claim-session-cookie";

const {
  createServerClientMock,
  getSupabaseConfigMock,
  getProfileByUserIdMock,
  getSupabaseServiceRoleClientMock,
  redeemClaimInviteTokenMock,
  createSupabaseCandidateIdentityStoreMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
  getProfileByUserIdMock: vi.fn(),
  getSupabaseServiceRoleClientMock: vi.fn(),
  redeemClaimInviteTokenMock: vi.fn(),
  createSupabaseCandidateIdentityStoreMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: getSupabaseConfigMock
}));

vi.mock("@/lib/auth/profile", () => ({
  getProfileByUserId: getProfileByUserIdMock
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

vi.mock("@/lib/candidates/claim-invite", () => ({
  redeemClaimInviteToken: redeemClaimInviteTokenMock,
}));

vi.mock("@/lib/candidates/identity", () => ({
  createSupabaseCandidateIdentityStore: createSupabaseCandidateIdentityStoreMock,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key"
    });
    getSupabaseServiceRoleClientMock.mockReturnValue(null);
    redeemClaimInviteTokenMock.mockResolvedValue({ ok: false, error: "invalid_token" });
    createSupabaseCandidateIdentityStoreMock.mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects recruiter-intended callbacks that resolve to a student profile", async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              app_metadata: { role: "student", stu_persona: "student" },
              user_metadata: {}
            }
          },
          error: null
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              app_metadata: { role: "student", stu_persona: "student" },
              user_metadata: {}
            }
          },
          error: null
        }),
        signOut: signOutMock
      }
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "user-1",
      role: "student",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: "2026-03-10T00:00:00.000Z"
    });

    const response = await GET(
      new Request("https://app.example.com/auth/callback?code=test-code", {
        headers: {
          cookie: "stu-magic-link-intent=recruiter"
        }
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example.com/login/recruiter?error=wrong_account_type");
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=");
  });

  it("rejects referrer-intended callbacks that resolve to a recruiter profile", async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              app_metadata: { role: "recruiter", stu_persona: "recruiter" },
              user_metadata: {}
            }
          },
          error: null
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              app_metadata: { role: "recruiter", stu_persona: "recruiter" },
              user_metadata: {}
            }
          },
          error: null
        }),
        signOut: signOutMock
      }
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "user-2",
      role: "recruiter",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: "2026-03-10T00:00:00.000Z"
    });

    const response = await GET(
      new Request("https://app.example.com/auth/callback?code=test-code", {
        headers: {
          cookie: "stu-magic-link-intent=referrer"
        }
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example.com/login/referrer?error=wrong_account_type");
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=");
  });

  it("marks claim status invalid when callback claim token does not match invite-initiated session", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "student-3",
              email: "student@example.com",
              app_metadata: { role: "student", stu_persona: "student" },
              user_metadata: {}
            }
          },
          error: null
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "student-3",
              email: "student@example.com",
              app_metadata: { role: "student", stu_persona: "student" },
              user_metadata: {}
            }
          },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "student-3",
      role: "student",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: null
    });

    const validClaimCookie = buildClaimSessionCookieValue({
      claimToken: "matching-token",
      email: "student@example.com",
    });
    const response = await GET(
      new Request("https://app.example.com/auth/callback?code=test-code&claim_token=different-token", {
        headers: {
          cookie: `stu-claim-session=${validClaimCookie}; stu-magic-link-intent=student`
        }
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example.com/student/onboarding?claim_status=invalid");
    expect(redeemClaimInviteTokenMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("stu-claim-session=");
  });
});
