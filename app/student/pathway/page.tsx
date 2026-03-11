"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentPathwayPlanner } from "@/components/mock/StudentPathwayPlanner/StudentPathwayPlanner";

export default function StudentPathwayPage() {
  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentPathwayPlanner />
      </main>
    </AppNavigationShell>
  );
}
