import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  claimCandidateByEmail,
  claimCandidateProfile,
  createSupabaseCandidateIdentityStore,
} from "@/lib/candidates/identity";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const badRequestErrors = new Set([
  "candidate_id_or_email_required",
  "candidate_email_required",
  "candidate_not_found",
  "supabase_not_configured",
]);

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const payloadRecord = toRecord(payload);
  const candidateId = toTrimmedString(payloadRecord.candidate_id);
  const email =
    toTrimmedString(payloadRecord.email) ??
    toTrimmedString(context.profile?.personal_info?.email) ??
    null;

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return badRequest("supabase_not_configured");
  const store = createSupabaseCandidateIdentityStore(supabase);

  try {
    const claimed = candidateId
      ? await claimCandidateProfile({
          store,
          candidateId,
          canonicalProfileId: context.user_id,
        })
      : email
        ? await claimCandidateByEmail({
            store,
            email,
            canonicalProfileId: context.user_id,
          })
        : null;

    if (!claimed) return badRequest("candidate_id_or_email_required");

    return ok({
      resource: "candidate_claim",
      candidate: {
        candidate_id: claimed.candidate.candidate_id,
        claimed: claimed.candidate.claimed,
        claimed_at: claimed.candidate.claimed_at,
        canonical_profile_id: claimed.candidate.canonical_profile_id,
      },
      canonical_variant: {
        variant_id: claimed.canonicalVariant.variant_id,
        ownership: claimed.canonicalVariant.ownership,
        state: claimed.canonicalVariant.state,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "candidate_claim_failed";
    if (badRequestErrors.has(message)) return badRequest(message);
    throw error;
  }
}
