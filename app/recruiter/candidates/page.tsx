"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterCandidateExplorer } from "@/components/recruiter/RecruiterCandidateExplorer";
import { RecruiterEndorsementFeed } from "@/components/recruiter/RecruiterEndorsementFeed";

export default function RecruiterCandidatesPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <div className="px-6 pt-6 lg:px-8">
          <RecruiterEndorsementFeed />
        </div>
        <RecruiterCandidateExplorer />
      </main>
    </AppNavigationShell>
  );
}
