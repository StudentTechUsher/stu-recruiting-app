import { redirect } from "next/navigation";
import { StudentMagicLinkLoginScreen } from "@/components/auth/StudentMagicLinkLoginScreen";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { buildMagicLinkCallbackRedirectPath } from "@/lib/auth/magic-link-forward";
import { resolveAuthLoginErrorMessage } from "@/lib/auth/login-error";
import { isSessionCheckEnabled, isStudentGoogleOAuthEnabled } from "@/lib/session-flags";

export default async function StudentLoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialError = resolveAuthLoginErrorMessage(resolvedSearchParams, {
    intendedPersona: "student"
  });
  const callbackRedirectPath = buildMagicLinkCallbackRedirectPath(resolvedSearchParams);
  if (callbackRedirectPath) {
    redirect(callbackRedirectPath);
  }
  const claimTokenParam = resolvedSearchParams.claim_token;
  const claimToken = typeof claimTokenParam === "string" && claimTokenParam.trim().length > 0 ? claimTokenParam.trim() : null;

  const sessionCheckEnabled = isSessionCheckEnabled();
  const studentGoogleOAuthEnabled = isStudentGoogleOAuthEnabled();

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

  return (
    <StudentMagicLinkLoginScreen
      claimToken={claimToken}
      googleOAuthEnabled={sessionCheckEnabled && studentGoogleOAuthEnabled}
      initialError={initialError}
    />
  );
}
