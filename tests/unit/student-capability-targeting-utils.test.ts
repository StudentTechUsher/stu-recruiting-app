import { describe, expect, it } from "vitest";
import {
  buildEvidenceFreshnessMarker,
  buildLegacyMigrationSelections,
  computeCapabilityProfileFit,
  deriveLegacyTargetsFromActive,
  normalizeCapabilityProfileRequestKey,
  parseActiveCapabilityProfiles,
  parseCapabilityProfileSelectionHistory,
} from "@/lib/student/capability-targeting";

describe("student capability targeting utils", () => {
  it("parses active selections with canonical max length and source enum fallback", () => {
    const parsed = parseActiveCapabilityProfiles([
      {
        capability_profile_id: "profile-1",
        company_id: "company-1",
        company_label: "Adobe",
        role_id: "role-1",
        role_label: "Software Engineer",
        selected_at: "2026-04-01T00:00:00.000Z",
        selection_source: "manual",
      },
      {
        capability_profile_id: "profile-2",
        company_id: "company-2",
        company_label: "Domo",
        role_id: "role-2",
        role_label: "Data Analyst",
        selected_at: "2026-04-01T00:01:00.000Z",
        selection_source: "unknown_source",
      },
      {
        capability_profile_id: "profile-3",
        company_id: "company-3",
        company_label: "Qualtrics",
        role_id: "role-3",
        role_label: "Product Analyst",
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.capability_profile_id).toBe("profile-1");
    expect(parsed[1]?.selection_source).toBe("manual");
    expect(parsed[0]?.status).toBe("active");
  });

  it("parses archived history with archive reason enum", () => {
    const parsed = parseCapabilityProfileSelectionHistory([
      {
        capability_profile_id: "profile-1",
        company_id: "company-1",
        role_id: "role-1",
        selected_at: "2026-04-01T00:00:00.000Z",
        selection_source: "manual",
        archived_at: "2026-04-01T01:00:00.000Z",
        archive_reason: "replaced",
      },
      {
        capability_profile_id: "profile-2",
        company_id: "company-2",
        role_id: "role-2",
        selected_at: "2026-04-01T00:00:00.000Z",
        selection_source: "manual",
        archived_at: "2026-04-01T01:00:00.000Z",
        archive_reason: "invalid_reason",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.archive_reason).toBe("replaced");
    expect(parsed[0]?.status).toBe("archived");
  });

  it("derives legacy roles and companies from active targets", () => {
    const derived = deriveLegacyTargetsFromActive([
      {
        capability_profile_id: "profile-1",
        company_id: "company-1",
        company_label: "Adobe",
        role_id: "role-1",
        role_label: "Software Engineer",
        selected_at: "2026-04-01T00:00:00.000Z",
        selection_source: "manual",
        status: "active",
      },
      {
        capability_profile_id: "profile-2",
        company_id: "company-2",
        company_label: "Adobe",
        role_id: "role-2",
        role_label: "Data Analyst",
        selected_at: "2026-04-01T00:00:00.000Z",
        selection_source: "manual",
        status: "active",
      },
    ]);

    expect(derived.target_companies).toEqual(["Adobe"]);
    expect(derived.target_roles).toEqual(["Software Engineer", "Data Analyst"]);
  });

  it("normalizes request keys with id-first and label fallback", () => {
    const byId = normalizeCapabilityProfileRequestKey({
      companyId: "company-1",
      roleId: "role-1",
      companyLabel: " Adobe ",
      roleLabel: " Software Engineer ",
    });
    const byLabel = normalizeCapabilityProfileRequestKey({
      companyLabel: "  Adobe   Inc ",
      roleLabel: " Software   Engineer ",
    });

    expect(byId).toBe("ids:company-1::role-1");
    expect(byLabel).toBe("labels:adobe inc::software engineer");
  });

  it("creates migration selections from legacy roles and companies", () => {
    const migrated = buildLegacyMigrationSelections({
      targetRoles: ["Software Engineer", "Data Analyst"],
      targetCompanies: ["Adobe", "Domo"],
      profiles: [
        {
          capability_profile_id: "profile-1",
          company_id: "company-1",
          company_label: "Adobe",
          role_id: "role-1",
          role_label: "Software Engineer",
          capability_ids: ["technical_depth"],
          target_weights: {},
          updated_at: "2026-04-01T00:00:00.000Z",
        },
        {
          capability_profile_id: "profile-2",
          company_id: "company-2",
          company_label: "Domo",
          role_id: "role-2",
          role_label: "Data Analyst",
          capability_ids: ["data_management"],
          target_weights: {},
          updated_at: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    expect(migrated).toHaveLength(2);
    expect(migrated[0]?.selection_source).toBe("migrated_legacy");
  });

  it("computes evidence-vs-target fit with strong and tentative evidence states", () => {
    const fit = computeCapabilityProfileFit({
      profile: {
        capability_profile_id: "profile-1",
        company_id: "company-1",
        company_label: "Adobe",
        role_id: "role-1",
        role_label: "Software Engineer",
        capability_ids: ["technical_depth", "systems_thinking"],
        target_weights: { technical_depth: 0.8, systems_thinking: 0.4 },
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      artifacts: [
        {
          artifact_id: "artifact-1",
          artifact_type: "project",
          artifact_data: { verification_status: "verified" },
          updated_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      evidenceFreshnessMarker: buildEvidenceFreshnessMarker([
        {
          artifact_id: "artifact-1",
          artifact_type: "project",
          artifact_data: { verification_status: "verified" },
          updated_at: "2026-04-01T00:00:00.000Z",
        },
      ]),
    });

    expect(fit.axes).toHaveLength(2);
    expect(fit.axes.find((axis) => axis.capability_id === "technical_depth")?.evidence_state).toBe("strong");
    expect(fit.axes.find((axis) => axis.capability_id === "systems_thinking")?.target_magnitude).toBeGreaterThan(0);
  });
});
