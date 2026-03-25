type JsonRecord = Record<string, unknown>;

export type CandidateProfileRecord = {
  candidate_id: string;
  normalized_email: string;
  claimed: boolean;
  claimed_at: string | null;
  canonical_profile_id: string | null;
  profile_data: JsonRecord;
};

export type CandidateProfileVariantRecord = {
  variant_id: string;
  candidate_id: string;
  employer_id: string | null;
  ownership: "employer" | "candidate";
  state: "active" | "merged";
  source_profile_id: string | null;
  variant_data: JsonRecord;
  created_at?: string;
  updated_at?: string;
};

export type CandidateApplicationLinkInput = {
  application_id: string;
  candidate_id: string;
  employer_id: string;
  role_context?: JsonRecord;
  artifact_snapshot_ids?: string[];
  source_provenance_refs?: JsonRecord[];
};

export type ArtifactVersion = {
  artifact_id: string;
  updated_at: string | null;
  verification_status?: string | null;
  artifact_data: JsonRecord;
};

export type CandidateIdentityStore = {
  findCandidateByNormalizedEmail: (normalizedEmail: string) => Promise<CandidateProfileRecord | null>;
  findCandidateById: (candidateId: string) => Promise<CandidateProfileRecord | null>;
  createCandidateProfile: (input: {
    normalizedEmail: string;
    claimed?: boolean;
    canonicalProfileId?: string | null;
    profileData?: JsonRecord;
  }) => Promise<CandidateProfileRecord>;
  updateCandidateClaim: (input: {
    candidateId: string;
    canonicalProfileId: string;
    claimedAt: string;
  }) => Promise<CandidateProfileRecord | null>;
  findActiveVariant: (input: {
    candidateId: string;
    ownership: "employer" | "candidate";
    employerId?: string;
  }) => Promise<CandidateProfileVariantRecord | null>;
  createVariant: (input: {
    candidateId: string;
    employerId?: string | null;
    ownership: "employer" | "candidate";
    sourceProfileId?: string | null;
    variantData?: JsonRecord;
  }) => Promise<CandidateProfileVariantRecord>;
  markEmployerVariantsMerged: (candidateId: string) => Promise<void>;
  upsertApplicationLink: (input: CandidateApplicationLinkInput) => Promise<void>;
};

const toRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toIsoTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const verificationStateWeight: Record<string, number> = {
  verified: 3,
  pending: 2,
  unverified: 1,
};

export function normalizeCandidateEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getVerificationWeight(version: ArtifactVersion): number {
  const status =
    toTrimmedString(version.verification_status) ??
    toTrimmedString(toRecord(version.artifact_data).verification_status) ??
    "unverified";
  return verificationStateWeight[status.toLowerCase()] ?? verificationStateWeight.unverified;
}

function getCompletenessScore(version: ArtifactVersion): number {
  const data = toRecord(version.artifact_data);
  let score = 0;
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim().length > 0) {
      score += 1;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      score += 1;
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      score += 1;
      continue;
    }
    if (value && typeof value === "object" && Object.keys(value as JsonRecord).length > 0) {
      score += 1;
    }
  }
  return score;
}

export function selectCanonicalArtifactVersion(versions: ArtifactVersion[]): {
  canonical: ArtifactVersion;
  provenanceVersions: ArtifactVersion[];
} {
  if (versions.length === 0) {
    throw new Error("artifact_versions_required");
  }

  const sorted = versions
    .slice()
    .sort((first, second) => {
      const byVerification = getVerificationWeight(second) - getVerificationWeight(first);
      if (byVerification !== 0) return byVerification;

      const byCompleteness = getCompletenessScore(second) - getCompletenessScore(first);
      if (byCompleteness !== 0) return byCompleteness;

      return toIsoTimestamp(second.updated_at) - toIsoTimestamp(first.updated_at);
    });

  return {
    canonical: sorted[0],
    provenanceVersions: sorted.slice(1),
  };
}

export async function resolveCandidateForIngestion(input: {
  store: CandidateIdentityStore;
  email: string;
  employerId: string;
  sourceProfileId?: string | null;
}) {
  const normalizedEmail = normalizeCandidateEmail(input.email);
  if (!normalizedEmail) throw new Error("candidate_email_required");
  if (!toTrimmedString(input.employerId)) throw new Error("employer_id_required");

  let candidate = await input.store.findCandidateByNormalizedEmail(normalizedEmail);
  let createdCandidate = false;
  if (!candidate) {
    candidate = await input.store.createCandidateProfile({
      normalizedEmail,
      claimed: false,
      canonicalProfileId: null,
      profileData: {},
    });
    createdCandidate = true;
  }

  if (candidate.claimed) {
    let canonicalVariant = await input.store.findActiveVariant({
      candidateId: candidate.candidate_id,
      ownership: "candidate",
    });

    let createdVariant = false;
    if (!canonicalVariant) {
      canonicalVariant = await input.store.createVariant({
        candidateId: candidate.candidate_id,
        ownership: "candidate",
        sourceProfileId: candidate.canonical_profile_id,
      });
      createdVariant = true;
    }

    return {
      candidate,
      variant: canonicalVariant,
      scope: "canonical" as const,
      createdCandidate,
      createdVariant,
    };
  }

  let employerVariant = await input.store.findActiveVariant({
    candidateId: candidate.candidate_id,
    ownership: "employer",
    employerId: input.employerId,
  });

  let createdVariant = false;
  if (!employerVariant) {
    employerVariant = await input.store.createVariant({
      candidateId: candidate.candidate_id,
      employerId: input.employerId,
      ownership: "employer",
      sourceProfileId: input.sourceProfileId ?? null,
    });
    createdVariant = true;
  }

  return {
    candidate,
    variant: employerVariant,
    scope: "employer" as const,
    createdCandidate,
    createdVariant,
  };
}

export async function claimCandidateProfile(input: {
  store: CandidateIdentityStore;
  candidateId: string;
  canonicalProfileId: string;
  claimedAt?: string;
}) {
  const claimedAt = input.claimedAt ?? new Date().toISOString();

  const updated = await input.store.updateCandidateClaim({
    candidateId: input.candidateId,
    canonicalProfileId: input.canonicalProfileId,
    claimedAt,
  });

  if (!updated) throw new Error("candidate_not_found");

  await input.store.markEmployerVariantsMerged(input.candidateId);

  let canonicalVariant = await input.store.findActiveVariant({
    candidateId: input.candidateId,
    ownership: "candidate",
  });

  if (!canonicalVariant) {
    canonicalVariant = await input.store.createVariant({
      candidateId: input.candidateId,
      ownership: "candidate",
      sourceProfileId: input.canonicalProfileId,
    });
  }

  return {
    candidate: updated,
    canonicalVariant,
  };
}

export async function claimCandidateByEmail(input: {
  store: CandidateIdentityStore;
  email: string;
  canonicalProfileId: string;
  claimedAt?: string;
}) {
  const normalizedEmail = normalizeCandidateEmail(input.email);
  if (!normalizedEmail) throw new Error("candidate_email_required");

  let candidate = await input.store.findCandidateByNormalizedEmail(normalizedEmail);
  if (!candidate) {
    candidate = await input.store.createCandidateProfile({
      normalizedEmail,
      claimed: false,
      canonicalProfileId: null,
    });
  }

  return claimCandidateProfile({
    store: input.store,
    candidateId: candidate.candidate_id,
    canonicalProfileId: input.canonicalProfileId,
    claimedAt: input.claimedAt,
  });
}

export async function linkCandidateApplication(input: {
  store: CandidateIdentityStore;
  application: CandidateApplicationLinkInput;
}) {
  if (!toTrimmedString(input.application.application_id)) throw new Error("application_id_required");
  if (!toTrimmedString(input.application.candidate_id)) throw new Error("candidate_id_required");
  if (!toTrimmedString(input.application.employer_id)) throw new Error("employer_id_required");

  await input.store.upsertApplicationLink({
    application_id: input.application.application_id,
    candidate_id: input.application.candidate_id,
    employer_id: input.application.employer_id,
    role_context: input.application.role_context ?? {},
    artifact_snapshot_ids: input.application.artifact_snapshot_ids ?? [],
    source_provenance_refs: input.application.source_provenance_refs ?? [],
  });
}

export function createSupabaseCandidateIdentityStore(supabase: unknown): CandidateIdentityStore {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
            limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
          };
          limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
          maybeSingle: () => Promise<{ data: unknown | null; error: unknown }>;
          single: () => Promise<{ data: unknown | null; error: unknown }>;
        };
        limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
      insert: (payload: unknown) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown | null; error: unknown }>;
        };
      };
      update: (payload: unknown) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{ error: unknown }>;
          select?: (columns: string) => { single: () => Promise<{ data: unknown | null; error: unknown }> };
        };
      };
      upsert: (payload: unknown, options?: { onConflict?: string }) => Promise<{ error: unknown }>;
    };
  };

  const parseCandidate = (value: unknown): CandidateProfileRecord | null => {
    const row = toRecord(value);
    const candidateId = toTrimmedString(row.candidate_id);
    const normalizedEmail = normalizeCandidateEmail(toTrimmedString(row.normalized_email));
    if (!candidateId || !normalizedEmail) return null;

    return {
      candidate_id: candidateId,
      normalized_email: normalizedEmail,
      claimed: Boolean(row.claimed),
      claimed_at: toTrimmedString(row.claimed_at),
      canonical_profile_id: toTrimmedString(row.canonical_profile_id),
      profile_data: toRecord(row.profile_data),
    };
  };

  const parseVariant = (value: unknown): CandidateProfileVariantRecord | null => {
    const row = toRecord(value);
    const variantId = toTrimmedString(row.variant_id);
    const candidateId = toTrimmedString(row.candidate_id);
    const ownership = toTrimmedString(row.ownership);
    const state = toTrimmedString(row.state);
    if (!variantId || !candidateId) return null;
    if (ownership !== "employer" && ownership !== "candidate") return null;
    if (state !== "active" && state !== "merged") return null;

    return {
      variant_id: variantId,
      candidate_id: candidateId,
      employer_id: toTrimmedString(row.employer_id),
      ownership,
      state,
      source_profile_id: toTrimmedString(row.source_profile_id),
      variant_data: toRecord(row.variant_data),
      created_at: toTrimmedString(row.created_at) ?? undefined,
      updated_at: toTrimmedString(row.updated_at) ?? undefined,
    };
  };

  return {
    async findCandidateByNormalizedEmail(normalizedEmail: string) {
      const { data } = await (client
        .from("candidate_profiles")
        .select("candidate_id, normalized_email, claimed, claimed_at, canonical_profile_id, profile_data")
        .eq("normalized_email", normalizedEmail)
        .limit(1)) as { data: unknown[] | null };

      return parseCandidate(data?.[0] ?? null);
    },
    async findCandidateById(candidateId: string) {
      const { data } = await (client
        .from("candidate_profiles")
        .select("candidate_id, normalized_email, claimed, claimed_at, canonical_profile_id, profile_data")
        .eq("candidate_id", candidateId)
        .limit(1)) as { data: unknown[] | null };

      return parseCandidate(data?.[0] ?? null);
    },
    async createCandidateProfile(input) {
      const { data, error } = await client
        .from("candidate_profiles")
        .insert({
          normalized_email: input.normalizedEmail,
          claimed: Boolean(input.claimed),
          claimed_at: input.claimed ? new Date().toISOString() : null,
          canonical_profile_id: input.canonicalProfileId ?? null,
          profile_data: input.profileData ?? {},
        })
        .select("candidate_id, normalized_email, claimed, claimed_at, canonical_profile_id, profile_data")
        .single();

      if (error || !data) throw new Error("candidate_profile_create_failed");
      const parsed = parseCandidate(data);
      if (!parsed) throw new Error("candidate_profile_create_failed");
      return parsed;
    },
    async updateCandidateClaim(input) {
      const updateResult = await ((client
        .from("candidate_profiles")
        .update({
          claimed: true,
          claimed_at: input.claimedAt,
          canonical_profile_id: input.canonicalProfileId,
        })
        .eq("candidate_id", input.candidateId)) as unknown as Promise<{ error: unknown }>);

      if (updateResult.error) return null;

      const { data, error } = await (client
        .from("candidate_profiles")
        .select("candidate_id, normalized_email, claimed, claimed_at, canonical_profile_id, profile_data")
        .eq("candidate_id", input.candidateId)
        .maybeSingle()) as { data: unknown | null; error: unknown };

      if (error || !data) return null;
      return parseCandidate(data);
    },
    async findActiveVariant(input) {
      const { data } = await (client
        .from("candidate_profile_variants")
        .select("variant_id, candidate_id, employer_id, ownership, state, source_profile_id, variant_data, created_at, updated_at")
        .eq("candidate_id", input.candidateId)
        .eq("ownership", input.ownership)
        .eq("state", "active")
        .limit(10)) as { data: unknown[] | null };

      const parsed = (data ?? []).map(parseVariant).filter((row): row is CandidateProfileVariantRecord => Boolean(row));
      if (input.ownership === "candidate") {
        return parsed.find((row) => row.employer_id === null) ?? parsed[0] ?? null;
      }

      return parsed.find((row) => row.employer_id === input.employerId) ?? null;
    },
    async createVariant(input) {
      const { data, error } = await client
        .from("candidate_profile_variants")
        .insert({
          candidate_id: input.candidateId,
          employer_id: input.ownership === "employer" ? input.employerId ?? null : null,
          ownership: input.ownership,
          state: "active",
          source_profile_id: input.sourceProfileId ?? null,
          variant_data: input.variantData ?? {},
        })
        .select("variant_id, candidate_id, employer_id, ownership, state, source_profile_id, variant_data, created_at, updated_at")
        .single();

      if (error || !data) throw new Error("candidate_profile_variant_create_failed");
      const parsed = parseVariant(data);
      if (!parsed) throw new Error("candidate_profile_variant_create_failed");
      return parsed;
    },
    async markEmployerVariantsMerged(candidateId: string) {
      const { error } = await client
        .from("candidate_profile_variants")
        .update({ state: "merged" })
        .eq("candidate_id", candidateId)
        .eq("ownership", "employer");

      if (error) throw new Error("candidate_profile_variant_merge_failed");
    },
    async upsertApplicationLink(input: CandidateApplicationLinkInput) {
      const { error } = await client.from("candidate_application_links").upsert(
        {
          application_id: input.application_id,
          candidate_id: input.candidate_id,
          employer_id: input.employer_id,
          role_context: input.role_context ?? {},
          artifact_snapshot_ids: input.artifact_snapshot_ids ?? [],
          source_provenance_refs: input.source_provenance_refs ?? [],
        },
        { onConflict: "application_id,employer_id" }
      );

      if (error) throw new Error("candidate_application_link_upsert_failed");
    },
  };
}
