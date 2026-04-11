"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type StudentMagicLinkLoginScreenProps = {
  claimToken?: string | null;
  googleOAuthEnabled?: boolean;
  initialError?: string | null;
};

const buildGoogleAuthPath = (claimToken: string | null) => {
  const path = new URLSearchParams();
  if (claimToken && claimToken.trim().length > 0) {
    path.set("claim_token", claimToken.trim());
  }
  const query = path.toString();
  return query.length > 0 ? `/api/auth/login/student/google?${query}` : "/api/auth/login/student/google";
};

export function StudentMagicLinkLoginScreen({
  claimToken = null,
  googleOAuthEnabled = false,
  initialError = null,
}: StudentMagicLinkLoginScreenProps) {
  const description = googleOAuthEnabled
    ? "Continue with Google or we'll email you a sign-in link."
    : "We'll email you a sign-in link.";

  return (
    <MagicLinkLoginScreen
      submitPath="/api/auth/login/student"
      eyebrow="Student sign-in"
      heading="Sign in"
      description={description}
      emailLabel="Email"
      emailPlaceholder="name@example.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      additionalPayload={claimToken ? { claim_token: claimToken } : {}}
      googleOAuthPath={googleOAuthEnabled ? buildGoogleAuthPath(claimToken) : null}
      initialError={initialError}
    />
  );
}
