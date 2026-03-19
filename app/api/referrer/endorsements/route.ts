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

type ReferrerRow = {
  referrer_data: Record<string, unknown> | null;
};

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["referrer"])) return forbidden();

  const payload = (await req.json().catch(() => null)) as { profile_url?: unknown; endorsement?: unknown } | null;
  const profileUrl = typeof payload?.profile_url === "string" ? payload.profile_url : "";
  const endorsementText = asTrimmedString(payload?.endorsement);

  const shareSlug = resolveShareSlugFromProfileInput(profileUrl);
  if (!shareSlug) return badRequest("invalid_profile_url");
  if (endorsementText.length < 1) return badRequest("endorsement_required");
  if (endorsementText.length > 4000) return badRequest("endorsement_too_long");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return forbidden("supabase_not_configured");

  const { data: cardRows, error: cardError } = (await supabase.rpc("resolve_student_share_profile", {
    input_slug: shareSlug
  })) as { data: StudentShareCardRow[] | null; error: unknown };

  if (cardError) return badRequest("student_lookup_failed");
  const studentCard = cardRows?.[0];
  if (!studentCard) return badRequest("student_not_found");

  const { data: referrerRows } = (await supabase
    .from("referrers")
    .select("referrer_data")
    .eq("profile_id", context.user_id)
    .limit(1)) as { data: ReferrerRow[] | null };

  const referrerData = toRecord(referrerRows?.[0]?.referrer_data);
  const profilePersonalInfo = toRecord(context.profile?.personal_info);
  const referrerFullName =
    asTrimmedString(referrerData.full_name) ||
    asTrimmedString(profilePersonalInfo.full_name) ||
    [asTrimmedString(profilePersonalInfo.first_name), asTrimmedString(profilePersonalInfo.last_name)].filter(Boolean).join(" ") ||
    asTrimmedString(context.session_user?.email) ||
    "Referrer";
  const referrerCompany = asTrimmedString(referrerData.company) || null;
  const referrerPosition = asTrimmedString(referrerData.position) || null;
  const referrerLinkedinUrl = asTrimmedString(referrerData.linkedin_url) || null;

  const { error: upsertError } = await supabase.from("endorsements").upsert(
    {
      student_profile_id: studentCard.profile_id,
      referrer_profile_id: context.user_id,
      student_share_slug: studentCard.share_slug,
      student_full_name: studentCard.full_name,
      student_avatar_url: studentCard.avatar_url,
      referrer_full_name: referrerFullName,
      referrer_company: referrerCompany,
      referrer_position: referrerPosition,
      referrer_linkedin_url: referrerLinkedinUrl,
      endorsement_text: endorsementText
    },
    { onConflict: "referrer_profile_id,student_profile_id" }
  );

  if (upsertError) return badRequest("endorsement_save_failed");

  return ok({
    resource: "referrer_endorsement",
    status: "saved",
    student: {
      profile_id: studentCard.profile_id,
      share_slug: studentCard.share_slug,
      share_path: `/profile/${studentCard.share_slug}`,
      full_name: studentCard.full_name,
      avatar_url: studentCard.avatar_url
    },
    endorsement: {
      endorsement_text: endorsementText
    }
  });
}
