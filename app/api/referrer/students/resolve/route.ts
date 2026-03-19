import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { resolveShareSlugFromProfileInput } from "@/lib/referrals/profile-url";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentShareCardRow = {
  profile_id: string;
  share_slug: string;
  full_name: string;
  avatar_url: string | null;
};

type EndorsementRow = {
  endorsement_text: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["referrer"])) return forbidden();

  const payload = (await req.json().catch(() => null)) as { profile_url?: unknown } | null;
  const profileUrl = typeof payload?.profile_url === "string" ? payload.profile_url : "";
  const shareSlug = resolveShareSlugFromProfileInput(profileUrl);
  if (!shareSlug) return badRequest("invalid_profile_url");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return forbidden("supabase_not_configured");

  const { data: cardRows, error: cardError } = (await supabase.rpc("resolve_student_share_profile", {
    input_slug: shareSlug
  })) as { data: StudentShareCardRow[] | null; error: unknown };

  if (cardError) return badRequest("student_lookup_failed");
  const card = cardRows?.[0];
  if (!card) return badRequest("student_not_found");

  const { data: endorsementRows } = (await supabase
    .from("endorsements")
    .select("endorsement_text, updated_at, created_at")
    .eq("student_profile_id", card.profile_id)
    .eq("referrer_profile_id", context.user_id)
    .limit(1)) as { data: EndorsementRow[] | null };

  const existingEndorsement = endorsementRows?.[0] ?? null;

  return ok({
    resource: "referrer_student_lookup",
    student: {
      profile_id: card.profile_id,
      share_slug: card.share_slug,
      share_path: `/profile/${card.share_slug}`,
      full_name: card.full_name,
      avatar_url: card.avatar_url
    },
    existing_endorsement: existingEndorsement
      ? {
          endorsement_text: existingEndorsement.endorsement_text ?? "",
          updated_at: existingEndorsement.updated_at ?? existingEndorsement.created_at
        }
      : null
  });
}
