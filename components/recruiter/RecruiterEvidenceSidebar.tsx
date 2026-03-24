"use client";

import type { ReviewCandidateEvidencePayload } from "@/lib/recruiter/review-candidates";

type RecruiterEvidenceSidebarProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: ReviewCandidateEvidencePayload | null;
  selectedCapabilityId: string | null;
  onCapabilitySelect: (capabilityId: string | null) => void;
  onClose: () => void;
};

const toneByVerification = {
  verified:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  unverified:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
} as const;

const identitySourceLabel: Record<ReviewCandidateEvidencePayload["identity_source"], string> = {
  canonical_linked: "Canonical Linked",
  ats_linked: "Unclaimed Candidate Profile Found",
  ats_derived: "ATS-Derived",
};

const identitySourceTone: Record<ReviewCandidateEvidencePayload["identity_source"], string> = {
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

export function RecruiterEvidenceSidebar({
  open,
  loading,
  error,
  detail,
  selectedCapabilityId,
  onCapabilitySelect,
  onClose,
}: RecruiterEvidenceSidebarProps) {
  if (!open) return null;

  const artifacts = detail?.artifacts ?? [];
  const visibleArtifacts = selectedCapabilityId
    ? artifacts.filter((artifact) => artifact.capability_id === selectedCapabilityId)
    : artifacts;
  const hasArtifacts = visibleArtifacts.length > 0;

  return (
    <aside className="w-full rounded-2xl border border-[#cfddd6] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80 lg:w-[40%]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#c7d9d1] bg-[#eaf4ef] text-xs font-semibold text-[#2e5c4e] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {detail?.avatar_url ? (
              <img src={detail.avatar_url} alt={`${detail.full_name} avatar`} className="h-full w-full object-cover" />
            ) : (
              <span>{initialsFromName(detail?.full_name ?? "Candidate")}</span>
            )}
          </div>
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4a675f] dark:text-slate-400">
            Evidence Profile
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#12392f] dark:text-slate-100">
            {detail?.full_name ?? "Candidate"}
          </h3>
          {detail ? (
            <p className="mt-1">
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${identitySourceTone[detail.identity_source]}`}
              >
                {identitySourceLabel[detail.identity_source]}
              </span>
            </p>
          ) : null}
          <p className="text-xs text-[#5d786f] dark:text-slate-400">
            {detail?.job_role ?? "No role context"}
            {detail?.identity_state === "unresolved"
              ? ` · Unresolved identity${detail.identity_reason ? ` (${detail.identity_reason})` : ""}`
              : ""}
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#c6d8d0] px-2 py-1 text-xs font-semibold text-[#2d5246] dark:border-slate-600 dark:text-slate-200"
        >
          Close
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-36 animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
          <div className="h-24 w-full animate-pulse rounded bg-[#dbe8e2] dark:bg-slate-700/70" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : !detail ? (
        <div className="rounded-xl border border-[#d8e5de] bg-[#f7fbf9] px-3 py-2 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Select a candidate and capability to inspect evidence.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4a675f] dark:text-slate-400">
              Capabilities
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCapabilitySelect(null)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  selectedCapabilityId === null
                    ? "border-[#8cb5a7] bg-[#e9f5f0] text-[#1e473b] dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                    : "border-[#ceded7] bg-white text-[#33594d] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                All Evidence ({artifacts.length})
              </button>
              {detail.capability_summary.length === 0 ? (
                <span className="rounded-md border border-[#d6e3dd] bg-[#f7fbf9] px-2 py-1 text-xs text-[#58736a] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No evidence available
                </span>
              ) : (
                detail.capability_summary.map((capability) => (
                  <button
                    key={capability.capability_id}
                    type="button"
                    onClick={() => onCapabilitySelect(capability.capability_id)}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      selectedCapabilityId === capability.capability_id
                        ? "border-[#8cb5a7] bg-[#e9f5f0] text-[#1e473b] dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                        : "border-[#ceded7] bg-white text-[#33594d] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {capability.label} ({capability.evidence_count})
                  </button>
                ))
              )}
            </div>
          </div>

          {!hasArtifacts ? (
            <div className="rounded-xl border border-[#d8e5de] bg-[#f7fbf9] px-3 py-3 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {selectedCapabilityId ? "No evidence available for selected capability." : "No evidence available"}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleArtifacts.map((artifact) => (
                <div
                  key={artifact.artifact_id}
                  className="rounded-xl border border-[#d8e5de] bg-[#fbfdfc] p-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1d4639] dark:text-slate-100">
                      {artifact.title}
                    </p>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        toneByVerification[artifact.verification_status]
                      }`}
                    >
                      {artifact.verification_status}
                    </span>
                  </div>
                  <p className="text-xs text-[#5d786f] dark:text-slate-400">{artifact.source}</p>
                  {artifact.description ? (
                    <p className="mt-2 text-sm text-[#30564a] dark:text-slate-300">{artifact.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[#5d786f] dark:text-slate-400">
                    Artifact type: {artifact.artifact_type}
                  </p>
                </div>
              ))}
              <div className="text-xs text-[#4c6860] dark:text-slate-400">
                Showing {visibleArtifacts.length} of {artifacts.length} artifacts
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
