"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigationShell } from "@/components/AppNavigationShell";

type OnboardingAudience = "recruiter" | "admin";

const labels: Record<OnboardingAudience, { heading: string; intro: string; bullets: string[] }> = {
  recruiter: {
    heading: "Recruiter onboarding",
    intro: "Confirm setup before recruiter workspace access is enabled.",
    bullets: [
      "Review capability model standards for your assigned roles.",
      "Acknowledge candidate review guidelines.",
      "Confirm notification and interview workflow preferences."
    ]
  },
  admin: {
    heading: "Org admin onboarding",
    intro: "Complete admin setup before assignment governance access is enabled.",
    bullets: [
      "Review recruiter assignment governance expectations.",
      "Acknowledge org-level access and auditing responsibilities.",
      "Confirm onboarding checklist completion for your organization."
    ]
  }
};

export function RoleOnboardingScreen({ audience }: { audience: OnboardingAudience }) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = labels[audience];

  const onComplete = async () => {
    setIsCompleting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ checklist_complete: true })
      });

      const data = (await response.json()) as { ok: boolean; redirectPath?: string; error?: string };
      if (response.status === 403 && data?.error === "session_expired") {
        router.push("/login?error=session_expired");
        router.refresh();
        return;
      }

      if (!response.ok || !data.ok || !data.redirectPath) {
        setError("Unable to complete onboarding. Please try again.");
        return;
      }

      router.push(data.redirectPath);
      router.refresh();
    } catch {
      setError("Unable to complete onboarding. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <AppNavigationShell audience={audience} showNavigation={false}>
      <main className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-8">
        <section className="w-full max-w-2xl rounded-[30px] border border-[#cfded7] bg-[#f8fcfa] p-8 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Required setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">{content.heading}</h1>
          <p className="mt-3 text-sm leading-7 text-[#436059]">{content.intro}</p>

          <ul className="mt-5 space-y-2 rounded-2xl border border-[#d2dfd9] bg-white p-4 text-sm text-[#21453a]">
            {content.bullets.map((item) => (
              <li key={item} className="rounded-lg border border-[#e3ece8] bg-[#f8fcfa] px-3 py-2">
                {item}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onComplete}
            disabled={isCompleting}
            className="mt-5 inline-flex rounded-xl bg-[#12f987] px-4 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompleting ? "Finishing onboarding..." : "Finish onboarding"}
          </button>

          {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
        </section>
      </main>
    </AppNavigationShell>
  );
}
