"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  EvidenceTargetRadar,
  calculateEvidenceTargetAlignmentPercent,
  type EvidenceTargetRadarAxis,
} from "@/components/student/EvidenceTargetRadar";
import {
  fetchStudentQuery,
  invalidateStudentCacheForMutation,
  setStudentQueryCacheScope,
} from "@/lib/client/student-query-cache";
import { endCandidateBoundary, startCandidateBoundary } from "@/lib/client/student-perf";

type VerificationBreakdown = {
  verified: number;
  pending: number;
  unverified: number;
};

type DashboardAxis = {
  capability_id: string;
  label: string;
  capability_class: "soft_skill" | "role_capability" | "fallback";
  covered: boolean;
  supporting_evidence_ids: string[];
  verification_breakdown: VerificationBreakdown;
};

type DashboardPayload = {
  identity: {
    display_name: string;
    first_name: string | null;
    initials_fallback: string;
    avatar_url: string | null;
    cache_scope: string;
  };
  roles: string[];
  axes: DashboardAxis[];
  alerts?: {
    extraction_in_progress: boolean;
    extraction_status: {
      resume: "extracting" | "succeeded" | "failed" | "unknown";
      transcript: "extracting" | "succeeded" | "failed" | "unknown";
    };
    resume_email_mismatch: {
      auth_email: string | null;
      resume_email: string | null;
      detected_at: string | null;
      message: string;
    } | null;
  };
  kpis: {
    capability_coverage_percent: number;
    verified_evidence_share: number;
    pending_unverified_share: number;
    last_updated_at: string | null;
    evidence_count: number;
    total_linked_evidence: number;
  };
  ai_literacy: {
    status: "not_started" | "in_progress" | "partial_available" | "available" | "needs_attention";
    profile_coverage_percent: number;
    recruiter_safe_coverage_percent: number;
    overall_indicative_literacy_level: "Awareness" | "Foundational Use" | "Applied Judgment" | "Strategic Fluency";
    confidence: {
      class: "insufficient" | "limited" | "moderate" | "strong";
      score: number;
    };
    role_lens: {
      role_family: string;
      role_labels: string[];
      role_lens_key: string;
    };
    domains_with_profile_signal: number;
    domains_with_recruiter_safe_signal: number;
    total_role_relevant_domains: number;
    last_evaluated_at: string | null;
    updated: boolean;
    has_selected_capability_model: boolean;
  };
  state: "no_evidence" | "partial_no_verification" | "full_low_trust" | "progressing";
  primary_cta: { label: string; href: string };
  secondary_cta: { label: string; href: string };
};

type ActiveCapabilityProfile = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: "manual" | "agent_recommended" | "agent_confirmed" | "migrated_legacy";
  status: "active";
};

type CapabilityProfileFit = {
  capability_profile_id: string;
  company_label: string;
  role_label: string;
  alignment_score: number;
  overall_alignment?: number;
  confidence_summary: {
    average_confidence: number;
    low_confidence_axis_count: number;
    axis_count: number;
  };
  axes: EvidenceTargetRadarAxis[];
  generated_at: string;
  evidence_freshness_marker: string;
};

type CapabilityTargetsPayload = {
  active_capability_profiles: ActiveCapabilityProfile[];
  fit_by_capability_profile_id: Record<string, CapabilityProfileFit>;
};

type MetricTone = "neutral" | "success" | "warning" | "danger";
type HiringSignalLevel = "Weak" | "Weak-leaning" | "Moderate" | "Strong-leaning" | "Strong";

const skeletonClass = "animate-pulse rounded-xl bg-[#dde9e3] dark:bg-slate-700/70";

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;

const resolveVerifiedShareTone = (share: number): MetricTone => {
  if (share >= 0.7) return "success";
  if (share >= 0.4) return "warning";
  return "danger";
};

const resolveCoverageTone = (coveragePercent: number): MetricTone => {
  if (coveragePercent >= 70) return "success";
  if (coveragePercent >= 35) return "warning";
  return "danger";
};

const formatAiLiteracyStatus = (
  status: DashboardPayload["ai_literacy"]["status"]
): "Not Started" | "In Progress" | "Partial Available" | "Available" | "Needs Attention" => {
  if (status === "not_started") return "Not Started";
  if (status === "in_progress") return "In Progress";
  if (status === "partial_available") return "Partial Available";
  if (status === "needs_attention") return "Needs Attention";
  return "Available";
};

const resolveOverallHiringSignal = ({
  coveragePercent,
  verifiedShare,
}: {
  coveragePercent: number;
  verifiedShare: number;
}): { level: HiringSignalLevel; tone: MetricTone } => {
  const coverageWeight = Math.max(0, Math.min(coveragePercent, 100)) / 100;
  const verifiedWeight = Math.max(0, Math.min(verifiedShare, 1));
  const score = coverageWeight * 0.65 + verifiedWeight * 0.35;
  if (score < 0.2) return { level: "Weak", tone: "danger" };
  if (score < 0.4) return { level: "Weak-leaning", tone: "warning" };
  if (score < 0.6) return { level: "Moderate", tone: "neutral" };
  if (score < 0.8) return { level: "Strong-leaning", tone: "success" };
  return { level: "Strong", tone: "success" };
};

export default function StudentDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTargetsLoading, setIsTargetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [capabilityTargets, setCapabilityTargets] = useState<CapabilityTargetsPayload | null>(null);
  const [isDismissingMismatch, setIsDismissingMismatch] = useState(false);
  const dashboardPerfHandleRef = useRef<ReturnType<typeof startCandidateBoundary> | null>(null);

  useEffect(() => {
    let active = true;
    if (!dashboardPerfHandleRef.current) {
      dashboardPerfHandleRef.current = startCandidateBoundary("dashboard");
    }
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = (await fetchStudentQuery({
          path: "/api/student/dashboard",
          resource: "dashboard",
        })) as
          | { ok: true; data?: { dashboard?: DashboardPayload } }
          | { ok: false; error?: string }
          | null;
        if (!payload || !payload.ok || !payload.data?.dashboard) {
          throw new Error("dashboard_load_failed");
        }

        if (!active) return;
        setDashboard(payload.data.dashboard);
        if (payload.data.dashboard.identity?.cache_scope) {
          setStudentQueryCacheScope(payload.data.dashboard.identity.cache_scope);
        }
      } catch {
        if (!active) return;
        setError("Unable to load dashboard right now.");
      } finally {
        if (active) {
          setIsLoading(false);
          if (dashboardPerfHandleRef.current) {
            endCandidateBoundary(dashboardPerfHandleRef.current);
            dashboardPerfHandleRef.current = null;
          }
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadTargets = async () => {
      setIsTargetsLoading(true);
      try {
        const payload = (await fetchStudentQuery({
          path: "/api/student/capability-profiles",
          resource: "capability_profiles",
        })) as
          | { ok: true; data?: CapabilityTargetsPayload }
          | { ok: false; error?: string }
          | null;
        if (!payload || !payload.ok || !payload.data) {
          throw new Error("capability_targets_load_failed");
        }
        if (!active) return;
        setCapabilityTargets(payload.data);
      } catch {
        if (!active) return;
        setCapabilityTargets(null);
      } finally {
        if (active) setIsTargetsLoading(false);
      }
    };

    void loadTargets();
    return () => {
      active = false;
    };
  }, []);

  const dismissResumeMismatchWarning = async () => {
    if (!dashboard?.alerts?.resume_email_mismatch || isDismissingMismatch) return;
    setIsDismissingMismatch(true);
    try {
      const response = await fetch("/api/student/onboarding/signals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "dismiss_resume_email_mismatch",
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !payload?.ok) throw new Error("dismiss_failed");
      invalidateStudentCacheForMutation("/api/student/onboarding/signals");

      setDashboard((current) => {
        if (!current?.alerts) return current;
        return {
          ...current,
          alerts: {
            ...current.alerts,
            resume_email_mismatch: null,
          },
        };
      });
    } catch {
      setError("Unable to dismiss this warning right now.");
    } finally {
      setIsDismissingMismatch(false);
    }
  };

  const stateLabel = useMemo(() => {
    const state = dashboard?.state;
    if (state === "no_evidence") return "Add evidence to populate capability coverage.";
    if (state === "partial_no_verification") return "Evidence found. Verify artifacts to improve trust labels.";
    if (state === "full_low_trust") return "Coverage complete. Verification is the current priority.";
    return "Keep your evidence profile current.";
  }, [dashboard?.state]);
  const primaryTargetCoverage = useMemo(() => {
    const primaryTarget = capabilityTargets?.active_capability_profiles?.[0];
    if (!primaryTarget) return null;
    const fit = capabilityTargets?.fit_by_capability_profile_id?.[primaryTarget.capability_profile_id];
    const axes = fit?.axes ?? [];
    if (axes.length === 0) return null;
    const covered = axes.filter((axis) => (axis.attainment ?? 0) >= 1).length;
    const total = axes.length;
    return {
      covered,
      total,
      percent: Math.round((covered / total) * 100),
      roleLabel: primaryTarget.role_label,
    };
  }, [capabilityTargets]);
  const capabilityCoveragePercent = primaryTargetCoverage?.percent ?? (dashboard?.kpis.capability_coverage_percent ?? 0);
  const noRolesSelected = !isLoading && (dashboard?.roles.length ?? 0) === 0;
  const verifiedShareTone = resolveVerifiedShareTone(dashboard?.kpis.verified_evidence_share ?? 0);
  const overallHiringSignal = resolveOverallHiringSignal({
    coveragePercent: capabilityCoveragePercent,
    verifiedShare: dashboard?.kpis.verified_evidence_share ?? 0,
  });
  const profileCoverageTone = resolveCoverageTone(dashboard?.ai_literacy.profile_coverage_percent ?? 0);
  const aiLiteracyStatus = dashboard?.ai_literacy.status ?? "not_started";
  const aiLiteracyHasModel = dashboard?.ai_literacy.has_selected_capability_model ?? false;
  const aiLiteracyCardValue =
    aiLiteracyStatus === "not_started" || aiLiteracyStatus === "in_progress" || aiLiteracyStatus === "needs_attention"
      ? formatAiLiteracyStatus(aiLiteracyStatus)
      : `${dashboard?.ai_literacy.profile_coverage_percent ?? 0}%`;
  const aiLiteracyCardTone =
    aiLiteracyStatus === "not_started" || aiLiteracyStatus === "needs_attention"
      ? "warning"
      : aiLiteracyStatus === "in_progress"
        ? "neutral"
        : profileCoverageTone;
  const aiLiteracyCardHelperText =
    aiLiteracyStatus === "not_started"
      ? aiLiteracyHasModel
        ? "No AI Literacy artifact yet. Generate it from your current evidence."
        : "Select a role target first, then generate your AI Literacy Map."
      : aiLiteracyStatus === "in_progress"
        ? "We are evaluating your current evidence."
        : aiLiteracyStatus === "needs_attention"
          ? "Regenerate the artifact after adding stronger evidence."
          : `${dashboard?.ai_literacy.domains_with_profile_signal ?? 0}/${dashboard?.ai_literacy.total_role_relevant_domains ?? 0} role-relevant domains · Recruiter-safe ${dashboard?.ai_literacy.recruiter_safe_coverage_percent ?? 0}%`;
  const aiLiteracyCardCta =
    aiLiteracyStatus === "not_started" || aiLiteracyStatus === "needs_attention"
      ? aiLiteracyHasModel
        ? { label: "Generate map", href: "/student/artifacts#ai-literacy-map" }
        : { label: "Select role target", href: "/student/targets" }
      : undefined;
  const firstName = dashboard?.identity?.first_name ?? null;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-12">
      <section className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[30px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4f6d64] dark:text-slate-400">Capability Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            {`Hi ${firstName ?? "there"}, here's your hiring signal overview`}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#47635a] dark:text-slate-300">{stateLabel}</p>
        </header>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        {!isLoading && dashboard?.alerts?.resume_email_mismatch ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Email mismatch warning</p>
            <p className="mt-1">{dashboard.alerts.resume_email_mismatch.message}</p>
            <p className="mt-1 text-xs">
              Account email: {dashboard.alerts.resume_email_mismatch.auth_email ?? "Unknown"} · Resume email:{" "}
              {dashboard.alerts.resume_email_mismatch.resume_email ?? "Unknown"}
            </p>
            <button
              type="button"
              onClick={() => void dismissResumeMismatchWarning()}
              disabled={isDismissingMismatch}
              className="mt-2 inline-flex rounded-lg border border-amber-500/50 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
            >
              {isDismissingMismatch ? "Dismissing..." : "Dismiss warning"}
            </button>
          </div>
        ) : null}
        {!isLoading && dashboard?.alerts?.extraction_in_progress ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900 dark:border-sky-400/35 dark:bg-sky-500/10 dark:text-sky-200">
            <p className="font-semibold">Extraction in progress</p>
            <p className="mt-1">
              We are still processing your latest uploads. Your capability and trust metrics will update automatically.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {isLoading || !dashboard ? (
            <>
              <div className={`${skeletonClass} h-20`} />
              <div className={`${skeletonClass} h-20`} />
              <div className={`${skeletonClass} h-20`} />
              <div className={`${skeletonClass} h-20`} />
            </>
          ) : (
            <>
              <MetricCard
                label="Capability coverage"
                value={`${capabilityCoveragePercent}%`}
                tone={noRolesSelected ? "warning" : "neutral"}
                helperText={
                  noRolesSelected
                    ? "Baseline mode is capped at 30% until you select a role."
                    : primaryTargetCoverage
                      ? `${primaryTargetCoverage.covered}/${primaryTargetCoverage.total} capability axes covered for your primary role target.`
                      : undefined
                }
                tooltipText="Calculated as met capability axes divided by total required axes for your primary selected role target. An axis is met when candidate score reaches the required level."
              />
              <MetricCard
                label="Verified evidence share"
                value={asPercent(dashboard.kpis.verified_evidence_share)}
                tone={verifiedShareTone}
                cta={
                  verifiedShareTone === "danger"
                    ? { label: "Verify artifacts", href: "/student/artifacts?focus=verification" }
                    : undefined
                }
              />
              <MetricCard
                label="Overall Hiring Signal"
                value={overallHiringSignal.level}
                tone={overallHiringSignal.tone}
                helperText="Adding and verifying a variety of artifacts for your evidence profile will strengthen your overall hiring signal to employers."
                cta={
                  overallHiringSignal.level === "Weak" || overallHiringSignal.level === "Weak-leaning"
                    ? { label: "Fix now", href: "/student/artifacts?focus=verification" }
                    : undefined
                }
              />
              <MetricCard
                label="AI Literacy Profile Coverage"
                value={aiLiteracyCardValue}
                tone={aiLiteracyCardTone}
                helperText={aiLiteracyCardHelperText}
                cta={aiLiteracyCardCta}
              />
            </>
          )}
        </div>

        <article className="mt-6 rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Evidence vs Target</p>
          <p className="mt-1 text-xs text-[#4f6d64] dark:text-slate-400">
            Explanatory view only. It compares target expectations against current evidence coverage for the selected role target axes.
          </p>
          {isTargetsLoading ? (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className={`${skeletonClass} h-[360px]`} />
              <div className={`${skeletonClass} h-[360px]`} />
            </div>
          ) : (capabilityTargets?.active_capability_profiles?.length ?? 0) > 0 ? (
            <div
              className={`mt-3 grid gap-4 ${
                (capabilityTargets?.active_capability_profiles?.length ?? 0) > 1 ? "lg:grid-cols-2" : "lg:grid-cols-1"
              }`}
            >
              {capabilityTargets?.active_capability_profiles.map((target, index) => {
                const fit = capabilityTargets.fit_by_capability_profile_id[target.capability_profile_id];
                const alignmentPercent = fit
                  ? Math.round((fit.alignment_score ?? fit.overall_alignment ?? (fit?.axes?.length ? calculateEvidenceTargetAlignmentPercent(fit.axes) / 100 : 0)) * 100)
                  : null;
                const showPriorityBadge = (capabilityTargets?.active_capability_profiles?.length ?? 0) > 1;
                return (
                  <section
                    key={`target-fit-${target.capability_profile_id}`}
                    className="rounded-xl border border-[#d2e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
                        {target.role_label} @ {target.company_label}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {alignmentPercent !== null ? `Alignment ${alignmentPercent}%` : "Alignment --"}
                        </span>
                        {showPriorityBadge ? (
                          <span className="rounded-full border border-[#bfd2ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#21453a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                            {index === 0 ? "Primary" : "Secondary"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {fit?.confidence_summary ? (
                      <p className="mt-2 text-[11px] text-[#4f6d64] dark:text-slate-400">
                        Confidence {Math.round(fit.confidence_summary.average_confidence * 100)}% ·{" "}
                        {fit.confidence_summary.low_confidence_axis_count}/{fit.confidence_summary.axis_count} axes low confidence
                      </p>
                    ) : null}
                    {fit?.axes?.length ? (
                      <div className="mt-3 space-y-2">
                        {fit.axes
                          .slice()
                          .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0))
                          .map((axis) => {
                            const gapValue = axis.gap ?? 0;
                            const gapLabel = gapValue < 0 ? "Deficit" : gapValue > 0 ? "Surplus" : "Met";
                            const deficitSeverity = Math.abs(Math.round(gapValue * 100));
                            const gapToneClass =
                              gapValue < 0
                                ? deficitSeverity >= 20
                                  ? "text-rose-700 dark:text-rose-300"
                                  : "text-amber-700 dark:text-amber-300"
                                : gapValue > 0
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-[#4f6d64] dark:text-slate-400";
                            const contributionPercent = Math.round(((axis.weighted_contribution ?? 0) * 100 + Number.EPSILON) * 10) / 10;
                            return (
                              <div key={`fit-axis-${target.capability_profile_id}-${axis.capability_id}`} className="rounded-lg border border-[#d7e4de] bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-semibold text-[#1d483c] dark:text-slate-200">{axis.label}</span>
                                  <span className={gapToneClass}>
                                    {gapLabel} {Math.abs(Math.round(gapValue * 100))} pts
                                  </span>
                                </div>
                                <div className="mt-1.5 h-2 w-full rounded-full bg-[#e4efe9] dark:bg-slate-800">
                                  <div
                                    className={`h-2 rounded-full ${
                                      gapValue < 0
                                        ? deficitSeverity >= 20
                                          ? "bg-rose-500"
                                          : "bg-amber-500"
                                        : gapValue > 0
                                          ? "bg-emerald-500"
                                          : "bg-slate-400"
                                    }`}
                                    style={{ width: `${Math.max(0, Math.min(100, Math.round((axis.candidate_score ?? axis.evidence_magnitude ?? 0) * 100)))}%` }}
                                  />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-[#5a766d] dark:text-slate-400">
                                  <span>Score {Math.round((axis.candidate_score ?? axis.evidence_magnitude ?? 0) * 100)}%</span>
                                  <span>Req {Math.round((axis.required_level ?? axis.target_magnitude ?? 0) * 100)}%</span>
                                  <span>Contribution {contributionPercent}%</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                    <div className="mt-3 flex min-h-[320px] items-center justify-center">
                      {fit?.axes && fit.axes.length > 0 ? (
                        <EvidenceTargetRadar
                          axes={fit.axes}
                          ariaLabel={`Evidence vs target for ${target.role_label} at ${target.company_label}`}
                        />
                      ) : (
                        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
                          Fit data is loading. Refresh shortly.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
              <p>No active capability targets selected yet.</p>
              <Link
                href="/student/targets"
                className="mt-2 inline-flex rounded-lg border border-amber-500/50 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-900 transition-colors hover:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
              >
                Open My Roles & Employers
              </Link>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
  helperText,
  cta,
  tooltipText,
}: {
  label: string;
  value: string;
  tone?: MetricTone;
  helperText?: string;
  cta?: { label: string; href: string };
  tooltipText?: string;
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 dark:border-amber-400/35 dark:bg-amber-500/10"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 dark:border-rose-400/35 dark:bg-rose-500/10"
          : "border-[#d2e1db] bg-white dark:border-slate-700 dark:bg-slate-900";
  const valueClasses =
    tone === "success"
      ? "text-emerald-800 dark:text-emerald-200"
      : tone === "warning"
        ? "text-amber-800 dark:text-amber-200"
        : tone === "danger"
          ? "text-rose-800 dark:text-rose-200"
          : "text-[#102922] dark:text-slate-100";

  return (
    <article className={`rounded-xl border p-3 ${toneClasses}`}>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
        <span>{label}</span>
        {tooltipText ? (
          <span className="group relative">
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#bfd2ca] bg-white text-[10px] font-semibold text-[#21453a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              aria-label={`How ${label} is calculated`}
            >
              i
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-6 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-[#d2dfd9] bg-white p-2.5 text-[11px] normal-case leading-4 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            >
              {tooltipText}
            </span>
          </span>
        ) : null}
      </p>
      <p className={`mt-1 text-sm font-semibold ${valueClasses}`}>{value}</p>
      {helperText ? <p className="mt-1 text-[11px] text-[#4f6d64] dark:text-slate-400">{helperText}</p> : null}
      {cta ? (
        <Link
          href={cta.href}
          className="mt-2 inline-flex rounded-lg border border-rose-500/50 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-700 transition-colors hover:bg-rose-100 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-500/15"
        >
          {cta.label}
        </Link>
      ) : null}
    </article>
  );
}
