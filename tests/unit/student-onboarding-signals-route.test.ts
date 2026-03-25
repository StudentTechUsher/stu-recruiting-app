import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/onboarding/signals/route";

const { getAuthContextMock, hasPersonaMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
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

const buildSupabaseMock = (studentData: Record<string, unknown>) => {
  const studentsLimitMock = vi.fn().mockResolvedValue({ data: [{ student_data: studentData }], error: null });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const profilesLimitMock = vi.fn().mockResolvedValue({
    data: [{ personal_info: {}, onboarding_completed_at: null }],
    error: null,
  });
  const profilesEqSelectMock = vi.fn().mockReturnValue({ limit: profilesLimitMock });
  const profilesSelectMock = vi.fn().mockReturnValue({ eq: profilesEqSelectMock });
  const profilesEqUpdateMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const profilesUpdateMock = vi.fn().mockReturnValue({ eq: profilesEqUpdateMock });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "students") {
      return {
        select: studentsSelectMock,
        upsert: studentsUpsertMock,
      };
    }
    if (table === "profiles") {
      return {
        select: profilesSelectMock,
        update: profilesUpdateMock,
      };
    }
    return {};
  });

  return {
    supabase: {
      from: fromMock,
    },
    studentsUpsertMock,
    profilesUpdateMock,
  };
};

describe("student onboarding signals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPersonaMock.mockReturnValue(true);
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      session_source: "supabase",
    });
  });

  it("dismisses active resume email mismatch warning", async () => {
    const { supabase, studentsUpsertMock, profilesUpdateMock } = buildSupabaseMock({
      onboarding_signals: {
        resume_email_mismatch: {
          status: "active",
          auth_email: "student@example.com",
          resume_email: "student+old@example.com",
        },
      },
    });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/onboarding/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "dismiss_resume_email_mismatch",
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(studentsUpsertMock).toHaveBeenCalledTimes(1);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("flags claim mismatch and clears onboarding completion", async () => {
    const { supabase, studentsUpsertMock, profilesUpdateMock } = buildSupabaseMock({});
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/onboarding/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "flag_claim_mismatch",
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(studentsUpsertMock).toHaveBeenCalledTimes(1);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });
});
