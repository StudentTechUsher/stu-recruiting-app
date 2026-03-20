import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/profile/route";

const { getAuthContextMock, hasPersonaMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock
}));

const buildSupabaseMock = (existingStudentData: Record<string, unknown>) => {
  const studentsLimitMock = vi.fn().mockResolvedValue({
    data: [{ student_data: existingStudentData }]
  });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const profilesEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const profilesUpdateMock = vi.fn().mockReturnValue({ eq: profilesEqMock });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "students") {
      return {
        select: studentsSelectMock,
        upsert: studentsUpsertMock
      };
    }
    if (table === "profiles") {
      return {
        update: profilesUpdateMock
      };
    }
    return {};
  });

  return {
    supabase: { from: fromMock },
    studentsUpsertMock
  };
};

describe("student profile route nested link merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPersonaMock.mockReturnValue(true);
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      profile: {
        personal_info: {
          first_name: "Jarom",
          last_name: "M",
          email: "jarom@school.edu"
        }
      },
      session_user: {
        email: "jarom@school.edu"
      },
      session_source: "supabase"
    });
  });

  it("preserves unrelated profile links when partial updates are posted", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock({
      profile_links: {
        linkedin: "https://www.linkedin.com/in/existing",
        github: "https://github.com/existing-user"
      }
    });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_data: {
            profile_links: {
              linkedin: "linkedin.com/in/new-user/"
            }
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);

    const upsertPayload = studentsUpsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    const profileLinks = upsertPayload.student_data.profile_links as Record<string, unknown>;
    expect(profileLinks.github).toBe("https://github.com/existing-user");
    expect(profileLinks.linkedin).toBe("https://www.linkedin.com/in/new-user");
  });

  it("only clears the targeted key when empty string is explicitly submitted", async () => {
    const { supabase, studentsUpsertMock } = buildSupabaseMock({
      profile_links: {
        linkedin: "https://www.linkedin.com/in/existing",
        github: "https://github.com/existing-user"
      },
      artifact_profile_links: {
        linkedin: "https://www.linkedin.com/in/existing",
        github: "https://github.com/existing-user",
        other_repo: "https://gitlab.com/existing-user"
      }
    });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_data: {
            profile_links: {
              linkedin: ""
            },
            artifact_profile_links: {
              github: ""
            }
          }
        })
      })
    );

    expect(response.status).toBe(200);

    const upsertPayload = studentsUpsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    const profileLinks = upsertPayload.student_data.profile_links as Record<string, unknown>;
    const artifactProfileLinks = upsertPayload.student_data.artifact_profile_links as Record<string, unknown>;

    expect(profileLinks.linkedin).toBe("");
    expect(profileLinks.github).toBe("https://github.com/existing-user");
    expect(artifactProfileLinks.github).toBe("");
    expect(artifactProfileLinks.linkedin).toBe("https://www.linkedin.com/in/existing");
    expect(artifactProfileLinks.other_repo).toBe("https://gitlab.com/existing-user");
  });
});
