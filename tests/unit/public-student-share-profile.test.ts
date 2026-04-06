import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicStudentShareProfileBySlug } from "@/lib/public/student-share-profile";
import { createHash } from "node:crypto";

const { getSupabaseServiceRoleClientMock } = vi.hoisted(() => ({
  getSupabaseServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

const buildSupabaseMock = ({
  shareRows,
  profileRows,
  studentRows,
  studentLookupRows,
  artifactRows,
  capabilityModelRows,
  jobRoleRows,
}: {
  shareRows: Array<Record<string, unknown>>;
  profileRows: Array<Record<string, unknown>>;
  studentRows: Array<Record<string, unknown>>;
  studentLookupRows?: Array<Record<string, unknown>>;
  artifactRows: Array<Record<string, unknown>>;
  capabilityModelRows: Array<Record<string, unknown>>;
  jobRoleRows: Array<Record<string, unknown>>;
}) => {
  const fromMock = vi.fn((table: string) => {
    if (table === "student_share_links") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: shareRows,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: profileRows,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "students") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: studentRows,
              error: null,
            }),
          }),
          limit: vi.fn().mockResolvedValue({
            data: studentLookupRows ?? studentRows,
            error: null,
          }),
        }),
      };
    }

    if (table === "artifacts") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: artifactRows,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "capability_models") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: capabilityModelRows,
            error: null,
          }),
        }),
      };
    }

    if (table === "job_roles") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: jobRoleRows,
            error: null,
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });

  return {
    from: fromMock,
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: null },
          error: null,
        }),
      }),
    },
  };
};

describe("getPublicStudentShareProfileBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the share slug does not resolve", async () => {
    const supabase = buildSupabaseMock({
      shareRows: [],
      profileRows: [],
      studentRows: [],
      studentLookupRows: [],
      artifactRows: [],
      capabilityModelRows: [],
      jobRoleRows: [],
    });
    getSupabaseServiceRoleClientMock.mockReturnValue(supabase);

    const result = await getPublicStudentShareProfileBySlug("missing-slug");
    expect(result).toBeNull();
  });

  it("returns an allowlisted public payload with active artifacts only", async () => {
    const supabase = buildSupabaseMock({
      shareRows: [{ profile_id: "student-1", share_slug: "vin-jones" }],
      profileRows: [
        {
          role: "student",
          personal_info: {
            full_name: "Vin Jones",
            email: "vin@example.com",
            avatar_url: "https://cdn.example.com/avatar.png",
            location: "Denver, CO",
          },
        },
      ],
      studentRows: [
        {
          student_data: {
            active_capability_profiles: [
              {
                capability_profile_id: "model-1",
                company_id: "company-1",
                company_label: "Acme",
                role_id: "name:software engineer",
                role_label: "Software Engineer",
                selected_at: "2026-04-01T12:00:00.000Z",
                selection_source: "manual",
                status: "active",
              },
            ],
            target_roles: ["Software Engineer"],
            target_companies: ["Acme"],
          },
        },
      ],
      studentLookupRows: [
        {
          profile_id: "student-1",
          profiles: {
            role: "student",
            personal_info: {
              full_name: "Vin Jones",
              email: "vin@example.com",
            },
          },
        },
      ],
      artifactRows: [
        {
          artifact_id: "artifact-active",
          artifact_type: "project",
          artifact_data: {
            title: "Compiler Project",
            source: "GitHub",
            description: "Built a compiler backend",
            verification_status: "verified",
            internal_only: "do-not-expose",
          },
          updated_at: "2026-04-01T12:10:00.000Z",
          is_active: true,
        },
        {
          artifact_id: "artifact-inactive",
          artifact_type: "internship",
          artifact_data: {
            title: "Old Internship",
            source: "Resume",
            verification_status: "pending",
          },
          updated_at: "2026-04-01T10:10:00.000Z",
          is_active: false,
        },
      ],
      capabilityModelRows: [
        {
          capability_model_id: "model-1",
          model_data: {
            weights: {
              technical_depth: 1,
              systems_thinking: 0.8,
            },
          },
        },
      ],
      jobRoleRows: [
        {
          role_name_normalized: "software engineer",
          role_data: {
            capability_ids: ["technical_depth", "systems_thinking", "collaboration"],
          },
        },
      ],
    });
    getSupabaseServiceRoleClientMock.mockReturnValue(supabase);

    const result = await getPublicStudentShareProfileBySlug("vin-jones");

    expect(result).not.toBeNull();
    expect(result?.share_path).toBe("/u/vin-jones");
    expect(result?.candidate.full_name).toBe("Vin Jones");
    expect(result?.candidate.target_roles).toEqual(["Software Engineer"]);
    expect(result?.artifacts).toHaveLength(1);
    expect(result?.artifacts[0]).toMatchObject({
      artifact_id: "artifact-active",
      artifact_type: "project",
      title: "Compiler Project",
      source: "GitHub",
      verification_status: "verified",
      capability_id: "systems_thinking",
    });
    expect(result?.targets).toHaveLength(1);
    expect(result?.targets[0]?.role_label).toBe("Software Engineer");
    expect(result?.targets[0]?.alignment_score).toBeGreaterThanOrEqual(0);
    expect(result?.targets[0]?.confidence_summary).toBeTruthy();
    expect(result?.signals.capability_coverage_percent).toBeGreaterThanOrEqual(0);
    expect(result?.signals.verified_evidence_share).toBeGreaterThanOrEqual(0);
    expect(result?.signals.overall_hiring_signal).toBeDefined();

    const rootRecord = result as unknown as Record<string, unknown>;
    const candidateRecord = result?.candidate as unknown as Record<string, unknown>;
    expect(rootRecord.profile_id).toBeUndefined();
    expect(candidateRecord.email).toBeUndefined();
  });

  it("resolves legacy derived fallback slugs when share-link rows are missing", async () => {
    const fallbackSuffix = createHash("sha256").update("student-1").digest("hex").slice(0, 6);
    const legacyFallbackSlug = `vin-jones-${fallbackSuffix}`;
    const supabase = buildSupabaseMock({
      shareRows: [],
      profileRows: [
        {
          role: "student",
          personal_info: {
            full_name: "Vin Jones",
            email: "vin@example.com",
          },
        },
      ],
      studentRows: [
        {
          student_data: {
            target_roles: ["Software Engineer"],
            target_companies: ["Acme"],
          },
        },
      ],
      studentLookupRows: [
        {
          profile_id: "student-1",
          profiles: {
            role: "student",
            personal_info: {
              full_name: "Vin Jones",
              email: "vin@example.com",
            },
          },
        },
      ],
      artifactRows: [],
      capabilityModelRows: [],
      jobRoleRows: [],
    });
    getSupabaseServiceRoleClientMock.mockReturnValue(supabase);

    const result = await getPublicStudentShareProfileBySlug(legacyFallbackSlug);
    expect(result).not.toBeNull();
    expect(result?.share_path).toBe(`/u/${legacyFallbackSlug}`);
    expect(result?.candidate.full_name).toBe("Vin Jones");
  });

  it("builds education summary from student_data when personal_info education fields are missing", async () => {
    const supabase = buildSupabaseMock({
      shareRows: [{ profile_id: "student-1", share_slug: "vin-jones" }],
      profileRows: [
        {
          role: "student",
          personal_info: {
            full_name: "Vin Jones",
          },
        },
      ],
      studentRows: [
        {
          student_data: {
            university: "BYU",
            major_track: "Information Systems",
            graduation_year: "2027",
            target_roles: ["Software Engineer"],
            target_companies: ["Acme"],
          },
        },
      ],
      studentLookupRows: [
        {
          profile_id: "student-1",
          profiles: {
            role: "student",
            personal_info: {
              full_name: "Vin Jones",
            },
          },
        },
      ],
      artifactRows: [],
      capabilityModelRows: [],
      jobRoleRows: [],
    });
    getSupabaseServiceRoleClientMock.mockReturnValue(supabase);

    const result = await getPublicStudentShareProfileBySlug("vin-jones");
    expect(result?.candidate.education_summary).toBe("Information Systems, Cohort of 2027, BYU");
  });
});
