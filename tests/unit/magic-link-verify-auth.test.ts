import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as studentVerifyPost } from "@/app/api/auth/login/student/verify/route";
import { POST as recruiterVerifyPost } from "@/app/api/auth/login/recruiter/verify/route";

const { createServerClientMock, getSupabaseConfigMock, getProfileByUserIdMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
  getProfileByUserIdMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: getSupabaseConfigMock,
}));

vi.mock("@/lib/auth/profile", () => ({
  getProfileByUserId: getProfileByUserIdMock,
}));

const makeRequest = (pathname: string, body: unknown, cookieHeader?: string) =>
  new Request(`https://app.example.com${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });

describe("magic-link code verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies student code and returns redirect path", async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "student-1",
          app_metadata: { role: "student", stu_persona: "student" },
          user_metadata: {},
        },
      },
      error: null,
    });

    createServerClientMock.mockReturnValue({
      auth: {
        verifyOtp: verifyOtpMock,
        getUser: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });

    getProfileByUserIdMock.mockResolvedValue({
      id: "student-1",
      role: "student",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: null,
    });

    const response = await studentVerifyPost(
      makeRequest("/api/auth/login/student/verify", { email: "student@asu.edu", code: "123456" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, redirectPath: "/student/onboarding" });
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: "student@asu.edu",
      token: "123456",
      type: "email",
    });
  });

  it("blocks mismatch when student verify resolves recruiter", async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              app_metadata: { role: "recruiter", stu_persona: "recruiter" },
              user_metadata: {},
            },
          },
          error: null,
        }),
        getUser: vi.fn(),
        updateUser: vi.fn(),
        signOut: signOutMock,
      },
    });

    getProfileByUserIdMock.mockResolvedValue({
      id: "user-2",
      role: "recruiter",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: "2026-03-10T00:00:00.000Z",
    });

    const response = await studentVerifyPost(
      makeRequest(
        "/api/auth/login/student/verify",
        { email: "student@asu.edu", code: "123456" },
        "stu-magic-link-intent=student"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "wrong_account_type" });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=");
  });

  it("returns invalid_otp_code when provider rejects code", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { user: null },
          error: {
            status: 400,
            message: "Token has expired or is invalid",
          },
        }),
        getUser: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });

    const response = await recruiterVerifyPost(
      makeRequest("/api/auth/login/recruiter/verify", { email: "recruiter@company.com", code: "000000" })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_otp_code" });
  });
});
