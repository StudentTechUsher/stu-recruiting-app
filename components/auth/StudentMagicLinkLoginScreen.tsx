"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type StudentMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
  claimToken?: string | null;
  googleOAuthEnabled?: boolean;
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
  sessionCheckEnabled,
  claimToken = null,
  googleOAuthEnabled = false,
}: StudentMagicLinkLoginScreenProps) {
  const description = googleOAuthEnabled
    ? "Continue with Google or use your email to receive a secure sign-in link."
    : "Use your email to receive a secure sign-in link.";

  return (
    <MagicLinkLoginScreen
      sessionCheckEnabled={sessionCheckEnabled}
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
    />
  );
}
