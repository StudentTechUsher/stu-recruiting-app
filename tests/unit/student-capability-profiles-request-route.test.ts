import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/capability-profiles/request/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getSupabaseServerClientMock,
  sendCapabilityProfileRequestAlertMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  sendCapabilityProfileRequestAlertMock: vi.fn(),
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

vi.mock("@/lib/capabilities/capability-profile-request-alerts", () => ({
  sendCapabilityProfileRequestAlert: sendCapabilityProfileRequestAlertMock,
}));

const buildSupabaseMock = (studentData: Record<string, unknown>) => {
  const studentsLimitMock = vi.fn().mockResolvedValue({
    data: [{ student_data: studentData }],
    error: null,
  });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const fromMock = vi.fn((table: string) => {
    if (table === "students") {
      return {
        select: studentsSelectMock,
        upsert: studentsUpsertMock,
      };
    }
    return {};
  });

  return {
    supabase: { from: fromMock },
    studentsUpsertMock,
  };
};

describe("student capability profile request route", () => {
  const nowSpy = vi.spyOn(Date, "now");

  beforeEach(() => {
    vi.clearAllMocks();
    nowSpy.mockReturnValue(new Date("2026-04-01T12:00:00.000Z").getTime());
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      persona: "student",
      profile: {
        personal_info: {
          email: "student@example.edu",
        },
      },
      session_user: {
        email: "student@example.edu",
      },
    });
    hasPersonaMock.mockReturnValue(true);
    sendCapabilityProfileRequestAlertMock.mockResolvedValue({ messageId: "message-1" });
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("sends request and stores request log entry", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock({});
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/capability-profiles/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_id: "company-1",
          role_id: "role-1",
          company_label: "Adobe",
          role_label: "Software Engineer",
          source_mode: "role_first",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("sent");
    expect(sendCapabilityProfileRequestAlertMock).toHaveBeenCalled();
    expect(studentsUpsertMock).toHaveBeenCalled();
  });

  it("returns duplicate status for recent request with same normalized key", async () => {
    const recentIso = new Date(new Date("2026-04-01T12:00:00.000Z").getTime() - 5 * 60 * 1000).toISOString();
    const { supabase } = buildSupabaseMock({
      capability_profile_request_log: [
        {
          request_key: "ids:company-1::role-1",
          requested_at: recentIso,
        },
      ],
    });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/capability-profiles/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_id: "company-1",
          role_id: "role-1",
          company_label: "Adobe",
          role_label: "Software Engineer",
          source_mode: "employer_first",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("duplicate_recent_request");
    expect(sendCapabilityProfileRequestAlertMock).not.toHaveBeenCalled();
  });
});
