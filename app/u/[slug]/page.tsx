import Link from "next/link";
import { EvidenceTargetRadar } from "@/components/student/EvidenceTargetRadar";
import { getPublicStudentShareProfileBySlug } from "@/lib/public/student-share-profile";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

const formatRelativeUpdatedAt = (value: string | null): string => {
  if (!value) return "No recent updates";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "No recent updates";

  const minutes = Math.round((Date.now() - parsed) / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
};

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;

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

const hiringSignalToneClass: Record<string, string> = {
  Weak: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200",
  "Weak-leaning":
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200",
  Moderate: "border-[#d2e1db] bg-white text-[#21453a] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  "Strong-leaning":
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200",
  Strong: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200",
};

const verificationToneClass: Record<string, string> = {
  verified:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200",
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200",
  unverified:
    "border-[#d2e1db] bg-white text-[#21453a] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

export default async function PublicStudentShareProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const profile = await getPublicStudentShareProfileBySlug(resolvedParams.slug);

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="w-full max-w-xl rounded-3xl border border-[#d3e1da] bg-[#f8fcfa] p-8 text-center dark:border-slate-700 dark:bg-slate-900/75">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4a675f] dark:text-slate-400">Public profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            Profile not found
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#4b685f] dark:text-slate-300">
            This profile URL does not match an active candidate profile in this environment.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl border border-[#c7d8d1] bg-white px-4 py-2 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#f0f7f4] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-10">
      <section className="mx-auto max-w-6xl rounded-3xl border border-[#d3e1da] bg-[#f8fcfa] p-4 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75 md:p-6">
        <header className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[#bfd2ca] bg-[#e8f2ed] text-lg font-semibold text-[#1f4338] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {profile.candidate.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.candidate.avatar_url}
                    alt={`${profile.candidate.full_name} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialsFromName(profile.candidate.full_name)
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4a675f] dark:text-slate-400">
                  Candidate profile
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-3xl">
                  {profile.candidate.full_name}
                </h1>
                {profile.candidate.education_summary ? (
                  <p className="mt-1 text-base font-semibold text-[#21453a] dark:text-slate-200">
                    {profile.candidate.education_summary}
                  </p>
                ) : null}
                {profile.candidate.headline && !profile.candidate.education_summary ? (
                  <p className="mt-1 text-sm text-[#44645b] dark:text-slate-300">{profile.candidate.headline}</p>
                ) : null}
                {profile.candidate.location ? (
                  <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">{profile.candidate.location}</p>
                ) : null}
              </div>
            </div>
          </div>

          {profile.candidate.target_roles.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.candidate.target_roles.map((role) => (
                <span
                  key={`target-role-${role}`}
                  className="inline-flex items-center rounded-full border border-[#bfd2ca] bg-[#f4faf7] px-3 py-1 text-xs font-semibold text-[#21453a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {role}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-[#d2e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Capability coverage</p>
            <p className="mt-1 text-lg font-semibold text-[#102922] dark:text-slate-100">
              {profile.signals.capability_coverage_percent}%
            </p>
          </article>
          <article className="rounded-xl border border-[#d2e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Verified evidence share</p>
            <p className="mt-1 text-lg font-semibold text-[#102922] dark:text-slate-100">
              {asPercent(profile.signals.verified_evidence_share)}
            </p>
          </article>
          <article
            className={`rounded-xl border p-3 ${
              hiringSignalToneClass[profile.signals.overall_hiring_signal] ?? hiringSignalToneClass.Moderate
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Overall hiring signal</p>
            <p className="mt-1 text-lg font-semibold">{profile.signals.overall_hiring_signal}</p>
          </article>
        </section>

        <section className="mt-4 rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Evidence vs Target</p>
              <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">
                Current evidence coverage mapped to selected role-target axes for each employer target.
              </p>
            </div>
            <p className="text-xs text-[#557168] dark:text-slate-400">
              {formatRelativeUpdatedAt(profile.signals.last_updated_at)}
            </p>
          </div>

          {profile.targets.length > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {profile.targets.map((target) => (
                <article
                  key={`public-target-${target.capability_profile_id}`}
                  className="rounded-xl border border-[#d2e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
                      {target.role_label} @ {target.company_label}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-[#bfd2ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#21453a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                        {target.priority_label}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {target.alignment_score !== null
                          ? `Alignment ${Math.round(target.alignment_score * 100)}%`
                          : target.alignment_percent !== null
                            ? `Alignment ${target.alignment_percent}%`
                            : "Alignment --"}
                      </span>
                    </div>
                  </div>
                  {target.confidence_summary ? (
                    <p className="mt-2 text-[11px] text-[#557168] dark:text-slate-400">
                      Confidence {Math.round(target.confidence_summary.average_confidence * 100)}% ·{" "}
                      {target.confidence_summary.low_confidence_axis_count}/{target.confidence_summary.axis_count} axes low confidence
                    </p>
                  ) : null}
                  {target.axes.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {target.axes
                        .slice()
                        .sort((a, b) => a.gap - b.gap)
                        .map((axis) => {
                          const deficitSeverity = Math.abs(Math.round(axis.gap * 100));
                          const gapToneClass =
                            axis.gap < 0
                              ? deficitSeverity >= 20
                                ? "text-rose-700 dark:text-rose-300"
                                : "text-amber-700 dark:text-amber-300"
                              : axis.gap > 0
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-[#557168] dark:text-slate-400";
                          return (
                            <div
                              key={`public-axis-summary-${target.capability_profile_id}-${axis.capability_id}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-[#d5e3dc] bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                            >
                              <span className="font-semibold text-[#1a4337] dark:text-slate-200">{axis.label}</span>
                              <span className={gapToneClass}>
                                {Math.round(axis.candidate_score * 100)}% / {Math.round(axis.required_level * 100)}% ·{" "}
                                {axis.gap < 0 ? "Deficit" : axis.gap > 0 ? "Surplus" : "Met"} · {axis.confidence_level}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                  <div className="mt-3 flex min-h-[300px] items-center justify-center">
                    {target.axes.length > 0 ? (
                      <EvidenceTargetRadar
                        axes={target.axes}
                        ariaLabel={`Evidence vs target for ${target.role_label} at ${target.company_label}`}
                      />
                    ) : (
                      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
                        No capability target data available for this role-employer combination yet.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#d2e1db] bg-[#f8fcfa] px-3 py-3 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No role-employer targets selected yet.
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">
              Evidence profile
            </p>
            <p className="text-xs text-[#557168] dark:text-slate-400">
              {profile.artifacts.length} artifacts · {profile.signals.total_linked_evidence} linked capability signals
            </p>
          </div>

          {profile.capability_summary.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.capability_summary.map((capability) => (
                <span
                  key={`capability-summary-${capability.capability_id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-[#d2e1db] bg-[#f8fcfa] px-2 py-1 text-xs text-[#33594d] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="font-semibold">{capability.label}</span>
                  <span>({capability.evidence_count})</span>
                </span>
              ))}
            </div>
          ) : null}

          {profile.artifacts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {profile.artifacts.map((artifact) => (
                <article
                  key={artifact.artifact_id}
                  className="rounded-xl border border-[#d2e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#163b31] dark:text-slate-100">{artifact.title}</p>
                      <p className="text-xs text-[#557168] dark:text-slate-400">
                        {artifact.source} · {artifact.capability_label}
                      </p>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        verificationToneClass[artifact.verification_status] ?? verificationToneClass.unverified
                      }`}
                    >
                      {artifact.verification_status}
                    </span>
                  </div>
                  {artifact.description ? (
                    <p className="mt-2 text-sm text-[#33594d] dark:text-slate-300">{artifact.description}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[#557168] dark:text-slate-400">{formatRelativeUpdatedAt(artifact.updated_at)}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#d2e1db] bg-[#f8fcfa] px-3 py-3 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No artifacts shared yet.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
