import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EndorsementRow = {
  endorsement_id: string;
  student_profile_id: string;
  student_share_slug: string;
  student_full_name: string;
  student_avatar_url: string | null;
  referrer_full_name: string;
  referrer_company: string | null;
  referrer_position: string | null;
  referrer_linkedin_url: string | null;
  endorsement_text: string;
  updated_at: string;
};

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return ok({ resource: "recruiter_endorsements", endorsements: [] });

  const { data } = (await supabase
    .from("endorsements")
    .select(
      "endorsement_id, student_profile_id, student_share_slug, student_full_name, student_avatar_url, referrer_full_name, referrer_company, referrer_position, referrer_linkedin_url, endorsement_text, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100)) as { data: EndorsementRow[] | null };

  return ok({
    resource: "recruiter_endorsements",
    endorsements: data ?? []
  });
}
