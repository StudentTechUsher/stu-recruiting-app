import { redirect } from "next/navigation";
import { LoginChooserScreen } from "@/components/auth/LoginChooserScreen";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { buildMagicLinkCallbackRedirectPath } from "@/lib/auth/magic-link-forward";
import { resolveAuthLoginErrorMessage } from "@/lib/auth/login-error";
import { isSessionCheckEnabled } from "@/lib/session-flags";
import { isDevIdentitiesEnabled } from "@/lib/dev-auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialError = resolveAuthLoginErrorMessage(resolvedSearchParams);
  const callbackRedirectPath = buildMagicLinkCallbackRedirectPath(resolvedSearchParams);
  if (callbackRedirectPath) {
    redirect(callbackRedirectPath);
  }

  const sessionCheckEnabled = isSessionCheckEnabled();
  const devIdentitiesEnabled = isDevIdentitiesEnabled();

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

  return <LoginChooserScreen devIdentitiesEnabled={devIdentitiesEnabled} initialError={initialError} />;
}
