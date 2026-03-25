import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import {
  normalizeCandidateEmail,
  type CandidateIdentityStore,
  type CandidateProfileRecord,
  type CandidateProfileVariantRecord,
} from "@/lib/candidates/identity";
import { redeemClaimInviteToken } from "@/lib/candidates/claim-invite";

type ClaimInviteRow = {
  jti: string;
  token_hash: string;
  candidate_id: string | null;
  candidate_email: string | null;
  redeemed_by_profile_id: string | null;
  claimed_candidate_id: string | null;
  status: "succeeded" | "rejected_conflict" | "rejected_invalid";
  reason: string | null;
};

const base64url = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

const signToken = (payload: Record<string, unknown>, secret: string): string => {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

const createInMemoryStore = () => {
  const candidates: CandidateProfileRecord[] = [];
  const variants: CandidateProfileVariantRecord[] = [];

  const store: CandidateIdentityStore = {
    async findCandidateByNormalizedEmail(normalizedEmail) {
      return candidates.find((candidate) => candidate.normalized_email === normalizedEmail) ?? null;
    },
    async findCandidateById(candidateId) {
      return candidates.find((candidate) => candidate.candidate_id === candidateId) ?? null;
    },
    async createCandidateProfile(input) {
      const candidate: CandidateProfileRecord = {
        candidate_id: `cand-${candidates.length + 1}`,
        normalized_email: input.normalizedEmail,
        claimed: Boolean(input.claimed),
        claimed_at: input.claimed ? new Date().toISOString() : null,
        canonical_profile_id: input.canonicalProfileId ?? null,
        profile_data: input.profileData ?? {},
      };
      candidates.push(candidate);
      return candidate;
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
            variant.state === "active" &&
            variant.ownership === input.ownership &&
            (input.ownership === "candidate" ? variant.employer_id === null : variant.employer_id === input.employerId)
        ) ?? null
      );
    },
    async createVariant(input) {
      const variant: CandidateProfileVariantRecord = {
        variant_id: `variant-${variants.length + 1}`,
        candidate_id: input.candidateId,
        employer_id: input.ownership === "employer" ? input.employerId ?? null : null,
        ownership: input.ownership,
        state: "active",
        source_profile_id: input.sourceProfileId ?? null,
        variant_data: input.variantData ?? {},
      };
      variants.push(variant);
      return variant;
    },
    async markEmployerVariantsMerged(candidateId) {
      for (const variant of variants) {
        if (variant.candidate_id === candidateId && variant.ownership === "employer") {
          variant.state = "merged";
        }
      }
    },
    async upsertApplicationLink() {},
  };

  return { store, candidates };
};

const createRedemptionSupabase = () => {
  const rows: ClaimInviteRow[] = [];

  const client = {
    rows,
    from() {
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return {
                async limit() {
                  return {
                    data: rows.filter((row) => row.jti === value).map((row, index) => ({
                      redemption_id: `r-${index + 1}`,
                      ...row,
                      created_at: "2026-03-25T00:00:00.000Z",
                      updated_at: "2026-03-25T00:00:00.000Z",
                    })),
                    error: null,
                  };
                },
              };
            },
          };
        },
        async upsert(payload: Record<string, unknown>) {
          const jti = String(payload.jti ?? "");
          const next: ClaimInviteRow = {
            jti,
            token_hash: String(payload.token_hash ?? ""),
            candidate_id: typeof payload.candidate_id === "string" ? payload.candidate_id : null,
            candidate_email: typeof payload.candidate_email === "string" ? payload.candidate_email : null,
            redeemed_by_profile_id:
              typeof payload.redeemed_by_profile_id === "string" ? payload.redeemed_by_profile_id : null,
            claimed_candidate_id:
              typeof payload.claimed_candidate_id === "string" ? payload.claimed_candidate_id : null,
            status:
              payload.status === "succeeded" || payload.status === "rejected_conflict" || payload.status === "rejected_invalid"
                ? payload.status
                : "rejected_invalid",
            reason: typeof payload.reason === "string" ? payload.reason : null,
          };
          const existingIndex = rows.findIndex((row) => row.jti === jti);
          if (existingIndex >= 0) rows[existingIndex] = next;
          else rows.push(next);
          return { error: null };
        },
      };
    },
  };

  return client;
};

describe("claim invite redemption", () => {
  beforeEach(() => {
    process.env.STUDENT_CLAIM_INVITE_SECRET = "phase1-test-secret-123456789";
  });

  it("returns idempotent success when candidate is already claimed by the same canonical profile", async () => {
    const { store, candidates } = createInMemoryStore();
    const normalizedEmail = normalizeCandidateEmail("sam@school.edu") as string;
    candidates.push({
      candidate_id: "cand-1",
      normalized_email: normalizedEmail,
      claimed: true,
      claimed_at: "2026-03-25T00:00:00.000Z",
      canonical_profile_id: "profile-sam",
      profile_data: {},
    });

    const token = signToken(
      {
        aud: "student_claim_invite",
        jti: "invite-1",
        exp: Math.floor(Date.now() / 1000) + 60,
        candidate_id: "cand-1",
      },
      process.env.STUDENT_CLAIM_INVITE_SECRET as string
    );

    const supabase = createRedemptionSupabase();
    const result = await redeemClaimInviteToken({
      token,
      canonicalProfileId: "profile-sam",
      store,
      supabase,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("idempotent");
      expect(result.candidate_id).toBe("cand-1");
    }
  });

  it("rejects and audits when candidate is already claimed by a different canonical profile", async () => {
    const { store, candidates } = createInMemoryStore();
    const normalizedEmail = normalizeCandidateEmail("sam@school.edu") as string;
    candidates.push({
      candidate_id: "cand-1",
      normalized_email: normalizedEmail,
      claimed: true,
      claimed_at: "2026-03-25T00:00:00.000Z",
      canonical_profile_id: "profile-other",
      profile_data: {},
    });

    const token = signToken(
      {
        aud: "student_claim_invite",
        jti: "invite-2",
        exp: Math.floor(Date.now() / 1000) + 60,
        candidate_id: "cand-1",
      },
      process.env.STUDENT_CLAIM_INVITE_SECRET as string
    );

    const supabase = createRedemptionSupabase();
    const result = await redeemClaimInviteToken({
      token,
      canonicalProfileId: "profile-sam",
      store,
      supabase,
    });

    expect(result).toEqual({
      ok: false,
      error: "claim_conflict",
    });
    expect(supabase.rows).toHaveLength(1);
    expect(supabase.rows[0]?.status).toBe("rejected_conflict");
  });

  it("rejects invalid tokens without inserting redemption rows", async () => {
    const { store } = createInMemoryStore();
    const supabase = createRedemptionSupabase();
    const result = await redeemClaimInviteToken({
      token: "invalid-token",
      canonicalProfileId: "profile-sam",
      store,
      supabase,
    });

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: "invalid_token",
    });
    expect(supabase.rows).toHaveLength(0);
  });
});

