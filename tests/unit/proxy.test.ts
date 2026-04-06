import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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

describe("proxy API auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key",
    });
  });

  it("skips profile resolution for auth-required student API routes", async () => {
    const getUserMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "student-1",
          app_metadata: { role: "student" },
          user_metadata: { role: "student" },
        },
      },
      error: null,
    });
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });

    const response = await proxy(new NextRequest("https://app.example.com/api/student/profile"));

    expect(response.status).toBe(200);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getProfileByUserIdMock).not.toHaveBeenCalled();
  });

  it("still enforces authentication for auth-required student API routes", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await proxy(new NextRequest("https://app.example.com/api/student/profile"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/login");
    expect(getProfileByUserIdMock).not.toHaveBeenCalled();
  });

  it("keeps full profile checks for page routes", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "student-1",
              app_metadata: { role: "student", stu_persona: "student" },
              user_metadata: { role: "student", stu_persona: "student" },
            },
          },
          error: null,
        }),
      },
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "student-1",
      role: "student",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: "2026-03-10T00:00:00.000Z",
    });

    await proxy(new NextRequest("https://app.example.com/student/dashboard"));

    expect(getProfileByUserIdMock).toHaveBeenCalledTimes(1);
  });
});
