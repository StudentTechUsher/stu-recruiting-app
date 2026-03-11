import { redirect } from "next/navigation";
import { LoginChooserScreen } from "@/components/auth/LoginChooserScreen";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { isSessionCheckEnabled } from "@/lib/session-flags";

export default async function LoginPage() {
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

  return <LoginChooserScreen sessionCheckEnabled={sessionCheckEnabled} />;
}
