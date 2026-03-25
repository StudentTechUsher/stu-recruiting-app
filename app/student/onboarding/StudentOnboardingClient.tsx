"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { StudentPhase1Onboarding } from "../../../components/student/StudentPhase1Onboarding";

export function StudentOnboardingClient({
  defaultCampusEmail,
  claimStatus,
}: {
  defaultCampusEmail: string;
  claimStatus: string | null;
}) {
  const router = useRouter();
  const onboardingStartedAtRef = useRef<Date>(new Date());

  const completeOnboarding = async (payload: Record<string, unknown>) => {
    const submittedAt = new Date();
    const startedAt = onboardingStartedAtRef.current;
    const durationMs = Math.max(0, submittedAt.getTime() - startedAt.getTime());

    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        client_metrics: {
          onboarding_started_at: startedAt.toISOString(),
          onboarding_submitted_at: submittedAt.toISOString(),
          onboarding_duration_ms: durationMs
        }
      })
    });

    const data = (await response.json()) as { ok: boolean; redirectPath?: string; error?: string };
    if (response.status === 403 && data?.error === "session_expired") {
      router.push("/login?error=session_expired");
      router.refresh();
      return;
    }
    if (response.status === 409 && data?.error === "claim_under_review") {
      throw new Error("claim_under_review");
    }

    if (!response.ok || !data.ok || !data.redirectPath) {
      throw new Error("onboarding_complete_failed");
    }

    router.push(data.redirectPath);
    router.refresh();
  };

  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <StudentPhase1Onboarding
        onComplete={completeOnboarding}
        defaultCampusEmail={defaultCampusEmail}
        claimStatus={claimStatus}
      />
    </main>
  );
}
