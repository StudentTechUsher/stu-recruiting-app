"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { CandidateExplorer } from "@/components/mock/CandidateExplorer/CandidateExplorer";

export default function RecruiterCandidatesPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <CandidateExplorer />
      </main>
    </AppNavigationShell>
  );
}
