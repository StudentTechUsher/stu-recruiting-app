import { redirect } from "next/navigation";
import { StudentMagicLinkLoginScreen } from "@/components/auth/StudentMagicLinkLoginScreen";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { isSessionCheckEnabled } from "@/lib/session-flags";

export default async function StudentLoginPage() {
  const sessionCheckEnabled = isSessionCheckEnabled();

  if (sessionCheckEnabled) {
    const context = await getAuthContext();
    if (context.authenticated) {
      redirect(
        resolvePostAuthRedirect({
          persona: context.persona,
          onboardingCompletedAt: context.profile?.onboarding_completed_at ?? null,
          studentViewReleaseFlags: defaultStudentViewReleaseFlags
        })
      );
    }
  }

  return <StudentMagicLinkLoginScreen sessionCheckEnabled={sessionCheckEnabled} />;
}
