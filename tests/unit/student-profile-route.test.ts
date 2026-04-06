import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/student/profile/route";

const { getAuthContextMock, hasPersonaMock, getSupabaseServerClientMock, buildStudentIdentitySnapshotMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  buildStudentIdentitySnapshotMock: vi.fn(),
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

vi.mock("@/lib/student/identity", () => ({
  buildStudentIdentitySnapshot: buildStudentIdentitySnapshotMock,
}));

const buildSupabaseMock = (existingStudentData: Record<string, unknown>) => {
  const profilesLimitMock = vi.fn().mockResolvedValue({
    data: [
      {
        personal_info: {
          first_name: "Jarom",
          last_name: "M",
          full_name: "Jarom M",
          email: "jarom@school.edu",
        },
      },
    ],
  });
  const profilesEqMock = vi.fn().mockReturnValue({ limit: profilesLimitMock });
  const profilesSelectMock = vi.fn().mockReturnValue({ eq: profilesEqMock });
  const studentsLimitMock = vi.fn().mockResolvedValue({
    data: [{ student_data: existingStudentData }]
  });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });
  const studentsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const profilesUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "students") {
      return {
        select: studentsSelectMock,
        upsert: studentsUpsertMock
      };
    }
    if (table === "profiles") {
      return {
        select: profilesSelectMock,
        upsert: profilesUpsertMock
      };
    }
    return {};
  });

  return {
    supabase: { from: fromMock },
    studentsUpsertMock,
    profilesUpsertMock
  };
};

describe("student profile route nested link merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPersonaMock.mockReturnValue(true);
    buildStudentIdentitySnapshotMock.mockResolvedValue({
      display_name: "Jarom M",
      first_name: "Jarom",
      initials_fallback: "JM",
      avatar_url: "https://cdn.example.com/avatar.png",
      cache_scope: "student-1:org-1",
    });
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      org_id: "org-1",
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

  it("returns lightweight identity payload in identity view mode", async () => {
    const profileLimitMock = vi.fn().mockResolvedValue({
      data: [
        {
          personal_info: {
            first_name: "Jarom",
            last_name: "M",
            full_name: "Jarom M",
            email: "jarom@school.edu",
          },
        },
      ],
    });
    const profileEqMock = vi.fn().mockReturnValue({ limit: profileLimitMock });
    const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") return { select: profileSelectMock };
      throw new Error(`unexpected_table_${table}`);
    });
    getSupabaseServerClientMock.mockResolvedValue({ from: fromMock });

    const response = await GET(new Request("https://app.example.com/api/student/profile?view=identity"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.resource).toBe("student_profile_identity");
    expect(payload.data.identity).toMatchObject({
      display_name: "Jarom M",
      cache_scope: "student-1:org-1",
    });
    expect(buildStudentIdentitySnapshotMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("profiles");
  });

  it("preserves unrelated profile links when partial updates are posted", async () => {
    const { supabase, studentsUpsertMock, profilesUpsertMock } = buildSupabaseMock({
      profile_links: {
        linkedin: "https://www.linkedin.com/in/existing",
        github: "https://github.com/existing-user",
        leetcode: "https://leetcode.com/u/existing-user"
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
              linkedin: "linkedin.com/in/new-user/",
              leetcode: "leetcode.com/new-user/"
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
    expect(profileLinks.leetcode).toBe("https://leetcode.com/u/new-user");
    expect(profilesUpsertMock).toHaveBeenCalled();
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

  it("returns bad request when profile persistence fails", async () => {
    const { supabase, profilesUpsertMock } = buildSupabaseMock({});
    profilesUpsertMock.mockResolvedValue({ data: null, error: { message: "write failed" } });
    getSupabaseServerClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://app.example.com/api/student/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personal_info: {
            avatar_file_ref: {
              bucket: "student-artifacts-private",
              path: "student-1/artifacts/avatar.png"
            }
          }
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ ok: false, error: "profile_save_failed" });
  });
});
