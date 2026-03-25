"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type StudentMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
  claimToken?: string | null;
};

export function StudentMagicLinkLoginScreen({ sessionCheckEnabled, claimToken = null }: StudentMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      sessionCheckEnabled={sessionCheckEnabled}
      submitPath="/api/auth/login/student"
      eyebrow="Student sign-in"
      heading="Get magic link"
      description="Use your email to receive a secure sign-in link."
      emailLabel="Email"
      emailPlaceholder="name@example.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      additionalPayload={claimToken ? { claim_token: claimToken } : {}}
    />
  );
}
