"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { Card } from "@/components/mock/ui/Card";

const crmSections = [
  {
    title: "Candidate timeline",
    todo: "TODO: Render ordered milestones per candidate from first touch to offer decision."
  },
  {
    title: "Interaction history",
    todo: "TODO: Capture recruiter notes, meetings, and communication logs."
  },
  {
    title: "Status progression",
    todo: "TODO: Track stage movement and stagnation risk by candidate."
  },
  {
    title: "Follow-up reminders",
    todo: "TODO: Create reminders for candidates without recent contact."
  }
];

export default function RecruiterCandidateRelationshipManagerPage() {
  return (
    <AppNavigationShell audience="recruiter">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <section className="w-full px-6 py-12 lg:px-8">
          <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
            <header className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">Candidate CRM</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
                Candidate Relationship Manager (Design Preview)
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
                This page is intentionally UI-only for now. All functional behavior is deferred and marked as TODO.
              </p>
            </header>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {crmSections.map((section) => (
                <Card
                  key={section.title}
                  className="bg-white/95 p-4 dark:bg-slate-900/80"
                  header={<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">{section.title}</h3>}
                >
                  <p className="text-xs leading-6 text-[#4c6860] dark:text-slate-300">{section.todo}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppNavigationShell>
  );
}
