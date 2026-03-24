import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServiceRoleClientMock } = vi.hoisted(() => ({
  getSupabaseServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

import { createCapabilityModel } from "@/lib/recruiter/capability-models";

describe("recruiter capability model data layer", () => {
  const originalEnableDevIdentities = process.env.ENABLE_DEV_IDENTITIES;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_DEV_IDENTITIES = "false";
  });

  afterEach(() => {
    process.env.ENABLE_DEV_IDENTITIES = originalEnableDevIdentities;
  });

  it("stores create payload in capability_models.model_data JSON", async () => {
    const modelInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              capability_model_id: "model-1",
              company_id: "company-1",
              recruiter_id: "recruiter-1",
              model_data: {
                model_name: "Core SWE",
                description: "Baseline model",
                weights: { collaboration: 15 },
                thresholds: { ready_max: 80 },
                required_evidence: ["Portfolio"],
                notes: "Initial",
              },
              active_version_id: null,
              current_version: 1,
              is_active: false,
              created_at: "2026-03-20T00:00:00.000Z",
              updated_at: "2026-03-20T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const versionInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              capability_model_version_id: "version-1",
              capability_model_id: "model-1",
              version_number: 1,
              model_payload: {
                model_name: "Core SWE",
                description: "Baseline model",
                weights: { collaboration: 15 },
                thresholds: { ready_max: 80 },
                required_evidence: ["Portfolio"],
                notes: "Initial",
              },
              created_at: "2026-03-20T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    });

    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "capability_models") {
          return { insert: modelInsert };
        }
        if (table === "capability_model_versions") {
          return { insert: versionInsert };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    await createCapabilityModel({
      orgId: "11111111-1111-4111-8111-111111111119",
      userId: "profile-1",
      recruiterId: "recruiter-1",
      modelName: "Core SWE",
      description: "Baseline model",
      weights: { collaboration: 15 },
      thresholds: { ready_max: 80 },
      requiredEvidence: ["Portfolio"],
      notes: "Initial",
      publish: false,
    });

    expect(modelInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "11111111-1111-4111-8111-111111111119",
        recruiter_id: "recruiter-1",
        model_data: expect.objectContaining({
          model_name: "Core SWE",
          description: "Baseline model",
          weights: { collaboration: 15 },
          thresholds: { ready_max: 80 },
          required_evidence: ["Portfolio"],
          notes: "Initial",
        }),
      })
    );

    expect(versionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        capability_model_id: "model-1",
        version_number: 1,
        model_payload: expect.objectContaining({
          model_name: "Core SWE",
          weights: { collaboration: 15 },
          thresholds: { ready_max: 80 },
          required_evidence: ["Portfolio"],
        }),
      })
    );
  });

  it("creates model with synthetic version when capability_model_versions table is missing", async () => {
    const modelInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              capability_model_id: "model-no-versions-table",
              company_id: "11111111-1111-4111-8111-111111111119",
              recruiter_id: "recruiter-1",
              model_data: {
                model_name: "Core SWE",
                weights: { collaboration: 15 },
                thresholds: { ready_max: 80 },
                required_evidence: ["Portfolio"],
              },
              active_version_id: null,
              current_version: 1,
              is_active: false,
              created_at: "2026-03-20T00:00:00.000Z",
              updated_at: "2026-03-20T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const missingVersionsTableError = {
      code: "PGRST205",
      details: null,
      hint: "Perhaps you meant the table 'public.capability_models'",
      message: "Could not find the table 'public.capability_model_versions' in the schema cache",
    };

    const versionInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: missingVersionsTableError,
          }),
        }),
      }),
    });

    const modelDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const modelDelete = vi.fn().mockReturnValue({ eq: modelDeleteEq });

    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "capability_models") {
          return { insert: modelInsert, delete: modelDelete };
        }
        if (table === "capability_model_versions") {
          return { insert: versionInsert };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    const result = await createCapabilityModel({
      orgId: "11111111-1111-4111-8111-111111111119",
      userId: "profile-1",
      recruiterId: "recruiter-1",
      modelName: "Core SWE",
      weights: { collaboration: 15 },
      thresholds: { ready_max: 80 },
      requiredEvidence: ["Portfolio"],
      notes: null,
      publish: false,
    });

    expect(result.model.capability_model_id).toBe("model-no-versions-table");
    expect(result.version.capability_model_id).toBe("model-no-versions-table");
    expect(result.version.status).toBe("draft");
    expect(result.version.weights).toEqual({ collaboration: 15 });
    expect(modelDelete).not.toHaveBeenCalled();
  });
});
