"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterImportScoringWorkbench } from "@/components/mock/RecruiterImportScoringWorkbench/RecruiterImportScoringWorkbench";

export default function RecruiterOffPlatformScoringPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <RecruiterImportScoringWorkbench />
      </main>
    </AppNavigationShell>
  );
}
