"use client";

import { useRouter } from "next/navigation";
import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentOnboardingSignup } from "@/components/mock/StudentOnboardingSignup/StudentOnboardingSignup";

export function StudentOnboardingClient({
  defaultCampusEmail,
  focusCompanyOptions,
  focusRoleOptions
}: {
  defaultCampusEmail: string;
  focusCompanyOptions: string[];
  focusRoleOptions: string[];
}) {
  const router = useRouter();

  const completeOnboarding = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { ok: boolean; redirectPath?: string };
    if (!response.ok || !data.ok || !data.redirectPath) {
      throw new Error("onboarding_complete_failed");
    }

    router.push(data.redirectPath);
    router.refresh();
  };

  return (
    <AppNavigationShell audience="student" showNavigation={false}>
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentOnboardingSignup
          onComplete={completeOnboarding}
          defaultCampusEmail={defaultCampusEmail}
          focusCompanyOptions={focusCompanyOptions}
          focusRoleOptions={focusRoleOptions}
        />
      </main>
    </AppNavigationShell>
  );
}
