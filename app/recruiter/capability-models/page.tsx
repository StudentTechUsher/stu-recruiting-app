"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";

export default function RecruiterCapabilityModelsPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen px-6 py-8 text-[#0a1f1a] dark:text-slate-100 lg:px-8">
        <section className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
          <header className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
              Capability Model
            </h1>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              Coming Soon
            </span>
          </header>

          <p className="mt-3 text-sm text-[#4c6860] dark:text-slate-300">
            This section remains visible in Phase 1, but model authoring and interactive controls are disabled.
          </p>
        </section>
      </main>
    </AppNavigationShell>
  );
}
