"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type RecruiterMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
  initialError?: string | null;
};

export function RecruiterMagicLinkLoginScreen({ sessionCheckEnabled, initialError }: RecruiterMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      sessionCheckEnabled={sessionCheckEnabled}
      submitPath="/api/auth/login/recruiter"
      eyebrow="Recruiter sign-in"
      heading="Get magic link"
      description="Use your work email to request recruiter access."
      emailLabel="Work email"
      emailPlaceholder="name@company.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      initialError={initialError}
    />
  );
}
