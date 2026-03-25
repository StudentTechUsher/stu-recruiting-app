import { describe, expect, it } from "vitest";
import { deriveCapabilitiesFromEvidence, resolveRoleCapabilityIds } from "@/lib/capabilities/derivation";

describe("capability derivation", () => {
  it("uses union of role capabilities (deduped)", () => {
    const roleCapabilities = resolveRoleCapabilityIds([
      "Data Scientist",
      "Software Engineer",
      "Data Scientist",
    ]);

    expect(new Set(roleCapabilities)).toEqual(new Set(roleCapabilities));
    expect(roleCapabilities).toContain("technical_depth");
    expect(roleCapabilities).toContain("systems_thinking");
  });

  it("derives coverage from evidence linkage and keeps verification as trust-only metadata", () => {
    const withUnverified = deriveCapabilitiesFromEvidence({
      selectedRoles: ["Data Scientist"],
      artifacts: [
        {
          artifact_id: "a-1",
          artifact_type: "project",
          artifact_data: { verification_status: "unverified" },
          updated_at: "2026-03-25T00:00:00.000Z",
        },
      ],
    });

    const withVerified = deriveCapabilitiesFromEvidence({
      selectedRoles: ["Data Scientist"],
      artifacts: [
        {
          artifact_id: "a-1",
          artifact_type: "project",
          artifact_data: { verification_status: "verified" },
          updated_at: "2026-03-25T00:00:00.000Z",
        },
      ],
    });

    const unverifiedTechnical = withUnverified.axes.find((axis) => axis.capability_id === "technical_depth");
    const verifiedTechnical = withVerified.axes.find((axis) => axis.capability_id === "technical_depth");

    expect(unverifiedTechnical?.covered).toBe(true);
    expect(verifiedTechnical?.covered).toBe(true);
    expect(unverifiedTechnical?.verification_breakdown.unverified).toBeGreaterThan(0);
    expect(verifiedTechnical?.verification_breakdown.verified).toBeGreaterThan(0);
  });

  it("provides traceable supporting evidence IDs for covered axes", () => {
    const derived = deriveCapabilitiesFromEvidence({
      selectedRoles: ["Software Engineer"],
      artifacts: [
        {
          artifact_id: "a-1",
          artifact_type: "project",
          artifact_data: { verification_status: "pending" },
          updated_at: "2026-03-25T00:00:00.000Z",
        },
        {
          artifact_id: "a-2",
          artifact_type: "leadership",
          artifact_data: { verification_status: "verified" },
          updated_at: "2026-03-25T00:00:00.000Z",
        },
      ],
    });

    const coveredAxes = derived.axes.filter((axis) => axis.covered);
    expect(coveredAxes.length).toBeGreaterThan(0);
    for (const axis of coveredAxes) {
      expect(axis.supporting_evidence_ids.length).toBeGreaterThan(0);
    }
  });

  it("keeps no-role axis set to soft-skill baseline only", () => {
    const derived = deriveCapabilitiesFromEvidence({
      selectedRoles: [],
      artifacts: [
        {
          artifact_id: "a-1",
          artifact_type: "project",
          artifact_data: { verification_status: "verified" },
          updated_at: "2026-03-25T00:00:00.000Z",
        },
      ],
    });

    const capabilityIds = derived.axes.map((axis) => axis.capability_id);
    expect(new Set(capabilityIds)).toEqual(
      new Set(["communication", "collaboration", "execution_reliability"])
    );
    expect(capabilityIds).not.toContain("technical_depth");
    expect(capabilityIds).not.toContain("systems_thinking");
    expect(capabilityIds).not.toContain("data_management");
  });
});
