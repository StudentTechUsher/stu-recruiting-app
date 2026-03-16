import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";

const { createServerClientMock, getSupabaseConfigMock, getProfileByUserIdMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
  getProfileByUserIdMock: vi.fn()
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

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key"
    });
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
});
