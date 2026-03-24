"use client";

import { useEffect, useMemo, useState } from "react";
import { RecruiterEvidenceSidebar } from "@/components/recruiter/RecruiterEvidenceSidebar";
import type {
  ReviewCandidateEvidencePayload,
  ReviewCandidateRow,
} from "@/lib/recruiter/review-candidates";

type CandidateListPayload = {
  provider: "greenhouse" | "lever" | "bamboohr";
  candidates: ReviewCandidateRow[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  job_roles: string[];
};

const providerLabel: Record<CandidateListPayload["provider"], string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  bamboohr: "BambooHR",
};

const toneByVerification = {
  verified:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  unverified:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
} as const;

const identitySourceLabel: Record<ReviewCandidateRow["identity_source"], string> = {
  canonical_linked: "Canonical Linked",
  ats_linked: "Unclaimed Candidate Profile Found",
  ats_derived: "ATS-Derived",
};

const identitySourceTone: Record<ReviewCandidateRow["identity_source"], string> = {
  canonical_linked:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  ats_linked:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
  ats_derived:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
};

const initialsFromName = (value: string): string => {
  const tokens = value
    .split(/[\s@._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return "ST";
  const first = tokens[0]?.[0] ?? "";
  const second = tokens[1]?.[0] ?? "";
  const initials = `${first}${second}`.toUpperCase();
  return initials.length > 0 ? initials : "ST";
};

export function RecruiterReviewCandidates() {
  const [data, setData] = useState<CandidateListPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobRoleFilter, setJobRoleFilter] = useState<string>("all");

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [evidenceDetail, setEvidenceDetail] = useState<ReviewCandidateEvidencePayload | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/recruiter/candidates?page=1&page_size=200", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: CandidateListPayload }
          | { ok: false; error?: string }
          | null;

        if (!isActive) return;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && !payload.ok ? payload.error ?? "review_candidates_load_failed" : "review_candidates_load_failed");
        }

        setData(payload.data);
      } catch (caughtError) {
        if (!isActive) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load review candidates";
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
      if (jobRoleFilter === "all") return true;
      return candidate.job_role === jobRoleFilter;
    });
  }, [data, jobRoleFilter]);

  const loadEvidence = async (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setSidebarLoading(true);
    setSidebarError(null);

    try {
      const response = await fetch(
        `/api/recruiter/candidates/${encodeURIComponent(applicationId)}/evidence`,
        {
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { detail: ReviewCandidateEvidencePayload } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok ? payload.error ?? "evidence_load_failed" : "evidence_load_failed");
      }

      setEvidenceDetail(payload.data.detail);
      if (selectedCapabilityId) {
        const stillAvailable = payload.data.detail.capability_summary.some(
          (capability) => capability.capability_id === selectedCapabilityId
        );
        if (!stillAvailable) setSelectedCapabilityId(null);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load evidence";
      setSidebarError(message);
      setEvidenceDetail(null);
    } finally {
      setSidebarLoading(false);
    }
  };

  return (
    <section className="w-full px-6 py-8 lg:px-8">
      <div className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4d675f] dark:text-slate-400">
              Phase 1
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
              Review Candidates
            </h2>
            <p className="mt-2 text-sm text-[#4c6860] dark:text-slate-300">
              Evidence review only. No scoring, ranking, or automated filtering.
            </p>
          </div>
          {data ? (
            <span className="rounded-full border border-[#bdd2c9] bg-white px-3 py-1 text-xs font-semibold text-[#23493d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              Source: {providerLabel[data.provider]}
            </span>
          ) : null}
        </header>

        {isLoading ? (
          <ReviewCandidatesSkeleton />
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Job role
                <select
                  value={jobRoleFilter}
                  onChange={(event) => setJobRoleFilter(event.target.value)}
                  className="mt-1 block min-w-[220px] rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All roles</option>
                  {(data?.job_roles ?? []).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-xs text-[#4c6860] dark:text-slate-400">
                Showing {visibleCandidates.length} of {data?.total ?? 0} active applicants
              </p>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="w-full lg:w-[60%]">
                <div className="space-y-3">
                  {visibleCandidates.map((candidate) => (
                    <article
                      key={candidate.application_id}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedApplicationId === candidate.application_id
                          ? "border-[#8cb5a7] bg-[#eef7f2] dark:border-slate-500 dark:bg-slate-800/70"
                          : "border-[#d7e4dd] bg-white hover:border-[#b7cdc3] dark:border-slate-700 dark:bg-slate-900/80"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCapabilityId(null);
                          void loadEvidence(candidate.application_id);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#c7d9d1] bg-[#eaf4ef] text-xs font-semibold text-[#2e5c4e] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {candidate.avatar_url ? (
                                <img
                                  src={candidate.avatar_url}
                                  alt={`${candidate.full_name} avatar`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{initialsFromName(candidate.full_name)}</span>
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-[#12392f] dark:text-slate-100">{candidate.full_name}</h3>
                            <p className="mt-1">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${identitySourceTone[candidate.identity_source]}`}
                              >
                                {identitySourceLabel[candidate.identity_source]}
                              </span>
                            </p>
                            <p className="text-xs text-[#5d786f] dark:text-slate-400">
                              Applied for: {candidate.job_role ?? "Not provided"}
                            </p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-[#4c6860] dark:text-slate-400">
                            <p>Stage: {candidate.current_stage ?? "Unknown"}</p>
                            <p>{candidate.applied_at ? new Date(candidate.applied_at).toLocaleString() : "No applied date"}</p>
                            {candidate.identity_state === "unresolved" ? (
                              <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                Unresolved identity
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {candidate.capability_summary.length === 0 ? (
                          <span className="rounded-md border border-[#d6e3dd] bg-[#f7fbf9] px-2 py-1 text-xs text-[#58736a] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            No evidence available
                          </span>
                        ) : (
                          candidate.capability_summary.map((capability) => (
                            <button
                              key={capability.capability_id}
                              type="button"
                              onClick={() => {
                                setSelectedCapabilityId(capability.capability_id);

                                const alreadyLoaded =
                                  selectedApplicationId === candidate.application_id &&
                                  evidenceDetail?.application_id === candidate.application_id;
                                if (!alreadyLoaded) {
                                  void loadEvidence(candidate.application_id);
                                }
                              }}
                              className="rounded-md border border-[#ceded7] bg-white px-2 py-1 text-xs font-semibold text-[#33594d] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {capability.label} ({capability.evidence_count})
                            </button>
                          ))
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-md border px-2 py-1 font-semibold ${toneByVerification.verified}`}>
                          Verified: {candidate.evidence_indicator.verified}
                        </span>
                        <span className={`rounded-md border px-2 py-1 font-semibold ${toneByVerification.pending}`}>
                          Pending: {candidate.evidence_indicator.pending}
                        </span>
                        <span className={`rounded-md border px-2 py-1 font-semibold ${toneByVerification.unverified}`}>
                          Unverified: {candidate.evidence_indicator.unverified}
                        </span>
                      </div>
                    </article>
                  ))}

                  {visibleCandidates.length === 0 ? (
                    <p className="rounded-xl border border-[#d7e4dd] bg-white px-3 py-3 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                      No active applicants match this role filter.
                    </p>
                  ) : null}
                </div>
              </div>

              <RecruiterEvidenceSidebar
                open={Boolean(selectedApplicationId)}
                loading={sidebarLoading}
                error={sidebarError}
                detail={evidenceDetail}
                selectedCapabilityId={selectedCapabilityId}
                onCapabilitySelect={setSelectedCapabilityId}
                onClose={() => {
                  setSelectedApplicationId(null);
                  setSelectedCapabilityId(null);
                  setEvidenceDetail(null);
                  setSidebarError(null);
                }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ReviewCandidatesSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`review-candidate-skeleton-${index}`}
          className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80"
        >
          <div className="h-5 w-56 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
          <div className="mt-2 h-3 w-36 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
            <div className="h-6 w-24 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
