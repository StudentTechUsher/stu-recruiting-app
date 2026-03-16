"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/mock/ui/Badge";
import { Card } from "@/components/mock/ui/Card";

type DashboardSnapshot = {
  firstName: string;
  artifactCount: number;
  artifactTypeCount: number;
  roleCount: number;
  companyCount: number;
};

type CoachRecommendation = {
  id: string;
  title: string;
  detail: string;
  href: string | null;
  cta: string | null;
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#e4efe9] dark:bg-slate-700/70";

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => (item as string).trim())
    .filter((item) => item.length > 0);
};

const deriveFirstName = (personalInfo: Record<string, unknown>): string => {
  const firstName = asTrimmedString(personalInfo.first_name);
  if (firstName.length > 0) return firstName;

  const fullName = asTrimmedString(personalInfo.full_name);
  if (fullName.length > 0) return fullName.split(/\s+/).filter(Boolean)[0] ?? "Student";

  const email = asTrimmedString(personalInfo.email);
  if (email.length > 0) return email.split("@")[0]?.trim() ?? "Student";

  return "Student";
};

export default function StudentDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    firstName: "Student",
    artifactCount: 0,
    artifactTypeCount: 0,
    roleCount: 0,
    companyCount: 0
  });

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [profileResponse, artifactsResponse] = await Promise.all([
          fetch("/api/student/profile", { cache: "no-store" }),
          fetch("/api/student/artifacts", { cache: "no-store" })
        ]);

        const profilePayload = (await profileResponse.json().catch(() => null)) as
          | { ok: true; data?: { profile?: { personal_info?: Record<string, unknown> }; student_data?: Record<string, unknown> } }
          | { ok: false; error?: string }
          | null;
        const artifactsPayload = (await artifactsResponse.json().catch(() => null)) as
          | { ok: true; data?: { artifacts?: Array<{ artifact_type?: string }> }; artifacts?: Array<{ artifact_type?: string }> }
          | { ok: false; error?: string }
          | null;

        if (!profileResponse.ok || !artifactsResponse.ok || !profilePayload || !profilePayload.ok || !artifactsPayload || !artifactsPayload.ok) {
          throw new Error("dashboard_load_failed");
        }

        if (!active) return;

        const personalInfo = toRecord(profilePayload.data?.profile?.personal_info);
        const studentData = toRecord(profilePayload.data?.student_data);
        const artifactRows = Array.isArray(artifactsPayload.data?.artifacts)
          ? artifactsPayload.data?.artifacts ?? []
          : Array.isArray(artifactsPayload.artifacts)
            ? artifactsPayload.artifacts
            : [];

        const artifactTypes = new Set<string>();
        for (const artifact of artifactRows) {
          const type = asTrimmedString(artifact?.artifact_type);
          if (type.length > 0) artifactTypes.add(type);
        }

        setSnapshot({
          firstName: deriveFirstName(personalInfo),
          artifactCount: artifactRows.length,
          artifactTypeCount: artifactTypes.size,
          roleCount: toStringArray(studentData.target_roles).length,
          companyCount: toStringArray(studentData.target_companies).length
        });
      } catch {
        if (!active) return;
        setLoadError("Unable to load dashboard metrics right now.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const metricCards = useMemo(() => {
    const focusedCoachingMessage =
      "Maintaining 3 or less will help you get better targeted capability coaching, great work!";
    const broadCoachingMessage =
      "Your capability coaching might be too broad, let's see if we can help you hone your approach.";

    const hasNoRoles = snapshot.roleCount === 0;
    const hasNoCompanies = snapshot.companyCount === 0;
    const hasFocusedRoles = snapshot.roleCount > 0 && snapshot.roleCount <= 3;
    const hasFocusedCompanies = snapshot.companyCount > 0 && snapshot.companyCount <= 3;

    return [
      {
        label: "Artifacts",
        value: String(snapshot.artifactCount),
        statusLabel: snapshot.artifactCount === 0 ? "Do now" : "In progress",
        statusClass:
          snapshot.artifactCount === 0
            ? "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100"
            : "bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100",
        body:
          snapshot.artifactCount === 0
            ? "Build your recruiter signal by adding your first artifact."
            : "Keep adding fresh evidence so employers can track your growth over time.",
        href: "/student/artifacts?openAddArtifact=true",
        cta: "Add New Artifact"
      },
      {
        label: "Artifact Types",
        value: String(snapshot.artifactTypeCount),
        statusLabel: snapshot.artifactTypeCount >= 3 ? "On track" : "Do now",
        statusClass:
          snapshot.artifactTypeCount >= 3
            ? "bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100"
            : "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100",
        body: "A variety of artifact types helps employers know the range of your skills",
        href: "/student/artifacts",
        cta: "Open Artifact Repository"
      },
      {
        label: "Target Roles",
        value: String(snapshot.roleCount),
        statusLabel: hasNoRoles ? "Do now" : hasFocusedRoles ? "Focused" : "Needs focus",
        statusClass: hasNoRoles
          ? "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100"
          : hasFocusedRoles
            ? "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100"
            : "bg-[#fff5e8] text-[#7a4d20] dark:bg-amber-500/20 dark:text-amber-100",
        body: hasNoRoles
          ? "Select a few target roles so your capability coaching can stay relevant and actionable."
          : hasFocusedRoles
            ? focusedCoachingMessage
            : broadCoachingMessage,
        href: hasNoRoles ? "/student/targets" : hasFocusedRoles ? null : "/student/capability-coach",
        cta: hasNoRoles ? "Open My Positions & Employers" : hasFocusedRoles ? null : "Open Capability Coach"
      },
      {
        label: "Target Companies",
        value: String(snapshot.companyCount),
        statusLabel: hasNoCompanies ? "Do now" : hasFocusedCompanies ? "Focused" : "Needs focus",
        statusClass: hasNoCompanies
          ? "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100"
          : hasFocusedCompanies
            ? "bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100"
            : "bg-[#fff5e8] text-[#7a4d20] dark:bg-amber-500/20 dark:text-amber-100",
        body: hasNoCompanies
          ? "Select a few target employers so your capability coaching can be tailored to real hiring contexts."
          : hasFocusedCompanies
            ? focusedCoachingMessage
            : broadCoachingMessage,
        href: hasNoCompanies ? "/student/targets" : hasFocusedCompanies ? null : "/student/capability-coach",
        cta: hasNoCompanies ? "Open My Positions & Employers" : hasFocusedCompanies ? null : "Open Capability Coach"
      }
    ];
  }, [snapshot.artifactCount, snapshot.artifactTypeCount, snapshot.companyCount, snapshot.roleCount]);

  const draftCoachRecommendations = useMemo<CoachRecommendation[]>(() => {
    const evidenceRecommendation: CoachRecommendation =
      snapshot.artifactCount === 0
        ? {
            id: "coach-evidence-first",
            title: "Start your evidence signal",
            detail: "Add your first artifact so Personal Career Coach can calibrate recommendations to your real work.",
            href: "/student/artifacts?openAddArtifact=true",
            cta: "Add New Artifact"
          }
        : snapshot.artifactTypeCount < 3
          ? {
              id: "coach-evidence-diversify",
              title: "Diversify your evidence types",
              detail: "A broader mix of artifact types will help your coach identify a wider range of strengths.",
              href: "/student/artifacts",
              cta: "Open Artifact Repository"
            }
          : {
              id: "coach-evidence-refresh",
              title: "Keep evidence current",
              detail: "You have a strong evidence base. Add one new artifact this week to keep momentum visible.",
              href: "/student/artifacts?openAddArtifact=true",
              cta: "Add New Artifact"
            };

    const targetingRecommendation: CoachRecommendation =
      snapshot.roleCount === 0 || snapshot.companyCount === 0
        ? {
            id: "coach-targets-set",
            title: "Set your role and employer targets",
            detail: "Choose a few positions and employers so your coach can personalize advice to your hiring goals.",
            href: "/student/targets",
            cta: "Open My Positions & Employers"
          }
        : snapshot.roleCount > 3 || snapshot.companyCount > 3
          ? {
              id: "coach-targets-focus",
              title: "Narrow your target scope",
              detail: "Your coaching context is broad right now. Tightening to three or fewer targets improves precision.",
              href: "/student/capability-coach",
              cta: "Open Capability Coach"
            }
          : {
              id: "coach-targets-healthy",
              title: "Target scope looks healthy",
              detail: "Your roles and employers are focused enough for high-quality coaching recommendations.",
              href: null,
              cta: null
            };

    const planningRecommendation: CoachRecommendation = {
      id: "coach-plan-preview",
      title: "Preview Personal Career Coach",
      detail:
        "Capability Coach will soon deliver ranked weekly actions based on your artifacts, target scope, and skill progression.",
      href: "/student/capability-coach",
      cta: "View Capability Coach Preview"
    };

    return [evidenceRecommendation, targetingRecommendation, planningRecommendation];
  }, [snapshot.artifactCount, snapshot.artifactTypeCount, snapshot.companyCount, snapshot.roleCount]);

  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <section aria-labelledby="student-dashboard-title" className="w-full px-6 py-12 lg:px-8">
        <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
              Student Capability Dashboard
            </p>
            {isLoading ? (
              <>
                <div className={`${skeletonBlockClassName} mt-3 h-9 w-80 max-w-full`} />
                <div className={`${skeletonBlockClassName} mt-3 h-4 w-full max-w-2xl`} />
              </>
            ) : (
              <>
                <h2 id="student-dashboard-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
                  Welcome back, {snapshot.firstName}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
                  Focus on the highest-impact next steps to strengthen your readiness and improve coaching quality.
                </p>
              </>
            )}
          </header>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <Card key={`metric-skeleton-${index}`} className="bg-white/95 p-4 dark:bg-slate-900/80">
                    <div aria-hidden="true" className="animate-pulse">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`${skeletonBlockClassName} h-3 w-24`} />
                        <div className={`${skeletonBlockClassName} h-5 w-16 rounded-full`} />
                      </div>
                      <div className={`${skeletonBlockClassName} mt-3 h-9 w-14`} />
                      <div className={`${skeletonBlockClassName} mt-2 h-3 w-4/5`} />
                      <div className={`${skeletonBlockClassName} mt-2 h-3 w-full`} />
                      <div className={`${skeletonBlockClassName} mt-3 h-9 w-full`} />
                    </div>
                  </Card>
                ))
              : metricCards.map((metric) => (
                  <Card
                    key={metric.label}
                    className="bg-white/95 p-4 dark:bg-slate-900/80"
                    header={
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">{metric.label}</h3>
                        <Badge className={metric.statusClass}>{metric.statusLabel}</Badge>
                      </div>
                    }
                  >
                    <p className="text-3xl font-semibold text-[#0f2b23] dark:text-slate-100">{metric.value}</p>
                    <p className="mt-2 min-h-[5rem] text-xs leading-5 text-[#4c6860] dark:text-slate-300">{metric.body}</p>
                    {metric.href && metric.cta ? (
                      <div className="mt-3">
                        <Link
                          href={metric.href}
                          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {metric.cta}
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-medium text-[#4c6860] dark:text-slate-300">No action needed right now.</p>
                    )}
                  </Card>
                )))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Personal Career Coach</h3>
                  <Badge className="bg-[#fff5e8] text-[#7a4d20] dark:bg-amber-500/20 dark:text-amber-100">Draft recommendations</Badge>
                </div>
              }
            >
              {isLoading ? (
                <div aria-hidden="true" className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`coach-draft-skeleton-${index}`} className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className={`${skeletonBlockClassName} h-3 w-2/3`} />
                      <div className={`${skeletonBlockClassName} mt-2 h-3 w-full`} />
                      <div className={`${skeletonBlockClassName} mt-2 h-3 w-5/6`} />
                      <div className={`${skeletonBlockClassName} mt-3 h-8 w-40`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {draftCoachRecommendations.map((recommendation) => (
                    <div
                      key={recommendation.id}
                      className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900 flex flex-col justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{recommendation.title}</p>
                        <p className="mt-2 text-xs leading-5 text-[#4c6860] dark:text-slate-300">{recommendation.detail}</p>
                      </div>
                      {recommendation.href && recommendation.cta ? (
                        <div className="mt-3">
                          <Link
                            href={recommendation.href}
                            className="inline-flex h-8 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {recommendation.cta}
                          </Link>
                        </div>
                      ) : (
                        <p className="mt-3 text-[11px] font-medium text-[#4c6860] dark:text-slate-300">No action needed right now.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Employer Spotlight</h3>
                  <Badge className="bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100">Sponsored matches</Badge>
                </div>
              }
            >
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-4 dark:border-slate-700 dark:bg-slate-900 flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl dark:bg-indigo-900/50 dark:text-indigo-300">
                    A
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-[#14372d] dark:text-slate-100">Acme Corp</h4>
                    <p className="mt-1 text-xs leading-5 text-[#4c6860] dark:text-slate-300">
                      Your capability vector is a high match for their Software Engineering roles. They are actively seeking students with your artifact signal.
                    </p>
                    <Link
                      href="#"
                      className="mt-3 inline-flex h-8 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      View Openings
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-4 dark:border-slate-700 dark:bg-slate-900 flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl dark:bg-emerald-900/50 dark:text-emerald-300">
                    G
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-[#14372d] dark:text-slate-100">Global Tech</h4>
                    <p className="mt-1 text-xs leading-5 text-[#4c6860] dark:text-slate-300">
                      Based on your recent Systems Architecture artifacts, you are a glowing match for our Summer Internship program.
                    </p>
                    <Link
                      href="#"
                      className="mt-3 inline-flex h-8 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {loadError ? (
            <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {loadError}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
