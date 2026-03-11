"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect } from "react";
import { useFeatureFlags } from "@/components/FeatureFlagsProvider";
import {
  getFirstReleasedStudentRoute,
  isStudentPathReleased,
  type StudentViewReleaseKey
} from "@/lib/feature-flags";
import { ChartIcon, LayersIcon, LoopIcon, ModelIcon } from "@/components/mock/ui/Icons";

type Audience = "recruiter" | "student" | "admin";

type NavItem = {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  releaseKey?: StudentViewReleaseKey;
};

const CandidateIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
    <path d="M5 20a7 7 0 0114 0" />
  </svg>
);

const GuidanceIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 3l1.8 3.8L18 8.2l-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4.2-1.4L12 3z" />
    <path d="M12 16.5V21" />
  </svg>
);

const InterviewPrepIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="8" cy="8" r="2.5" />
    <circle cx="16" cy="8" r="2.5" />
    <path d="M3.5 18a4.5 4.5 0 019 0" />
    <path d="M11.5 18a4.5 4.5 0 019 0" />
  </svg>
);

const recruiterNavItems: NavItem[] = [
  {
    key: "recruiter-model",
    label: "Capability Model",
    shortLabel: "Model",
    description: "Define role-aligned scoring standards",
    icon: ModelIcon,
    href: "/recruiter/capability-models"
  },
  {
    key: "recruiter-pipeline",
    label: "Pipeline Overview",
    shortLabel: "Pipeline",
    description: "Inspect readiness and signal density",
    icon: ChartIcon,
    href: "/recruiter/pipeline"
  },
  {
    key: "recruiter-import",
    label: "Off-Platform Scoring",
    shortLabel: "Import",
    description: "Import and score external candidates",
    icon: LayersIcon,
    href: "/recruiter/off-platform-scoring"
  },
  {
    key: "recruiter-candidates",
    label: "Candidate Explorer",
    shortLabel: "Candidates",
    description: "Review evidence, videos, and references",
    icon: CandidateIcon,
    href: "/recruiter/candidates"
  },
  {
    key: "recruiter-calibration",
    label: "Outcome Calibration",
    shortLabel: "Calibration",
    description: "Apply outcome feedback to scoring",
    icon: LoopIcon,
    href: "/recruiter/outcomes"
  }
];

const studentNavItems: NavItem[] = [
  {
    key: "student-dashboard",
    label: "Capability Dashboard",
    shortLabel: "Dashboard",
    description: "Track readiness and priority actions",
    icon: ChartIcon,
    href: "/student/dashboard",
    releaseKey: "capabilityDashboard"
  },
  {
    key: "student-artifacts",
    label: "Artifact Repository",
    shortLabel: "Artifacts",
    description: "Manage projects, work samples, and evidence",
    icon: LayersIcon,
    href: "/student/artifacts",
    releaseKey: "artifactRepository"
  },
  {
    key: "student-pathway",
    label: "Pathway Planner",
    shortLabel: "Pathway",
    description: "Plan milestones by impact and timeline",
    icon: LoopIcon,
    href: "/student/pathway",
    releaseKey: "pathwayPlanner"
  },
  {
    key: "student-guidance",
    label: "AI Guidance",
    shortLabel: "Guidance",
    description: "Get coaching with rationale and next steps",
    icon: GuidanceIcon,
    href: "/student/guidance",
    releaseKey: "aiGuidance"
  },
  {
    key: "student-interview-prep",
    label: "Interview Prep",
    shortLabel: "Interview",
    description: "Practice AI-adapted employer questions and review session scoring",
    icon: InterviewPrepIcon,
    href: "/student/interview-prep",
    releaseKey: "interviewPrep"
  },
  {
    key: "student-profile",
    label: "Profile",
    shortLabel: "Profile",
    description: "Manage profile details, links, and focus targets",
    icon: CandidateIcon,
    href: "/student/profile",
    releaseKey: "manageRoles"
  }
];

const adminNavItems: NavItem[] = [
  {
    key: "admin-assignments",
    label: "Recruiter Assignments",
    shortLabel: "Assignments",
    description: "Manage ABAC position access",
    icon: ModelIcon,
    href: "/admin/recruiter-assignments"
  }
];

const getNavItems = (audience: Audience) => {
  if (audience === "recruiter") return recruiterNavItems;
  if (audience === "student") return studentNavItems;
  return adminNavItems;
};

export function AppNavigationShell({
  audience,
  children,
  showNavigation = true
}: {
  audience: Audience;
  children: ReactNode;
  showNavigation?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { studentViewReleaseFlags } = useFeatureFlags();
  const baseNavItems = getNavItems(audience);
  const navItems =
    audience !== "student"
      ? baseNavItems
      : baseNavItems.filter((item) => (item.releaseKey ? studentViewReleaseFlags[item.releaseKey] : true));
  const mobileBottomNavItems =
    audience === "student"
      ? baseNavItems.filter((item) => item.key === "student-artifacts" || item.key === "student-profile")
      : [];
  const showMobileBottomNav = audience === "student" && mobileBottomNavItems.length > 0;

  useEffect(() => {
    if (audience !== "student") return;
    if (isStudentPathReleased(pathname, studentViewReleaseFlags)) return;

    router.replace(getFirstReleasedStudentRoute(studentViewReleaseFlags));
  }, [audience, pathname, router, studentViewReleaseFlags]);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-[#f1f7f4] text-[#0a1f1a] dark:bg-slate-950 dark:text-slate-100">
      {showNavigation ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[300px] border-r border-[#cad9d2] bg-white/90 p-4 backdrop-blur lg:block dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex h-full flex-col overflow-y-auto">
            <Link
              href={navItems[0]?.href ?? "/"}
              className="self-start text-3xl font-bold leading-none tracking-tight text-[#0a1f1a] transition-opacity hover:opacity-80 dark:text-slate-100"
              aria-label="Go to first app view"
            >
              stu.
            </Link>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#446258] dark:text-slate-400">
              {audience === "admin" ? "Admin Navigation" : `${audience === "recruiter" ? "Recruiter" : "Student"} Navigation`}
            </p>

            <nav className="mt-2 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={`sidebar-${audience}-${item.key}`}
                    href={item.href}
                    className={`block w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10"
                        : "border-[#d4e1db] bg-white hover:bg-[#f2f8f5] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-[#12f987] text-[#0a1f1a]"
                            : "bg-[#e9f2ee] text-[#2b4b41] dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-[#143a2f] dark:text-slate-100">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-[#4a665d] dark:text-slate-300">{item.description}</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <form action="/api/auth/logout" method="post" className="mt-auto pt-4">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#cddbd5] bg-[#f5fbf8] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#2a4d41] hover:bg-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </aside>
      ) : null}

      <div className={`flex min-h-[100dvh] w-full ${showNavigation ? "lg:pl-[300px]" : ""}`}>
        <div className={`min-w-0 flex-1 ${showMobileBottomNav ? "pb-28 lg:pb-0" : ""}`}>
          {children}
        </div>
      </div>

      {showMobileBottomNav ? (
        <nav
          aria-label="Mobile tab navigation"
          className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-[999] w-[calc(100%-1rem)] max-w-sm -translate-x-1/2 lg:hidden"
        >
          <div className="rounded-2xl border border-[#cad9d2] bg-white/85 p-1.5 shadow-[0_12px_36px_-20px_rgba(10,31,26,0.65)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/85">
            <div className="grid grid-cols-2 gap-1">
            {mobileBottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const mobileLabel = item.key === "student-profile" ? "Profile" : item.shortLabel;

              return (
                <Link
                  key={`mobile-bottom-${item.key}`}
                  href={item.href}
                  className={`inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "border-[#0fd978] bg-[#e9fef3] text-[#12392f] dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-100"
                      : "border-transparent bg-transparent text-[#46655b] hover:bg-[#f3f9f6] dark:text-slate-300 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {mobileLabel}
                </Link>
              );
            })}
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
