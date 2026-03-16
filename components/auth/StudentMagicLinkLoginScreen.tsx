"use client";

import { MagicLinkLoginScreen } from "@/components/auth/MagicLinkLoginScreen";

type StudentMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
};

export function StudentMagicLinkLoginScreen({ sessionCheckEnabled }: StudentMagicLinkLoginScreenProps) {
  return (
    <MagicLinkLoginScreen
      sessionCheckEnabled={sessionCheckEnabled}
      submitPath="/api/auth/login/student"
      eyebrow="Student sign-in"
      heading="Get magic link"
      description="Use your .edu email to receive a secure sign-in link."
      emailLabel="Campus email"
      emailPlaceholder="name@school.edu"
      submitLabel="Send magic link"
      loadingLabel="Sending link..."
      errorMessages={{
        invalid_student_email_domain: "Use a valid campus email domain for student login."
      }}
    />
  );
}
