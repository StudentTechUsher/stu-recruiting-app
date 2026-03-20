import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/onboarding/complete/route";

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

const buildSupabaseMock = () => {
  const profilesEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const profilesUpdateMock = vi.fn().mockReturnValue({ eq: profilesEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const companiesUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const rolesUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        update: profilesUpdateMock
      };
    }
    if (table === "students") {
      return {
        upsert: studentsUpsertMock
      };
    }
    if (table === "companies") {
      return {
        upsert: companiesUpsertMock
      };
    }
    if (table === "job_roles") {
      return {
        upsert: rolesUpsertMock
      };
    }
    return {};
  });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "student-1",
            email: "student@school.edu",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: { role: "student", stu_persona: "student" },
            user_metadata: {}
          }
        },
        error: null
      })
    },
    from: fromMock
  };

  return { supabase, studentsUpsertMock };
};

describe("onboarding complete route metrics persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: "https://supabase.example.com",
      anonKey: "anon-key"
    });
    getProfileByUserIdMock.mockResolvedValue({
      id: "student-1",
      role: "student",
      personal_info: {},
      auth_preferences: {},
      onboarding_completed_at: null
    });
  });

  it("persists valid client onboarding metrics under student_data.onboarding_metrics", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock();
    createServerClientMock.mockReturnValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personal_info: {
            first_name: "Jarom",
            last_name: "M",
            target_companies: ["Atlassian"],
            target_roles: ["Software Engineer"]
          },
          client_metrics: {
            onboarding_started_at: "2026-03-19T12:00:00.000Z",
            onboarding_submitted_at: "2026-03-19T12:00:45.000Z",
            onboarding_duration_ms: 45000
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const upsertPayload = studentsUpsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    const metrics = upsertPayload.student_data.onboarding_metrics as Record<string, unknown>;
    expect(metrics.started_at).toBe("2026-03-19T12:00:00.000Z");
    expect(metrics.submitted_at).toBe("2026-03-19T12:00:45.000Z");
    expect(metrics.duration_ms).toBe(45000);
    expect(typeof metrics.completed_at).toBe("string");
  });

  it("ignores malformed client metrics payload", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock();
    createServerClientMock.mockReturnValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personal_info: {
            first_name: "Jarom",
            last_name: "M",
            target_companies: ["Atlassian"],
            target_roles: ["Software Engineer"]
          },
          client_metrics: {
            onboarding_started_at: "bad-date",
            onboarding_duration_ms: "NaN"
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const upsertPayload = studentsUpsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    expect(upsertPayload.student_data.onboarding_metrics).toBeUndefined();
  });
});
