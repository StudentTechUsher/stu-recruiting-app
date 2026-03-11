import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { isSessionCheckEnabled } from "@/lib/session-flags";

export default async function RootPage() {
  if (!isSessionCheckEnabled()) {
    redirect("/login");
  }

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

  redirect("/login");
}
