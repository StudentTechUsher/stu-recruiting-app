"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterCandidateRelationshipManager } from "@/components/recruiter/RecruiterCandidateRelationshipManager";

export default function RecruiterCandidateRelationshipManagerPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <RecruiterCandidateRelationshipManager />
      </main>
    </AppNavigationShell>
  );
}
