"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { EmployerDashboardPipelineOverview } from "@/components/mock/EmployerDashboardPipelineOverview/EmployerDashboardPipelineOverview";

export default function RecruiterPipelinePage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <EmployerDashboardPipelineOverview />
      </main>
    </AppNavigationShell>
  );
}
