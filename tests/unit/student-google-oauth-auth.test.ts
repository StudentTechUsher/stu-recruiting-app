import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as studentGoogleOAuthStart } from "@/app/api/auth/login/student/google/route";

const {
  createServerClientMock,
  getSupabaseConfigMock,
  getAuthAppUrlMock,
  isStudentGoogleOAuthEnabledMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
  getAuthAppUrlMock: vi.fn(),
  isStudentGoogleOAuthEnabledMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: getSupabaseConfigMock,
  getAuthAppUrl: getAuthAppUrlMock,
}));

vi.mock("@/lib/session-flags", () => ({
  isStudentGoogleOAuthEnabled: isStudentGoogleOAuthEnabledMock,
}));

describe("student google oauth auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key",
    });
    getAuthAppUrlMock.mockReturnValue("https://app.example.com");
    isStudentGoogleOAuthEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 when student Google OAuth is disabled", async () => {
    isStudentGoogleOAuthEnabledMock.mockReturnValue(false);
    const response = await studentGoogleOAuthStart(
      new Request("https://app.example.com/api/auth/login/student/google")
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ ok: false, error: "google_oauth_disabled" });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase config is missing", async () => {
    getSupabaseConfigMock.mockReturnValue(null);
    const response = await studentGoogleOAuthStart(
      new Request("https://app.example.com/api/auth/login/student/google")
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ ok: false, error: "supabase_not_configured" });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("redirects to Google OAuth URL and sets student intent cookie", async () => {
    const signInWithOAuthMock = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test" },
      error: null,
    });
    createServerClientMock.mockReturnValue({
      auth: {
        signInWithOAuth: signInWithOAuthMock,
      },
    });

    const response = await studentGoogleOAuthStart(
      new Request("https://app.example.com/api/auth/login/student/google?claim_token=claim-123")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?client_id=test");
    expect(response.headers.get("set-cookie")).toContain("stu-magic-link-intent=student");
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://app.example.com/auth/callback?claim_token=claim-123",
      },
    });
  });
});

