import { redirect } from "next/navigation";
import { ReferrerMagicLinkLoginScreen } from "@/components/auth/ReferrerMagicLinkLoginScreen";
import { getAuthContext } from "@/lib/auth-context";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { buildMagicLinkCallbackRedirectPath } from "@/lib/auth/magic-link-forward";
import { isSessionCheckEnabled } from "@/lib/session-flags";

const firstValue = (value: string | string[] | undefined) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return null;
};

const resolveReferrerLoginError = (errorCode: string | null) => {
  if (errorCode === "wrong_account_type") {
    return "This email is already assigned to a different account type. Referrer magic links only work for referrer profiles.";
  }

  return null;
};

export default async function ReferrerLoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialError = resolveReferrerLoginError(firstValue(resolvedSearchParams.error));
  const callbackRedirectPath = buildMagicLinkCallbackRedirectPath(resolvedSearchParams);
  if (callbackRedirectPath) {
    redirect(callbackRedirectPath);
  }

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

  return <ReferrerMagicLinkLoginScreen sessionCheckEnabled={sessionCheckEnabled} initialError={initialError} />;
}
