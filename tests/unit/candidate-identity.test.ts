import { describe, expect, it } from "vitest";
import type {
  CandidateApplicationLinkInput,
  CandidateIdentityStore,
  CandidateProfileRecord,
  CandidateProfileVariantRecord,
} from "@/lib/candidates/identity";
import {
  claimCandidateByEmail,
  linkCandidateApplication,
  normalizeCandidateEmail,
  resolveCandidateForIngestion,
  selectCanonicalArtifactVersion,
} from "@/lib/candidates/identity";

const createInMemoryStore = (): CandidateIdentityStore & {
  candidates: CandidateProfileRecord[];
  variants: CandidateProfileVariantRecord[];
  links: CandidateApplicationLinkInput[];
} => {
  const candidates: CandidateProfileRecord[] = [];
  const variants: CandidateProfileVariantRecord[] = [];
  const links: CandidateApplicationLinkInput[] = [];

  return {
    candidates,
    variants,
    links,
    async findCandidateByNormalizedEmail(normalizedEmail) {
      return candidates.find((candidate) => candidate.normalized_email === normalizedEmail) ?? null;
    },
    async createCandidateProfile(input) {
      const row: CandidateProfileRecord = {
        candidate_id: `cand-${candidates.length + 1}`,
        normalized_email: input.normalizedEmail,
        claimed: Boolean(input.claimed),
        claimed_at: input.claimed ? new Date().toISOString() : null,
        canonical_profile_id: input.canonicalProfileId ?? null,
        profile_data: input.profileData ?? {},
      };
      candidates.push(row);
      return row;
    },
    async updateCandidateClaim(input) {
      const candidate = candidates.find((row) => row.candidate_id === input.candidateId);
      if (!candidate) return null;
      candidate.claimed = true;
      candidate.claimed_at = input.claimedAt;
      candidate.canonical_profile_id = input.canonicalProfileId;
      return candidate;
    },
    async findActiveVariant(input) {
      return (
        variants.find(
          (variant) =>
            variant.candidate_id === input.candidateId &&
            variant.ownership === input.ownership &&
            variant.state === "active" &&
            (input.ownership === "candidate" ? variant.employer_id === null : variant.employer_id === input.employerId)
        ) ?? null
      );
    },
    async createVariant(input) {
      const row: CandidateProfileVariantRecord = {
        variant_id: `var-${variants.length + 1}`,
        candidate_id: input.candidateId,
        employer_id: input.ownership === "employer" ? input.employerId ?? null : null,
        ownership: input.ownership,
        state: "active",
        source_profile_id: input.sourceProfileId ?? null,
        variant_data: input.variantData ?? {},
      };
      variants.push(row);
      return row;
    },
    async markEmployerVariantsMerged(candidateId) {
      for (const variant of variants) {
        if (variant.candidate_id === candidateId && variant.ownership === "employer" && variant.state === "active") {
          variant.state = "merged";
        }
      }
    },
    async upsertApplicationLink(input) {
      const existing = links.find(
        (row) => row.application_id === input.application_id && row.employer_id === input.employer_id
      );
      if (existing) {
        Object.assign(existing, input);
        return;
      }
      links.push({ ...input });
    },
  };
};

describe("candidate identity service", () => {
  it("normalizes candidate emails", () => {
    expect(normalizeCandidateEmail("  Student@School.edu ")).toBe("student@school.edu");
    expect(normalizeCandidateEmail("")).toBeNull();
  });

  it("creates unclaimed candidate + employer variant on first ingestion", async () => {
    const store = createInMemoryStore();
    const result = await resolveCandidateForIngestion({
      store,
      email: "student@school.edu",
      employerId: "org-1",
      sourceProfileId: "profile-1",
    });

    expect(result.scope).toBe("employer");
    expect(result.createdCandidate).toBe(true);
    expect(result.createdVariant).toBe(true);
    expect(store.candidates).toHaveLength(1);
    expect(store.variants).toHaveLength(1);
    expect(store.variants[0].employer_id).toBe("org-1");
  });

  it("reuses same-employer variant for unclaimed candidate", async () => {
    const store = createInMemoryStore();
    const candidate = await store.createCandidateProfile({
      normalizedEmail: "student@school.edu",
      claimed: false,
    });
    await store.createVariant({
      candidateId: candidate.candidate_id,
      employerId: "org-1",
      ownership: "employer",
    });

    const result = await resolveCandidateForIngestion({
      store,
      email: "student@school.edu",
      employerId: "org-1",
    });

    expect(result.scope).toBe("employer");
    expect(result.createdCandidate).toBe(false);
    expect(result.createdVariant).toBe(false);
    expect(store.variants).toHaveLength(1);
  });

  it("routes claimed candidate ingestion to canonical scope", async () => {
    const store = createInMemoryStore();
    await store.createCandidateProfile({
      normalizedEmail: "student@school.edu",
      claimed: true,
      canonicalProfileId: "profile-claimed",
    });

    const result = await resolveCandidateForIngestion({
      store,
      email: "student@school.edu",
      employerId: "org-2",
    });

    expect(result.scope).toBe("canonical");
    expect(result.variant.ownership).toBe("candidate");
    expect(result.variant.employer_id).toBeNull();
  });

  it("claims by email and merges employer variants while preserving canonical variant", async () => {
    const store = createInMemoryStore();
    const candidate = await store.createCandidateProfile({
      normalizedEmail: "student@school.edu",
      claimed: false,
    });
    await store.createVariant({
      candidateId: candidate.candidate_id,
      employerId: "org-a",
      ownership: "employer",
    });
    await store.createVariant({
      candidateId: candidate.candidate_id,
      employerId: "org-b",
      ownership: "employer",
    });

    const claimed = await claimCandidateByEmail({
      store,
      email: "student@school.edu",
      canonicalProfileId: "profile-canonical",
    });

    expect(claimed.candidate.claimed).toBe(true);
    expect(claimed.canonicalVariant.ownership).toBe("candidate");
    expect(store.variants.filter((row) => row.ownership === "employer" && row.state === "active")).toHaveLength(0);
    expect(store.variants.filter((row) => row.ownership === "candidate" && row.state === "active")).toHaveLength(1);
  });

  it("selects canonical artifact by verification, completeness, then recency", () => {
    const selected = selectCanonicalArtifactVersion([
      {
        artifact_id: "a",
        updated_at: "2026-03-01T00:00:00.000Z",
        artifact_data: { title: "A", verification_status: "pending" },
      },
      {
        artifact_id: "b",
        updated_at: "2026-03-01T00:00:00.000Z",
        artifact_data: {
          title: "B",
          verification_status: "verified",
        },
      },
    ]);

    expect(selected.canonical.artifact_id).toBe("b");

    const tieSelected = selectCanonicalArtifactVersion([
      {
        artifact_id: "c",
        updated_at: "2026-03-01T00:00:00.000Z",
        artifact_data: {
          title: "C",
          verification_status: "verified",
          description: "short",
        },
      },
      {
        artifact_id: "d",
        updated_at: "2026-03-02T00:00:00.000Z",
        artifact_data: {
          title: "D",
          verification_status: "verified",
          description: "long",
          source: "GitHub",
        },
      },
    ]);

    expect(tieSelected.canonical.artifact_id).toBe("d");
    expect(tieSelected.provenanceVersions).toHaveLength(1);
  });

  it("upserts candidate application linkage", async () => {
    const store = createInMemoryStore();
    await linkCandidateApplication({
      store,
      application: {
        application_id: "app-1",
        candidate_id: "cand-1",
        employer_id: "org-1",
        role_context: { job_title: "Data Analyst" },
        artifact_snapshot_ids: ["artifact-1"],
        source_provenance_refs: [{ source: "greenhouse" }],
      },
    });

    expect(store.links).toHaveLength(1);
    expect(store.links[0].application_id).toBe("app-1");
    expect(store.links[0].candidate_id).toBe("cand-1");
  });
});
