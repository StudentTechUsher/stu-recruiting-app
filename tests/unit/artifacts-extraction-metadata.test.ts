import { describe, expect, it, vi } from "vitest";
import { upsertStudentExtractionMetadata, type SupabaseClientLike } from "@/lib/artifacts/extraction";

const createSupabaseMock = (existingStudentData: Record<string, unknown>) => {
  const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const limitMock = vi.fn().mockResolvedValue({
    data: [{ student_data: existingStudentData }],
    error: null
  });
  const eqMock = vi.fn().mockReturnValue({ limit: limitMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

  const fromMock = vi.fn().mockImplementation(() => ({
    select: selectMock,
    upsert: upsertMock
  }));

  return {
    supabase: { from: fromMock } as unknown as SupabaseClientLike,
    upsertMock
  };
};

describe("upsertStudentExtractionMetadata", () => {
  it("preserves unrelated profile links and ignores empty overwrite values", async () => {
    const { supabase, upsertMock } = createSupabaseMock({
      profile_links: {
        linkedin: "https://www.linkedin.com/in/existing-student",
        handshake: "https://asu.joinhandshake.com/profiles/abc"
      }
    });

    await upsertStudentExtractionMetadata({
      supabase,
      profileId: "student-1",
      sourceKey: "github",
      artifactCount: 2,
      status: "succeeded",
      profileLinks: {
        github: "octocat",
        linkedin: "   "
      }
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    const profileLinks = payload.student_data.profile_links as Record<string, unknown>;

    expect(profileLinks.handshake).toBe("https://asu.joinhandshake.com/profiles/abc");
    expect(profileLinks.linkedin).toBe("https://www.linkedin.com/in/existing-student");
    expect(profileLinks.github).toBe("https://github.com/octocat");
  });

  it("normalizes linkedin and kaggle profile urls when present", async () => {
    const { supabase, upsertMock } = createSupabaseMock({
      profile_links: {}
    });

    await upsertStudentExtractionMetadata({
      supabase,
      profileId: "student-1",
      sourceKey: "linkedin",
      artifactCount: 1,
      status: "succeeded",
      profileLinks: {
        linkedin: "linkedin.com/in/student-name/",
        kaggle: "www.kaggle.com/student-name/projects"
      }
    });

    const payload = upsertMock.mock.calls[0]?.[0] as { student_data: Record<string, unknown> };
    const profileLinks = payload.student_data.profile_links as Record<string, unknown>;
    expect(profileLinks.linkedin).toBe("https://www.linkedin.com/in/student-name");
    expect(profileLinks.kaggle).toBe("https://www.kaggle.com/student-name");
  });
});
