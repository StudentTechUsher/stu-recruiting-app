"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type ReferrerMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
  initialError?: string | null;
};

export function ReferrerMagicLinkLoginScreen({ sessionCheckEnabled, initialError }: ReferrerMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      sessionCheckEnabled={sessionCheckEnabled}
      submitPath="/api/auth/login/referrer"
      eyebrow="Referrer sign-in"
      heading="Get magic link"
      description="Use your email to sign in and submit endorsements for student candidates."
      emailLabel="Email"
      emailPlaceholder="name@company.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      initialError={initialError}
    />
  );
}
