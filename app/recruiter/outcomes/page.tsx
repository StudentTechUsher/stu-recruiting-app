"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { OutcomeFeedbackLoop } from "@/components/mock/OutcomeFeedbackLoop/OutcomeFeedbackLoop";

export default function RecruiterOutcomesPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <OutcomeFeedbackLoop />
      </main>
    </AppNavigationShell>
  );
}
