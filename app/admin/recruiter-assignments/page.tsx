"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";

export default function AdminRecruiterAssignmentsPage() {
  return (
    <AppNavigationShell audience="admin">
      <section className="w-full px-6 py-12 lg:px-8">
        <div className="rounded-[30px] border border-[#cfded7] bg-[#f8fcfa] p-8 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Org Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">Recruiter Assignment Governance</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#436059]">
            Manage recruiter-to-position assignments used for ABAC and RLS enforcement. This route remains a Phase 1 shell
            while preserving Storybook visual language and navigation patterns.
          </p>
        </div>
      </section>
    </AppNavigationShell>
  );
}
