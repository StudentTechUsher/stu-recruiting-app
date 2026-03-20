"use client";

import { useEffect, useMemo, useState } from "react";

type Candidate = {
  candidate_key: string;
  ats_provider: "greenhouse" | "lever" | "bamboohr";
  ats_candidate_id: string;
  full_name: string;
  email: string | null;
  current_stage: string | null;
  applied_at: string | null;
  job_title: string | null;
  status: "active" | "rejected" | "hired" | "other";
  profile_url: string | null;
  recommendation_state: "recommended" | "hold" | "manual_review";
  recommendation_reason_code: string;
  match_status: "MATCHED_STUDENT" | "NO_STUDENT_MATCH";
  student_profile: {
    profile_id: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
    target_roles: string[];
    target_companies: string[];
    university: string | null;
    share_slug: string | null;
  } | null;
};

type CandidatePayload = {
  provider: "greenhouse" | "lever" | "bamboohr";
  candidates: Candidate[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  timeline_preview_by_candidate_key: Record<
    string,
    {
      id: string;
      title: string;
      detail: string | null;
      created_at: string;
    }
  >;
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#dbe8e2] dark:bg-slate-700/70";

export function RecruiterCandidateExplorer() {
  const [data, setData] = useState<CandidatePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState<"all" | "recommended" | "hold" | "manual_review">("all");
  const [matchFilter, setMatchFilter] = useState<"all" | "MATCHED_STUDENT" | "NO_STUDENT_MATCH">("all");
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving" | "saved">>({});

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/recruiter/candidates?page=1&page_size=80", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: CandidatePayload }
          | { ok: false; error?: string }
          | null;

        if (!isActive) return;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && !payload.ok ? payload.error ?? "candidate_load_failed" : "candidate_load_failed");
        }

        setData(payload.data);
      } catch (caughtError) {
        if (!isActive) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load candidates";
        setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const visibleCandidates = useMemo(() => {
    const source = data?.candidates ?? [];
    return source.filter((candidate) => {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        candidate.full_name.toLowerCase().includes(normalizedSearchTerm) ||
        (candidate.email ?? "").toLowerCase().includes(normalizedSearchTerm) ||
        (candidate.job_title ?? "").toLowerCase().includes(normalizedSearchTerm);

      const matchesRecommendation =
        recommendationFilter === "all" || candidate.recommendation_state === recommendationFilter;
      const matchesMatchStatus = matchFilter === "all" || candidate.match_status === matchFilter;

      return matchesSearch && matchesRecommendation && matchesMatchStatus;
    });
  }, [data, matchFilter, recommendationFilter, searchTerm]);

  const triggerAction = async (candidateKey: string, actionName: string) => {
    setActionState((current) => ({ ...current, [candidateKey]: "saving" }));

    try {
      await fetch("/api/recruiter/candidates/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_key: candidateKey,
          action_name: actionName,
          details: { source: "candidate_explorer" },
        }),
      });

      setActionState((current) => ({ ...current, [candidateKey]: "saved" }));
      setTimeout(() => {
        setActionState((current) => ({ ...current, [candidateKey]: "idle" }));
      }, 1600);
    } catch {
      setActionState((current) => ({ ...current, [candidateKey]: "idle" }));
    }
  };

  return (
    <section className="w-full px-6 pb-8 lg:px-8">
      <div className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4d675f] dark:text-slate-400">
            Candidate Explorer v1
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
            Recruiter-Eligible Students + ATS Matches
          </h2>
        </header>

        {isLoading ? (
          <CandidateExplorerSkeleton />
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Search
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Name, email, or role"
                  className="mt-1 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Recommendation
                <select
                  value={recommendationFilter}
                  onChange={(event) =>
                    setRecommendationFilter(event.target.value as "all" | "recommended" | "hold" | "manual_review")
                  }
                  className="mt-1 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All</option>
                  <option value="recommended">Recommended</option>
                  <option value="hold">Hold</option>
                  <option value="manual_review">Manual review</option>
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Match status
                <select
                  value={matchFilter}
                  onChange={(event) =>
                    setMatchFilter(event.target.value as "all" | "MATCHED_STUDENT" | "NO_STUDENT_MATCH")
                  }
                  className="mt-1 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All</option>
                  <option value="MATCHED_STUDENT">Matched to Stu</option>
                  <option value="NO_STUDENT_MATCH">No Stu match</option>
                </select>
              </label>
            </div>

            <div className="mb-3 text-xs text-[#4c6860] dark:text-slate-400">
              Showing {visibleCandidates.length} of {data?.total ?? 0} candidates
            </div>

            <div className="space-y-3">
              {visibleCandidates.map((candidate) => {
                const preview = data?.timeline_preview_by_candidate_key[candidate.candidate_key];
                const state = actionState[candidate.candidate_key] ?? "idle";

                return (
                  <article
                    key={candidate.candidate_key}
                    className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#12392f] dark:text-slate-100">{candidate.full_name}</h3>
                        <p className="text-sm text-[#4c6860] dark:text-slate-300">
                          {candidate.job_title ?? "No job title"}
                          {candidate.email ? ` · ${candidate.email}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-[#5d786f] dark:text-slate-400">
                          Stage: {candidate.current_stage ?? "Unknown"} · Status: {candidate.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-[#eef7f2] px-2 py-1 font-semibold text-[#2f5a4d] dark:bg-slate-800 dark:text-slate-300">
                          {candidate.recommendation_state}
                        </span>
                        <span className="rounded-md bg-[#f2f6ff] px-2 py-1 font-semibold text-[#2a4373] dark:bg-blue-950/40 dark:text-blue-200">
                          {candidate.match_status}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-[#4c6860] dark:text-slate-400">
                      Reason code: {candidate.recommendation_reason_code}
                    </p>

                    {candidate.student_profile ? (
                      <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-400">
                        Stu profile: {candidate.student_profile.full_name}
                        {candidate.student_profile.university ? ` · ${candidate.student_profile.university}` : ""}
                        {candidate.student_profile.share_slug ? ` · /profile/${candidate.student_profile.share_slug}` : ""}
                      </p>
                    ) : null}

                    {preview ? (
                      <p className="mt-1 text-xs text-[#5a756c] dark:text-slate-400">
                        Timeline: {preview.title}
                        {preview.detail ? ` (${preview.detail})` : ""}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => triggerAction(candidate.candidate_key, "flag_for_review")}
                        disabled={state === "saving"}
                        className="rounded-lg border border-[#b8cdc3] bg-white px-3 py-1.5 text-xs font-semibold text-[#244a3d] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : "Flag for review"}
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerAction(candidate.candidate_key, "request_follow_up")}
                        disabled={state === "saving"}
                        className="rounded-lg border border-[#b8cdc3] bg-white px-3 py-1.5 text-xs font-semibold text-[#244a3d] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Request follow-up
                      </button>

                      {candidate.profile_url ? (
                        <a
                          href={candidate.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-[#c7d9d1] px-3 py-1.5 text-xs font-semibold text-[#30574a] hover:bg-[#f1f8f4] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Open ATS profile
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {visibleCandidates.length === 0 ? (
                <p className="rounded-xl border border-[#d7e4dd] bg-white px-3 py-3 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                  No candidates match current filters.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function CandidateExplorerSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`candidate-filter-skeleton-${index}`} className="rounded-lg border border-[#d7e4dd] bg-white p-3 dark:border-slate-700 dark:bg-slate-900/80">
            <div className={`${skeletonBlockClassName} h-3 w-24`} />
            <div className={`${skeletonBlockClassName} mt-2 h-8 w-full`} />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`candidate-card-skeleton-${index}`} className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <div className={`${skeletonBlockClassName} h-5 w-40`} />
            <div className={`${skeletonBlockClassName} mt-2 h-4 w-64`} />
            <div className={`${skeletonBlockClassName} mt-2 h-4 w-56`} />
            <div className="mt-3 flex gap-2">
              <div className={`${skeletonBlockClassName} h-7 w-28`} />
              <div className={`${skeletonBlockClassName} h-7 w-28`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
