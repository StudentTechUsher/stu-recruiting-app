"use client";

import { Suspense } from "react";
import { StudentArtifactRepository } from "@/components/mock/StudentArtifactRepository/StudentArtifactRepository";

function ArtifactRepositoryPageFallback() {
  return (
    <section aria-hidden="true" className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 dark:border-slate-700 dark:bg-slate-900/75">
        <div className="animate-pulse">
          <div className="h-4 w-40 rounded bg-[#e4efe9] dark:bg-slate-700" />
          <div className="mt-3 h-8 w-72 max-w-full rounded bg-[#e4efe9] dark:bg-slate-700" />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`artifact-page-fallback-${index}`} className="h-28 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StudentArtifactsPage() {
  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <Suspense fallback={<ArtifactRepositoryPageFallback />}>
        <StudentArtifactRepository />
      </Suspense>
    </main>
  );
}
