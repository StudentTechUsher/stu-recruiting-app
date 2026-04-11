"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type ReferrerMagicLinkLoginScreenProps = {
  initialError?: string | null;
};

export function ReferrerMagicLinkLoginScreen({ initialError }: ReferrerMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      submitPath="/api/auth/login/referrer"
      eyebrow="Referrer sign-in"
      heading="Get magic link"
      description="Use your email and we'll send a sign-in link."
      emailLabel="Email"
      emailPlaceholder="name@company.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      initialError={initialError}
    />
  );
}
