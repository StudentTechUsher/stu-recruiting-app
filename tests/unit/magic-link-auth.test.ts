import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as studentMagicLinkPost } from "@/app/api/auth/login/student/route";
import { POST as recruiterMagicLinkPost } from "@/app/api/auth/login/recruiter/route";
import { isExpectedUnauthenticatedAuthError, isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import { resetMagicLinkThrottleStateForTests } from "@/lib/auth/magic-link-throttle";

const { createServerClientMock, getSupabaseConfigMock, getAuthAppUrlMock, isAllowedStudentEmailMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
  getAuthAppUrlMock: vi.fn(),
  isAllowedStudentEmailMock: vi.fn()
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: getSupabaseConfigMock,
  getAuthAppUrl: getAuthAppUrlMock
}));

vi.mock("@/lib/auth/student-email-policy", () => ({
  isAllowedStudentEmail: isAllowedStudentEmailMock
}));

const makeRequest = (pathname: string, body: unknown) =>
  new Request(`https://app.example.com${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

describe("student magic-link auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resetMagicLinkThrottleStateForTests();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key"
    });
    getAuthAppUrlMock.mockReturnValue("https://app.example.com");
    isAllowedStudentEmailMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a magic link with expected redirect metadata", async () => {
    const signInWithOtpMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: { signInWithOtp: signInWithOtpMock }
    });

    const response = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@asu.edu" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(response.headers.get("x-stu-login-email")).toBe("student@asu.edu");
    expect(response.headers.get("x-stu-persona")).toBe("student");
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=student");
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "student@asu.edu",
      options: {
        emailRedirectTo: "https://app.example.com/auth/callback",
        shouldCreateUser: true,
        data: {
          role: "student",
          stu_persona: "student"
        }
      }
    });
  });

  it("returns 400 when student email domain policy fails", async () => {
    isAllowedStudentEmailMock.mockReturnValue(false);

    const response = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@gmail.com" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_student_email_domain" });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase config is missing", async () => {
    getSupabaseConfigMock.mockReturnValue(null);

    const response = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@asu.edu" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ ok: false, error: "supabase_not_configured" });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("handles OTP throttling as guided success with retry metadata", async () => {
    const signInWithOtpMock = vi.fn().mockResolvedValue({
      error: {
        status: 429,
        message: "Too many requests"
      }
    });
    createServerClientMock.mockReturnValue({
      auth: { signInWithOtp: signInWithOtpMock }
    });

    const response = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@asu.edu" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, throttled: true, retryAfterSeconds: 60 });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-stu-login-email")).toBe("student@asu.edu");
    expect(response.headers.get("x-stu-persona")).toBe("student");
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=student");
  });

  it("blocks immediate repeat requests for the same email before calling Supabase", async () => {
    const signInWithOtpMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: { signInWithOtp: signInWithOtpMock }
    });

    const firstResponse = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@asu.edu" }));
    const firstPayload = await firstResponse.json();
    const secondResponse = await studentMagicLinkPost(makeRequest("/api/auth/login/student", { email: "student@asu.edu" }));
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload).toEqual({ ok: true });
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toEqual({ ok: true, throttled: true, retryAfterSeconds: 60 });
    expect(secondResponse.headers.get("retry-after")).toBe("60");
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
  });
});

describe("recruiter magic-link auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resetMagicLinkThrottleStateForTests();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key"
    });
    getAuthAppUrlMock.mockReturnValue("https://app.example.com");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a recruiter magic link with recruiter metadata", async () => {
    const signInWithOtpMock = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({
      auth: { signInWithOtp: signInWithOtpMock }
    });

    const response = await recruiterMagicLinkPost(makeRequest("/api/auth/login/recruiter", { email: "recruiter@company.com" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(response.headers.get("x-stu-login-email")).toBe("recruiter@company.com");
    expect(response.headers.get("x-stu-persona")).toBe("recruiter");
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=recruiter");
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "recruiter@company.com",
      options: {
        emailRedirectTo: "https://app.example.com/auth/callback",
        shouldCreateUser: true,
        data: {
          role: "recruiter",
          stu_persona: "recruiter"
        }
      }
    });
  });

  it("handles recruiter OTP throttling as guided success with retry metadata", async () => {
    const signInWithOtpMock = vi.fn().mockResolvedValue({
      error: {
        status: 429,
        message: "Too many requests"
      }
    });
    createServerClientMock.mockReturnValue({
      auth: { signInWithOtp: signInWithOtpMock }
    });

    const response = await recruiterMagicLinkPost(makeRequest("/api/auth/login/recruiter", { email: "recruiter@company.com" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, throttled: true, retryAfterSeconds: 60 });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-stu-login-email")).toBe("recruiter@company.com");
    expect(response.headers.get("x-stu-persona")).toBe("recruiter");
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=recruiter");
  });
});

describe("refresh token error detection", () => {
  it("detects refresh_token_not_found by code", () => {
    expect(isRefreshTokenNotFoundError({ code: "refresh_token_not_found" })).toBe(true);
  });

  it("detects refresh-token missing by message", () => {
    expect(isRefreshTokenNotFoundError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(true);
  });

  it("does not classify unrelated errors as refresh token errors", () => {
    expect(isRefreshTokenNotFoundError({ code: "invalid_grant", message: "wrong password" })).toBe(false);
  });
});

describe("expected unauthenticated auth error detection", () => {
  it("detects auth_session_missing by code", () => {
    expect(isExpectedUnauthenticatedAuthError({ code: "auth_session_missing" })).toBe(true);
  });

  it("detects session-not-found errors by code pattern", () => {
    expect(isExpectedUnauthenticatedAuthError({ code: "session_not_found" })).toBe(true);
  });

  it("detects auth session missing by message", () => {
    expect(isExpectedUnauthenticatedAuthError({ message: "Auth session missing!" })).toBe(true);
  });

  it("does not classify unrelated errors as expected unauthenticated", () => {
    expect(isExpectedUnauthenticatedAuthError({ code: "invalid_grant", message: "wrong password" })).toBe(false);
  });
});
