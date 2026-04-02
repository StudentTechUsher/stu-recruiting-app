import { describe, expect, it } from "vitest";
import { buildAiLiteracyRoleLens, deriveAiLiteracyMap } from "@/lib/ai-literacy/map";

describe("ai literacy map derivation", () => {
  it("keeps recruiter-safe coverage less than or equal to profile coverage", () => {
    const derived = deriveAiLiteracyMap({
      selectedRoles: ["Software Engineer"],
      artifacts: [
        {
          artifact_id: "artifact-1",
          artifact_type: "project",
          artifact_data: {
            title: "AI Refactor Toolkit",
            description: "Used Copilot to refactor and validate core workflows.",
            source: "GitHub",
            verification_status: "verified",
          },
          updated_at: "2026-04-02T12:00:00.000Z",
        },
        {
          artifact_id: "artifact-2",
          artifact_type: "project",
          artifact_data: {
            title: "Prompt Evaluation Notes",
            description: "Prompt and evaluation iteration for production bug triage.",
            source: "GitHub",
            verification_status: "pending",
          },
          updated_at: "2026-04-02T12:01:00.000Z",
        },
      ],
    });

    expect(derived.recruiter_safe_coverage_percent).toBeLessThanOrEqual(derived.profile_coverage_percent);
  });

  it("derives role-relevant denominator from universal + core/expected role extensions", () => {
    const softwareLens = buildAiLiteracyRoleLens(["Software Engineer"]);
    const productLens = buildAiLiteracyRoleLens(["Product Manager"]);

    const softwareRelevant = Object.entries(softwareLens.domain_relevance)
      .filter(([, relevance]) => relevance === "core" || relevance === "expected")
      .length;
    const productRelevant = Object.entries(productLens.domain_relevance)
      .filter(([, relevance]) => relevance === "core" || relevance === "expected")
      .length;

    expect(softwareRelevant).toBeGreaterThanOrEqual(productRelevant);
  });

  it("requires mapped evidence spanning at least two role-relevant domains for partial availability", () => {
    const singleDomain = deriveAiLiteracyMap({
      selectedRoles: ["Software Engineer"],
      artifacts: [
        {
          artifact_id: "artifact-1",
          artifact_type: "project",
          artifact_data: {
            title: "Single Domain Project",
            description: "Notes from one project context.",
            source: "Resume",
            verification_status: "unverified",
          },
          updated_at: "2026-04-02T13:00:00.000Z",
        },
        {
          artifact_id: "artifact-2",
          artifact_type: "project",
          artifact_data: {
            title: "Same Domain Follow-up",
            description: "More notes from the same project context.",
            source: "Resume",
            verification_status: "unverified",
          },
          updated_at: "2026-04-02T13:10:00.000Z",
        },
      ],
    });

    const multiDomain = deriveAiLiteracyMap({
      selectedRoles: ["Software Engineer"],
      artifacts: [
        {
          artifact_id: "artifact-a",
          artifact_type: "project",
          artifact_data: {
            title: "Coding Workflow",
            description: "AI-assisted refactor and tests.",
            source: "GitHub",
            verification_status: "verified",
          },
          updated_at: "2026-04-02T13:20:00.000Z",
        },
        {
          artifact_id: "artifact-b",
          artifact_type: "certification",
          artifact_data: {
            title: "Responsible AI Certification",
            description: "Governance and risk controls for AI use.",
            source: "Credential",
            verification_status: "verified",
          },
          updated_at: "2026-04-02T13:30:00.000Z",
        },
      ],
    });

    expect(singleDomain.status).toBe("not_started");
    expect(multiDomain.status === "partial_available" || multiDomain.status === "available").toBe(true);
  });
});
