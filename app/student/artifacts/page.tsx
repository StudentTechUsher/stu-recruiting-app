"use client";

import { StudentArtifactRepository } from "@/components/mock/StudentArtifactRepository/StudentArtifactRepository";

export default function StudentArtifactsPage() {
  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <StudentArtifactRepository />
    </main>
  );
}
