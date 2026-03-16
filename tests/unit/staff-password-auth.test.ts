import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/staff/route";

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

const makeRequest = (body: unknown) =>
  new Request("https://app.example.com/api/auth/login/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

describe("staff password auth route", () => {
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

  it("blocks recruiter password login and instructs recruiter magic link", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              app_metadata: { role: "recruiter", stu_persona: "recruiter" },
              user_metadata: {}
            }
          },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "user-1",
      role: "recruiter",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: null
    });

    const response = await POST(makeRequest({ email: "recruiter@company.com", password: "hunter2!" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "use_recruiter_magic_link" });
  });

  it("allows org-admin password login", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              app_metadata: { role: "org_admin", stu_persona: "org_admin" },
              user_metadata: {}
            }
          },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "user-2",
      role: "org_admin",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: "2026-03-10T00:00:00.000Z"
    });

    const response = await POST(makeRequest({ email: "admin@company.com", password: "hunter2!" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, redirectPath: "/admin/recruiter-assignments" });
    expect(response.headers.get("x-stu-login-email")).toBe("admin@company.com");
    expect(response.headers.get("x-stu-persona")).toBe("org_admin");
  });
});
