"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type RecruiterMagicLinkLoginScreenProps = {
  initialError?: string | null;
};

export function RecruiterMagicLinkLoginScreen({ initialError }: RecruiterMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      submitPath="/api/auth/login/recruiter"
      eyebrow="Recruiter sign-in"
      heading="Get magic link"
      description="Use your work email and we'll send a sign-in link."
      emailLabel="Work email"
      emailPlaceholder="name@company.com"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      initialError={initialError}
    />
  );
}
