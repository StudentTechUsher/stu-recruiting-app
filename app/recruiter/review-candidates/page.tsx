"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterReviewCandidates } from "@/components/recruiter/RecruiterReviewCandidates";

export default function RecruiterReviewCandidatesPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <RecruiterReviewCandidates />
      </main>
    </AppNavigationShell>
  );
}
