import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/student/capability-profiles/route";

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

const buildSupabaseMock = () => {
  const studentsSelectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [{ student_data: {} }],
        error: null,
      }),
    }),
  });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const capabilityModelsSelectMock = vi.fn().mockResolvedValue({
    data: [
      {
        capability_model_id: "profile-1",
        company_id: "company-1",
        role_name: "Software Engineer",
        model_data: {},
        is_active: true,
        updated_at: "2026-04-01T11:00:00.000Z",
      },
      {
        capability_model_id: "profile-2",
        company_id: "company-2",
        role_name: "Software Engineer",
        model_data: {},
        is_active: true,
        updated_at: "2026-04-01T12:00:00.000Z",
      },
      {
        capability_model_id: "profile-3",
        company_id: "company-3",
        role_name: "Product Manager",
        model_data: {},
        is_active: false,
        updated_at: "2026-04-01T13:00:00.000Z",
      },
    ],
    error: null,
  });

  const companiesSelectMock = vi.fn().mockResolvedValue({
    data: [
      { company_id: "company-1", company_name: "Adobe" },
      { company_id: "company-2", company_name: "Domo" },
      { company_id: "company-3", company_name: "GitHub" },
    ],
    error: null,
  });

  const rolesSelectMock = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });

  const artifactsSelectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
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

    if (table === "job_roles") {
      return { select: rolesSelectMock };
    }

    if (table === "artifacts") {
      return { select: artifactsSelectMock };
    }

    return {};
  });

  return {
    supabase: { from: fromMock },
    studentsUpsertMock,
  };
};

describe("student capability profiles GET route", () => {
  const nowSpy = vi.spyOn(Date, "now");

  beforeEach(() => {
    vi.clearAllMocks();
    nowSpy.mockReturnValue(new Date("2026-04-01T12:30:00.000Z").getTime());
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      persona: "student",
      profile: { personal_info: {} },
      session_user: { email: "student@example.edu" },
    });
    hasPersonaMock.mockReturnValue(true);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("dedupes roles from top-level capability model role_name and maps company labels", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock();
    getSupabaseServerClientMock.mockResolvedValue(supabase);
    getSupabaseServiceRoleClientMock.mockReturnValue(supabase);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    expect(payload.data.roles).toEqual([
      {
        role_id: "name:software engineer",
        role_label: "Software Engineer",
      },
    ]);

    expect(payload.data.companies).toEqual([
      { company_id: "company-1", company_label: "Adobe" },
      { company_id: "company-2", company_label: "Domo" },
      { company_id: "company-3", company_label: "GitHub" },
    ]);

    expect(payload.data.capability_profiles).toEqual([
      {
        capability_profile_id: "profile-2",
        company_id: "company-2",
        company_label: "Domo",
        role_id: "name:software engineer",
        role_label: "Software Engineer",
        capability_ids: [],
      },
      {
        capability_profile_id: "profile-1",
        company_id: "company-1",
        company_label: "Adobe",
        role_id: "name:software engineer",
        role_label: "Software Engineer",
        capability_ids: [],
      },
    ]);
    expect(studentsUpsertMock).not.toHaveBeenCalled();
  });
});
