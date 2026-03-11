"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentInterviewPrep } from "@/components/mock/StudentInterviewPrep/StudentInterviewPrep";

export default function StudentInterviewPrepPage() {
  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentInterviewPrep />
      </main>
    </AppNavigationShell>
  );
}
