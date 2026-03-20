"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { RecruiterCapabilityModelsWorkspace } from "@/components/recruiter/RecruiterCapabilityModelsWorkspace";

export default function RecruiterCapabilityModelsPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <RecruiterCapabilityModelsWorkspace />
      </main>
    </AppNavigationShell>
  );
}
