import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/capability-profiles/selection/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getSupabaseServerClientMock,
  getSupabaseServiceRoleClientMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  getSupabaseServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

type StudentDataRecord = Record<string, unknown>;

const buildSupabaseMock = (studentData: StudentDataRecord) => {
  const studentsLimitMock = vi.fn().mockResolvedValue({
    data: [{ student_data: studentData }],
    error: null,
  });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const capabilityModelsSelectMock = vi.fn().mockResolvedValue({
    data: [
      {
        capability_model_id: "profile-1",
        company_id: "company-1",
        role_name: "Software Engineer",
        model_data: { role_name: "Software Engineer" },
        is_active: true,
      },
      {
        capability_model_id: "profile-2",
        company_id: "company-2",
        role_name: "Data Analyst",
        model_data: { role_name: "Data Analyst" },
        is_active: true,
      },
    ],
    error: null,
  });

  const companiesSelectMock = vi.fn().mockResolvedValue({
    data: [
      { company_id: "company-1", company_name: "Adobe" },
      { company_id: "company-2", company_name: "Domo" },
    ],
    error: null,
  });

  const fromMock = vi.fn((table: string) => {
    if (table === "students") {
      return {
        select: studentsSelectMock,
        upsert: studentsUpsertMock,
      };
    }
    if (table === "capability_models") {
      return { select: capabilityModelsSelectMock };
    }
    if (table === "companies") {
      return { select: companiesSelectMock };
    }
    return {};
  });

  return {
    supabase: { from: fromMock },
    studentsUpsertMock,
  };
};

describe("student capability profile selection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      persona: "student",
      profile: { personal_info: {} },
      session_user: { email: "student@example.edu" },
    });
    hasPersonaMock.mockReturnValue(true);
    getSupabaseServiceRoleClientMock.mockReturnValue(null);
  });

  it("preserves ordered selections and archives removed targets", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock({
      active_capability_profiles: [
        {
          capability_profile_id: "profile-1",
          company_id: "company-1",
          company_label: "Adobe",
          role_id: "role-1",
          role_label: "Software Engineer",
          selected_at: "2026-04-01T00:00:00.000Z",
          selection_source: "manual",
        },
      ],
      capability_profile_selection_history: [],
    });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/capability-profiles/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          capability_profile_ids: ["profile-2"],
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.active_capability_profiles).toHaveLength(1);
    expect(payload.data.active_capability_profiles[0].capability_profile_id).toBe("profile-2");

    const upsertPayload = studentsUpsertMock.mock.calls[0]?.[0] as {
      student_data: Record<string, unknown>;
    };
    const history = upsertPayload.student_data.capability_profile_selection_history as Array<Record<string, unknown>>;
    expect(Array.isArray(history)).toBe(true);
    expect(history[0]?.archive_reason).toBe("replaced");
  });

  it("rejects more than two selected profiles", async () => {
    const { supabase } = buildSupabaseMock({});
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/capability-profiles/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          capability_profile_ids: ["profile-1", "profile-2", "profile-3"],
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "capability_profile_limit_exceeded" });
  });
});
