"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CapabilityRadar, type CapabilityRadarAxis } from "@/components/student/CapabilityRadar";
import { EvidenceTargetRadar, type EvidenceTargetRadarAxis } from "@/components/student/EvidenceTargetRadar";

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
  axes: EvidenceTargetRadarAxis[];
  generated_at: string;
  evidence_freshness_marker: string;
};

type CapabilityTargetsPayload = {
  active_capability_profiles: ActiveCapabilityProfile[];
  fit_by_capability_profile_id: Record<string, CapabilityProfileFit>;
};

type ProfilePayload = {
  profile?: {
    personal_info?: Record<string, unknown>;
  };
};

type MetricTone = "neutral" | "success" | "warning" | "danger";
type RadarTab = "soft" | "role";

const skeletonClass = "animate-pulse rounded-xl bg-[#dde9e3] dark:bg-slate-700/70";

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const resolveFirstName = (personalInfo: Record<string, unknown>): string | null => {
  const explicitFirstName = asTrimmedString(personalInfo.first_name);
  if (explicitFirstName.length > 0) return explicitFirstName;

  const fullName = asTrimmedString(personalInfo.full_name);
  if (fullName.length > 0) {
    const firstToken = fullName.split(/\s+/).filter(Boolean)[0] ?? "";
    if (firstToken.length > 0) return firstToken;
  }

  const email = asTrimmedString(personalInfo.email);
  if (email.length > 0) {
    const local = email.split("@")[0]?.trim() ?? "";
    if (local.length > 0) return local;
  }

  return null;
};

const formatTimestamp = (value: string | null): string => {
  if (!value) return "No evidence yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No evidence yet";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const resolveVerifiedShareTone = (share: number): MetricTone => {
  if (share >= 0.7) return "success";
  if (share >= 0.4) return "warning";
  return "danger";
};

const resolvePendingShareTone = (share: number): MetricTone => {
  if (share <= 0.3) return "success";
  if (share <= 0.6) return "warning";
  return "danger";
};

const mapDashboardAxisToRadarAxis = (axis: DashboardAxis): CapabilityRadarAxis => {
  const verified = axis.verification_breakdown.verified;
  const pendingOrUnverified = axis.verification_breakdown.pending + axis.verification_breakdown.unverified;
  const magnitude = axis.covered ? (verified > 0 ? 1 : pendingOrUnverified > 0 ? 0.65 : 0.5) : 0;
  return {
    id: axis.capability_id,
    label: axis.label,
    magnitude,
  };
};

export default function StudentDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTargetsLoading, setIsTargetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [capabilityTargets, setCapabilityTargets] = useState<CapabilityTargetsPayload | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isDismissingMismatch, setIsDismissingMismatch] = useState(false);
  const [mobileRadarTab, setMobileRadarTab] = useState<RadarTab>("soft");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [dashboardResponse, profileResponse] = await Promise.all([
          fetch("/api/student/dashboard", { cache: "no-store" }),
          fetch("/api/student/profile", { cache: "no-store" }),
        ]);
        const payload = (await dashboardResponse.json().catch(() => null)) as
          | { ok: true; data?: { dashboard?: DashboardPayload } }
          | { ok: false; error?: string }
          | null;
        if (!dashboardResponse.ok || !payload || !payload.ok || !payload.data?.dashboard) {
          throw new Error("dashboard_load_failed");
        }

        const profilePayload = (await profileResponse.json().catch(() => null)) as
          | { ok: true; data?: ProfilePayload }
          | { ok: false; error?: string }
          | null;
        const maybeFirstName = profilePayload?.ok
          ? resolveFirstName(profilePayload.data?.profile?.personal_info ?? {})
          : null;

        if (!active) return;
        setDashboard(payload.data.dashboard);
        setFirstName(maybeFirstName);
      } catch {
        if (!active) return;
        setError("Unable to load dashboard right now.");
      } finally {
        if (active) setIsLoading(false);
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
        const response = await fetch("/api/student/capability-profiles", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data?: CapabilityTargetsPayload }
          | { ok: false; error?: string }
          | null;
        if (!response.ok || !payload || !payload.ok || !payload.data) {
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

  const axes = useMemo(() => {
    return (dashboard?.axes ?? []).filter((axis) => axis.capability_class !== "fallback");
  }, [dashboard?.axes]);
  const softSkillAxes = useMemo(() => {
    return axes.filter((axis) => axis.capability_class === "soft_skill");
  }, [axes]);
  const roleSkillAxes = useMemo(() => {
    return axes.filter((axis) => axis.capability_class === "role_capability");
  }, [axes]);
  const softSkillRadarAxes = useMemo<CapabilityRadarAxis[]>(() => softSkillAxes.map(mapDashboardAxisToRadarAxis), [softSkillAxes]);
  const roleSkillRadarAxes = useMemo<CapabilityRadarAxis[]>(() => roleSkillAxes.map(mapDashboardAxisToRadarAxis), [roleSkillAxes]);

  const stateLabel = useMemo(() => {
    const state = dashboard?.state;
    if (state === "no_evidence") return "Add evidence to populate capability coverage.";
    if (state === "partial_no_verification") return "Evidence found. Verify artifacts to improve trust labels.";
    if (state === "full_low_trust") return "Coverage complete. Verification is the current priority.";
    return "Keep your evidence profile current.";
  }, [dashboard?.state]);
  const noRolesSelected = !isLoading && (dashboard?.roles.length ?? 0) === 0;
  const roleRadarEmpty = !isLoading && roleSkillRadarAxes.length === 0;
  const verifiedShareTone = resolveVerifiedShareTone(dashboard?.kpis.verified_evidence_share ?? 0);
  const pendingShareTone = resolvePendingShareTone(dashboard?.kpis.pending_unverified_share ?? 0);

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
                value={`${dashboard.kpis.capability_coverage_percent}%`}
                tone={noRolesSelected ? "warning" : "neutral"}
                helperText={noRolesSelected ? "Baseline mode is capped at 30% until you select a role." : undefined}
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
                label="Pending + unverified share"
                value={asPercent(dashboard.kpis.pending_unverified_share)}
                tone={pendingShareTone}
                cta={
                  pendingShareTone === "danger"
                    ? { label: "Fix now", href: "/student/artifacts?focus=verification" }
                    : undefined
                }
              />
              <MetricCard label="Last updated" value={formatTimestamp(dashboard.kpis.last_updated_at)} />
            </>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Capability Radar</p>
            <p className="mt-1 text-xs text-[#4f6d64] dark:text-slate-400">
              Separate views for universal baseline skills and role-specific capability coverage.
            </p>

            {!isLoading ? (
              <div className="mt-3 inline-flex rounded-xl border border-[#cadad3] bg-[#f2f8f5] p-1 lg:hidden dark:border-slate-700 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMobileRadarTab("soft")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    mobileRadarTab === "soft"
                      ? "bg-white text-[#12392f] shadow-sm dark:bg-slate-900 dark:text-slate-100"
                      : "text-[#4f6d64] dark:text-slate-300"
                  }`}
                >
                  Soft Skills
                </button>
                <button
                  type="button"
                  onClick={() => setMobileRadarTab("role")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    mobileRadarTab === "role"
                      ? "bg-white text-[#12392f] shadow-sm dark:bg-slate-900 dark:text-slate-100"
                      : "text-[#4f6d64] dark:text-slate-300"
                  }`}
                >
                  Role Skills
                </button>
              </div>
            ) : null}

            <div className="mt-4 lg:hidden">
              <CapabilityRadarPanel
                title={mobileRadarTab === "soft" ? "Soft Skills Radar" : "Role Skills Radar"}
                subtitle={
                  mobileRadarTab === "soft"
                    ? "Universal baseline capabilities tracked for all students."
                    : "Role-required capabilities based on selected target roles."
                }
                axes={mobileRadarTab === "soft" ? softSkillRadarAxes : roleSkillRadarAxes}
                isLoading={isLoading || !dashboard}
                ariaLabel={mobileRadarTab === "soft" ? "Soft skills capability radar" : "Role skills capability radar"}
                emptyMessage={
                  mobileRadarTab === "role"
                    ? noRolesSelected
                      ? "Select at least one role to unlock role-skill tracking."
                      : "No role capability mapping available yet for selected roles."
                    : "No soft-skill evidence linked yet."
                }
                emptyCta={
                  mobileRadarTab === "role"
                    ? { label: "Select role targets", href: "/student/targets" }
                    : { label: "Add artifacts", href: "/student/artifacts?openAddArtifact=true" }
                }
              />
            </div>

            <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-2">
              <CapabilityRadarPanel
                title="Soft Skills Radar"
                subtitle="Universal baseline capabilities tracked for all students."
                axes={softSkillRadarAxes}
                isLoading={isLoading || !dashboard}
                ariaLabel="Soft skills capability radar"
                emptyMessage="No soft-skill evidence linked yet."
                emptyCta={{ label: "Add artifacts", href: "/student/artifacts?openAddArtifact=true" }}
              />
              <CapabilityRadarPanel
                title="Role Skills Radar"
                subtitle="Role-required capabilities based on selected target roles."
                axes={roleSkillRadarAxes}
                isLoading={isLoading || !dashboard}
                ariaLabel="Role skills capability radar"
                emptyMessage={
                  noRolesSelected
                    ? "Select at least one role to unlock role-skill tracking."
                    : roleRadarEmpty
                      ? "No role capability mapping available yet for selected roles."
                      : "No role-skill evidence linked yet."
                }
                emptyCta={{ label: "Select role targets", href: "/student/targets" }}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Actions</p>
            <h2 className="mt-2 text-xl font-semibold text-[#102922] dark:text-slate-100">Strengthen your evidence signal</h2>
            <p className="mt-2 text-sm text-[#466258] dark:text-slate-300">
              Capabilities shown here are derived from linked artifacts and verification states.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {isLoading || !dashboard ? (
                <>
                  <div className={`${skeletonClass} h-9 w-36`} />
                  <div className={`${skeletonClass} h-9 w-44`} />
                </>
              ) : (
                <>
                  <Link
                    href={dashboard.primary_cta.href}
                    className="inline-flex h-9 items-center rounded-xl bg-[#117b56] px-4 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0f6a4b]"
                  >
                    {dashboard.primary_cta.label}
                  </Link>
                  <Link
                    href={dashboard.secondary_cta.href}
                    className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {dashboard.secondary_cta.label}
                  </Link>
                </>
              )}
            </div>

            {!isLoading && dashboard ? (
              <div className="mt-5 rounded-xl border border-[#d9e6df] bg-[#f7fcf9] p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
                  Role context
                </p>
                <p className="mt-1 text-sm text-[#2f4f44] dark:text-slate-200">
                  {dashboard.roles.length > 0 ? dashboard.roles.join(", ") : "No selected role targets yet"}
                </p>
                <p className="mt-2 text-xs text-[#4f6d64] dark:text-slate-400">
                  Evidence count: {dashboard.kpis.evidence_count}
                </p>
              </div>
            ) : null}
          </article>
        </div>

        <article className="mt-6 rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Evidence vs Target</p>
          <p className="mt-1 text-xs text-[#4f6d64] dark:text-slate-400">
            Explanatory view only. It compares target expectations against current evidence coverage by capability axis.
          </p>
          {isTargetsLoading ? (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className={`${skeletonClass} h-[360px]`} />
              <div className={`${skeletonClass} h-[360px]`} />
            </div>
          ) : (capabilityTargets?.active_capability_profiles?.length ?? 0) > 0 ? (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {capabilityTargets?.active_capability_profiles.map((target, index) => {
                const fit = capabilityTargets.fit_by_capability_profile_id[target.capability_profile_id];
                return (
                  <section
                    key={`target-fit-${target.capability_profile_id}`}
                    className="rounded-xl border border-[#d2e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
                        {target.role_label} @ {target.company_label}
                      </p>
                      <span className="rounded-full border border-[#bfd2ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#21453a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                        {index === 0 ? "Primary" : "Secondary"}
                      </span>
                    </div>
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

function CapabilityRadarPanel({
  title,
  subtitle,
  axes,
  isLoading,
  ariaLabel,
  emptyMessage,
  emptyCta,
}: {
  title: string;
  subtitle: string;
  axes: CapabilityRadarAxis[];
  isLoading: boolean;
  ariaLabel: string;
  emptyMessage: string;
  emptyCta?: { label: string; href: string };
}) {
  return (
    <section className="rounded-xl border border-[#d2e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">{title}</p>
      <p className="mt-1 text-xs text-[#4f6d64] dark:text-slate-400">{subtitle}</p>
      <div className="mt-3 flex min-h-[350px] items-center justify-center overflow-visible">
        {isLoading ? (
          <div className={`${skeletonClass} h-[320px] w-[320px] rounded-full`} />
        ) : axes.length > 0 ? (
          <CapabilityRadar
            axes={axes}
            ariaLabel={ariaLabel}
            className="h-[380px] w-full max-w-[520px]"
            labelFontSize={13}
          />
        ) : (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
            <p>{emptyMessage}</p>
            {emptyCta ? (
              <Link
                href={emptyCta.href}
                className="mt-2 inline-flex rounded-lg border border-amber-500/50 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-900 transition-colors hover:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
              >
                {emptyCta.label}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
  helperText,
  cta,
}: {
  label: string;
  value: string;
  tone?: MetricTone;
  helperText?: string;
  cta?: { label: string; href: string };
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">{label}</p>
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
