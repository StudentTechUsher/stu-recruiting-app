"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { ProfileBuilder } from "@/components/mock/ProfileBuilder/ProfileBuilder";

export default function RecruiterCapabilityModelsPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <ProfileBuilder defaultMode="guided" defaultAgentOpen />
      </main>
    </AppNavigationShell>
  );
}
