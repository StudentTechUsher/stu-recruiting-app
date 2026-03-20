"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterPipelineOverview } from "@/components/recruiter/RecruiterPipelineOverview";

export default function RecruiterPipelinePage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <RecruiterPipelineOverview />
      </main>
    </AppNavigationShell>
  );
}
