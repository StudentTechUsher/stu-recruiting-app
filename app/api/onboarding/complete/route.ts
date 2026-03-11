import { forbidden, ok } from "@/lib/api-response";
import {
  extractTargetCompanyNames,
  extractTargetRoleNames,
  splitOnboardingPersistenceData
} from "@/lib/auth/onboarding-persistence";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context.authenticated) return forbidden();

  const payload = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const { profilePersonalInfo, studentData } = splitOnboardingPersistenceData({
    payload,
    existingProfilePersonalInfo: context.profile?.personal_info,
    sessionEmail: context.session_user?.email
  });

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: now,
        personal_info: profilePersonalInfo
      })
      .eq("id", context.user_id);

    if (context.persona === "student") {
      const companyNames = extractTargetCompanyNames(studentData);
      if (companyNames.length > 0) {
        await supabase.from("companies").upsert(
          companyNames.map((companyName) => ({
            company_name: companyName
          })),
          { onConflict: "company_name_normalized" }
        );
      }

      const roleNames = extractTargetRoleNames(studentData);
      if (roleNames.length > 0) {
        await supabase.from("job_roles").upsert(
          roleNames.map((roleName) => ({
            role_name: roleName
          })),
          { onConflict: "role_name_normalized" }
        );
      }

      await supabase.from("students").upsert(
        {
          profile_id: context.user_id,
          student_data: studentData
        },
        { onConflict: "profile_id" }
      );
    }
  }

  const redirectPath = resolvePostAuthRedirect({
    persona: context.persona,
    onboardingCompletedAt: now,
    studentViewReleaseFlags: defaultStudentViewReleaseFlags
  });

  return ok({ resource: "onboarding_complete", context, redirectPath, completedAt: now });
}
