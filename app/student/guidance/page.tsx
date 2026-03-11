"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentAIAgentGuidancePanel } from "@/components/mock/StudentAIAgentGuidancePanel/StudentAIAgentGuidancePanel";

export default function StudentGuidancePage() {
  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentAIAgentGuidancePanel />
      </main>
    </AppNavigationShell>
  );
}
