"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentArtifactRepository } from "@/components/mock/StudentArtifactRepository/StudentArtifactRepository";

export default function StudentArtifactsPage() {
  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentArtifactRepository />
      </main>
    </AppNavigationShell>
  );
}
