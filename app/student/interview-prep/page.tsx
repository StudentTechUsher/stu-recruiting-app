"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/mock/ui/Card";

export default function StudentInterviewPrepPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [previousSessions, setPreviousSessions] = useState<
    Array<{ id: string; completedAt: string; role: string; score: string }>
  >([]);

  useEffect(() => {
    let active = true;

    // Keep this asynchronous boundary explicit so loading skeletons are always
    // available when this page shifts from mock data to API-backed data.
    const loadSessions = async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });

      if (!active) return;

      setPreviousSessions([
        {
          id: "sess-2026-02-28",
          completedAt: "Feb 28, 2026",
          role: "Product Analyst Intern",
          score: "83/100"
        },
        {
          id: "sess-2026-02-20",
          completedAt: "Feb 20, 2026",
          role: "Business Analyst Intern",
          score: "79/100"
        },
        {
          id: "sess-2026-02-12",
          completedAt: "Feb 12, 2026",
          role: "Data Analyst Intern",
          score: "81/100"
        }
      ]);
      setIsLoading(false);
    };

    void loadSessions();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <section aria-labelledby="student-interview-prep-title" className="w-full px-6 py-12 lg:px-8">
        <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
              Student Interview Prep
            </p>
            <h2 id="student-interview-prep-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
              Interview Prep
            </h2>
            <div className="mt-3">
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-200">
                Coming Soon
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Practice role-aligned responses and review past interview sessions in one place.
            </p>
          </header>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Active Question</h3>}
              className="border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              {isLoading ? (
                <div aria-hidden="true" className="animate-pulse space-y-4">
                  <div className="h-3 w-full rounded-lg bg-[#e4efe9] dark:bg-slate-700/70" />
                  <div className="h-3 w-4/5 rounded-lg bg-[#e4efe9] dark:bg-slate-700/70" />
                  <div className="h-40 w-full rounded-xl bg-[#e4efe9] dark:bg-slate-700/70" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#4a665d] dark:text-slate-300">
                    Tell me about a time you had conflicting priorities on a project. How did you decide what to do first, and what was the outcome?
                  </p>
                  <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Your response
                    <textarea
                      rows={8}
                      placeholder="Write a detailed response using context, actions, and measurable outcomes..."
                      className="mt-2 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </>
              )}
            </Card>

            <Card
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Previous Sessions</h3>}
              className="border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              {isLoading ? (
                <ul aria-hidden="true" className="animate-pulse space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <li
                      key={`session-skeleton-${index}`}
                      className="rounded-xl border border-[#d6e2dc] bg-[#f8fcfa] px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <div className="h-3 w-2/3 rounded-lg bg-[#e4efe9] dark:bg-slate-700/70" />
                      <div className="mt-2 h-3 w-1/2 rounded-lg bg-[#e4efe9] dark:bg-slate-700/70" />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2">
                  {previousSessions.map((session) => (
                    <li
                      key={session.id}
                      className="rounded-xl border border-[#d6e2dc] bg-[#f8fcfa] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <p className="font-semibold text-[#1d4338] dark:text-slate-100">{session.role}</p>
                      <p className="mt-1 text-xs text-[#56746a] dark:text-slate-300">
                        {session.completedAt} • Session score: {session.score}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
