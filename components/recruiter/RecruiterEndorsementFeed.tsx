"use client";

import { useEffect, useState } from "react";

type Endorsement = {
  endorsement_id: string;
  student_share_slug: string;
  student_full_name: string;
  student_avatar_url: string | null;
  referrer_full_name: string;
  referrer_company: string | null;
  referrer_position: string | null;
  endorsement_text: string;
  updated_at: string;
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#e4efe9] dark:bg-slate-700/70";

export function RecruiterEndorsementFeed() {
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadEndorsements = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/recruiter/endorsements", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { endorsements: Endorsement[] } }
          | { ok: false; error?: string }
          | null;

        if (!isActive) return;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error("recruiter_endorsements_load_failed");
        }

        setEndorsements(payload.data.endorsements ?? []);
      } catch {
        if (!isActive) return;
        setError("Unable to load endorsements right now.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadEndorsements();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="mb-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Recent referrals & endorsements</h2>
        <span className="text-xs text-[#557168] dark:text-slate-400">{isLoading ? "Loading..." : `${endorsements.length} endorsements`}</span>
      </div>

      {isLoading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`recruiter-endorsement-skeleton-${index}`} className="rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className={`${skeletonBlockClassName} h-4 w-40`} />
              <div className={`${skeletonBlockClassName} mt-2 h-3 w-48`} />
              <div className={`${skeletonBlockClassName} mt-3 h-3 w-full`} />
              <div className={`${skeletonBlockClassName} mt-2 h-3 w-5/6`} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
      ) : endorsements.length === 0 ? (
        <p className="mt-3 text-sm text-[#557168] dark:text-slate-400">No endorsements submitted yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {endorsements.slice(0, 8).map((endorsement) => (
            <article
              key={endorsement.endorsement_id}
              className="rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3 text-sm text-[#21453a] dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200"
            >
              <p className="font-semibold text-[#0a1f1a] dark:text-slate-100">{endorsement.student_full_name}</p>
              <p className="mt-0.5 text-xs text-[#557168] dark:text-slate-400">
                Referred by {endorsement.referrer_full_name}
                {endorsement.referrer_company ? ` · ${endorsement.referrer_company}` : ""}
              </p>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-[#48635b] dark:text-slate-300">{endorsement.endorsement_text}</p>
              <p className="mt-2 text-[11px] text-[#557168] dark:text-slate-400">Profile URL: /profile/{endorsement.student_share_slug}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
