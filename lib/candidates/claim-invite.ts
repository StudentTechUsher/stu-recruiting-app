import {
  claimCandidateByEmail,
  claimCandidateProfile,
  normalizeCandidateEmail,
  type CandidateIdentityStore,
} from "@/lib/candidates/identity";
import { hashClaimInviteToken, verifyClaimInviteToken } from "@/lib/auth/claim-invite-token";

type JsonRecord = Record<string, unknown>;

type ClaimInviteRedemptionRow = {
  redemption_id: string;
  jti: string;
  token_hash: string;
  candidate_id: string | null;
  candidate_email: string | null;
  redeemed_by_profile_id: string | null;
  claimed_candidate_id: string | null;
  status: "succeeded" | "rejected_conflict" | "rejected_invalid";
  reason: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimInviteSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
    upsert: (payload: JsonRecord, options?: { onConflict?: string }) => Promise<{ error: unknown }>;
  };
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

const parseRedemption = (value: unknown): ClaimInviteRedemptionRow | null => {
  const row = toRecord(value);
  const redemptionId = toTrimmedString(row.redemption_id);
  const jti = toTrimmedString(row.jti);
  const tokenHash = toTrimmedString(row.token_hash);
  const status = toTrimmedString(row.status);
  const createdAt = toTrimmedString(row.created_at);
  const updatedAt = toTrimmedString(row.updated_at);
  if (!redemptionId || !jti || !tokenHash || !status || !createdAt || !updatedAt) return null;
  if (status !== "succeeded" && status !== "rejected_conflict" && status !== "rejected_invalid") return null;

  return {
    redemption_id: redemptionId,
    jti,
    token_hash: tokenHash,
    candidate_id: toTrimmedString(row.candidate_id),
    candidate_email: toTrimmedString(row.candidate_email),
    redeemed_by_profile_id: toTrimmedString(row.redeemed_by_profile_id),
    claimed_candidate_id: toTrimmedString(row.claimed_candidate_id),
    status,
    reason: toTrimmedString(row.reason),
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const upsertRedemption = async ({
  supabase,
  jti,
  tokenHash,
  candidateId,
  candidateEmail,
  redeemedByProfileId,
  claimedCandidateId,
  status,
  reason,
}: {
  supabase: ClaimInviteSupabaseClient;
  jti: string;
  tokenHash: string;
  candidateId?: string | null;
  candidateEmail?: string | null;
  redeemedByProfileId?: string | null;
  claimedCandidateId?: string | null;
  status: "succeeded" | "rejected_conflict" | "rejected_invalid";
  reason?: string | null;
}) => {
  await supabase.from("claim_invite_redemptions").upsert(
    {
      jti,
      token_hash: tokenHash,
      candidate_id: candidateId ?? null,
      candidate_email: candidateEmail ?? null,
      redeemed_by_profile_id: redeemedByProfileId ?? null,
      claimed_candidate_id: claimedCandidateId ?? null,
      status,
      reason: reason ?? null,
    },
    { onConflict: "jti" }
  );
};

export type ClaimInviteResult =
  | {
      ok: true;
      status: "claimed" | "idempotent";
      candidate_id: string;
      canonical_profile_id: string | null;
      claimed: boolean;
      claimed_at: string | null;
    }
  | {
      ok: false;
      error:
        | "invalid_token"
        | "token_expired"
        | "invite_secret_missing"
        | "claim_conflict"
        | "candidate_not_found";
    };

export async function redeemClaimInviteToken({
  token,
  canonicalProfileId,
  store,
  supabase,
}: {
  token: string;
  canonicalProfileId: string;
  store: CandidateIdentityStore;
  supabase: unknown;
}): Promise<ClaimInviteResult> {
  const verification = verifyClaimInviteToken({ token });
  if (!verification.ok) {
    return {
      ok: false,
      error: verification.error,
    };
  }

  const client = supabase as ClaimInviteSupabaseClient;
  const tokenHash = hashClaimInviteToken(token);
  const jti = verification.payload.jti;

  const existingQuery = await client
    .from("claim_invite_redemptions")
    .select("redemption_id, jti, token_hash, candidate_id, candidate_email, redeemed_by_profile_id, claimed_candidate_id, status, reason, created_at, updated_at")
    .eq("jti", jti)
    .limit(1);
  const existing = parseRedemption(existingQuery.data?.[0] ?? null);

  if (existing) {
    if (existing.status === "succeeded" && existing.redeemed_by_profile_id === canonicalProfileId) {
      const existingCandidateId = existing.claimed_candidate_id ?? existing.candidate_id;
      if (!existingCandidateId) return { ok: false, error: "candidate_not_found" };
      const existingCandidate = await store.findCandidateById(existingCandidateId);
      if (!existingCandidate) return { ok: false, error: "candidate_not_found" };

      return {
        ok: true,
        status: "idempotent",
        candidate_id: existingCandidate.candidate_id,
        canonical_profile_id: existingCandidate.canonical_profile_id,
        claimed: existingCandidate.claimed,
        claimed_at: existingCandidate.claimed_at,
      };
    }
    return { ok: false, error: "claim_conflict" };
  }

  const tokenCandidateId = toTrimmedString(verification.payload.candidate_id);
  const tokenEmail = normalizeCandidateEmail(verification.payload.email ?? null);
  const lookupCandidate =
    tokenCandidateId !== null
      ? await store.findCandidateById(tokenCandidateId)
      : tokenEmail
        ? await store.findCandidateByNormalizedEmail(tokenEmail)
        : null;

  if (lookupCandidate?.claimed && lookupCandidate.canonical_profile_id && lookupCandidate.canonical_profile_id !== canonicalProfileId) {
    await upsertRedemption({
      supabase: client,
      jti,
      tokenHash,
      candidateId: lookupCandidate.candidate_id,
      candidateEmail: lookupCandidate.normalized_email,
      redeemedByProfileId: canonicalProfileId,
      claimedCandidateId: lookupCandidate.candidate_id,
      status: "rejected_conflict",
      reason: "candidate_already_claimed_by_another_profile",
    });
    return { ok: false, error: "claim_conflict" };
  }

  if (lookupCandidate?.claimed && lookupCandidate.canonical_profile_id === canonicalProfileId) {
    await upsertRedemption({
      supabase: client,
      jti,
      tokenHash,
      candidateId: lookupCandidate.candidate_id,
      candidateEmail: lookupCandidate.normalized_email,
      redeemedByProfileId: canonicalProfileId,
      claimedCandidateId: lookupCandidate.candidate_id,
      status: "succeeded",
      reason: "idempotent_existing_claim",
    });
    return {
      ok: true,
      status: "idempotent",
      candidate_id: lookupCandidate.candidate_id,
      canonical_profile_id: lookupCandidate.canonical_profile_id,
      claimed: lookupCandidate.claimed,
      claimed_at: lookupCandidate.claimed_at,
    };
  }

  const claimed = tokenCandidateId
    ? await claimCandidateProfile({
        store,
        candidateId: tokenCandidateId,
        canonicalProfileId,
      })
    : tokenEmail
      ? await claimCandidateByEmail({
          store,
          email: tokenEmail,
          canonicalProfileId,
        })
      : null;

  if (!claimed) {
    await upsertRedemption({
      supabase: client,
      jti,
      tokenHash,
      candidateEmail: tokenEmail ?? null,
      redeemedByProfileId: canonicalProfileId,
      status: "rejected_invalid",
      reason: "candidate_resolution_failed",
    });
    return { ok: false, error: "candidate_not_found" };
  }

  await upsertRedemption({
    supabase: client,
    jti,
    tokenHash,
    candidateId: claimed.candidate.candidate_id,
    candidateEmail: claimed.candidate.normalized_email,
    redeemedByProfileId: canonicalProfileId,
    claimedCandidateId: claimed.candidate.candidate_id,
    status: "succeeded",
    reason: "claim_completed",
  });

  return {
    ok: true,
    status: "claimed",
    candidate_id: claimed.candidate.candidate_id,
    canonical_profile_id: claimed.candidate.canonical_profile_id,
    claimed: claimed.candidate.claimed,
    claimed_at: claimed.candidate.claimed_at,
  };
}

