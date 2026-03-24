"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "@/components/FeatureFlagsProvider";
import {
  getFirstReleasedStudentRoute,
  isStudentPathReleased,
  type RecruiterViewReleaseKey,
  type StudentViewReleaseKey
} from "@/lib/feature-flags";
import { ChartIcon, LayersIcon, LoopIcon, ModelIcon } from "@/components/mock/ui/Icons";

type Audience = "recruiter" | "student" | "admin" | "referrer";

type NavItem = {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  badge?: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  releaseKey?: StudentViewReleaseKey;
  recruiterReleaseKey?: RecruiterViewReleaseKey;
};

type StudentIdentity = {
  displayName: string;
  avatarUrl: string;
};

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const resolveStudentDisplayName = (personalInfo: Record<string, unknown>): string => {
  const firstName = asTrimmedString(personalInfo.first_name);
  const lastName = asTrimmedString(personalInfo.last_name);
  const fullName = asTrimmedString(personalInfo.full_name);
  const email = asTrimmedString(personalInfo.email);

  const derivedName = `${firstName} ${lastName}`.trim();
  if (derivedName.length > 0) return derivedName;
  if (fullName.length > 0) return fullName;
  if (email.length > 0) return email.split("@")[0]?.trim() ?? "Student";
  return "Student";
};

const toInitials = (value: string): string => {
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

const CompassIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.9 9.1l-2 5.8-5.8 2 2-5.8 5.8-2z" />
    <circle cx="12" cy="12" r="1.2" />
  </svg>
);

const recruiterNavItems: NavItem[] = [
  {
    key: "recruiter-review-candidates",
    label: "Review Candidates",
    shortLabel: "Review",
    description: "Review ATS applicants with capability evidence",
    icon: ChartIcon,
    href: "/recruiter/review-candidates"
  },
  {
    key: "recruiter-model",
    label: "Capability Model",
    shortLabel: "Model",
    description: "Build and manage role-based capability models to improve hiring alignment over time",
    badge: "Coming Soon",
    icon: ModelIcon,
    href: "/recruiter/capability-models"
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
    label: "Evidence Profile",
    shortLabel: "Artifacts",
    description: "Manage your evidence profile",
    icon: LayersIcon,
    href: "/student/artifacts",
    releaseKey: "artifactRepository"
  },
  {
    key: "student-pathway",
    label: "Pathway Planner",
    shortLabel: "Pathway",
    description: "Plan new milestones",
    icon: LoopIcon,
    href: "/student/pathway",
    releaseKey: "pathwayPlanner"
  },
  {
    key: "student-guidance",
    label: "Capability Coach",
    shortLabel: "Coach",
    description: "Improve your hiring signal",
    icon: GuidanceIcon,
    href: "/student/capability-coach"
  },
  {
    key: "student-networking-coach",
    label: "Networking Coach",
    shortLabel: "Networking",
    description: "Expand your network",
    icon: CandidateIcon,
    href: "/student/networking-coach"
  },
  {
    key: "student-targets",
    label: "My Positions & Employers",
    shortLabel: "Targets",
    description: "Set role and employer targets",
    icon: CompassIcon,
    href: "/student/targets",
    releaseKey: "manageRoles"
  },
  {
    key: "student-interview-prep",
    label: "Interview Prep",
    shortLabel: "Interview",
    description: "Practice interview responses",
    icon: InterviewPrepIcon,
    href: "/student/interview-prep",
    releaseKey: "interviewPrep"
  },
  {
    key: "student-profile",
    label: "Profile",
    shortLabel: "Profile",
    description: "Manage profile details & visibility",
    icon: CandidateIcon,
    href: "/student/profile"
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

const referrerNavItems: NavItem[] = [
  {
    key: "referrer-endorsements",
    label: "Student Endorsements",
    shortLabel: "Endorsements",
    description: "Look up student profiles and submit endorsements",
    icon: CandidateIcon,
    href: "/referrer/endorsements"
  }
];

const getNavItems = (audience: Audience) => {
  if (audience === "recruiter") return recruiterNavItems;
  if (audience === "student") return studentNavItems;
  if (audience === "referrer") return referrerNavItems;
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
  const { recruiterViewReleaseFlags, studentViewReleaseFlags } = useFeatureFlags();
  const [studentIdentity, setStudentIdentity] = useState<StudentIdentity | null>(null);
  const baseNavItems = getNavItems(audience);
  const navItems = baseNavItems.filter((item) => {
    if (audience === "student" && item.releaseKey) return studentViewReleaseFlags[item.releaseKey];
    if (audience === "recruiter" && item.recruiterReleaseKey) return recruiterViewReleaseFlags[item.recruiterReleaseKey];
    return true;
  });
  const mobileBottomNavItems =
    audience === "student"
      ? navItems.filter(
          (item) => item.key === "student-artifacts" || item.key === "student-targets" || item.key === "student-profile"
        )
      : [];
  const showMobileBottomNav = showNavigation && audience === "student" && mobileBottomNavItems.length > 0;
  const studentInitials = useMemo(() => toInitials(studentIdentity?.displayName ?? "Student"), [studentIdentity?.displayName]);

  useEffect(() => {
    if (audience !== "student") return;
    if (isStudentPathReleased(pathname, studentViewReleaseFlags)) return;

    router.replace(getFirstReleasedStudentRoute(studentViewReleaseFlags));
  }, [audience, pathname, router, studentViewReleaseFlags]);

  useEffect(() => {
    if (audience !== "student") return;

    let isActive = true;
    const loadStudentIdentity = async () => {
      try {
        const response = await fetch("/api/student/profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data?: { profile?: { personal_info?: Record<string, unknown> } } }
          | { ok: false; error?: string }
          | null;

        if (!isActive || !response.ok || !payload || !payload.ok) return;

        const personalInfo = payload.data?.profile?.personal_info ?? {};
        setStudentIdentity({
          displayName: resolveStudentDisplayName(personalInfo),
          avatarUrl: asTrimmedString(personalInfo.avatar_url) || asTrimmedString(personalInfo.avatarUrl)
        });
      } catch {
        if (!isActive) return;
        setStudentIdentity((current) => current ?? { displayName: "Student", avatarUrl: "" });
      }
    };

    const handleStudentProfileUpdated = () => {
      void loadStudentIdentity();
    };

    void loadStudentIdentity();
    window.addEventListener("student-profile-updated", handleStudentProfileUpdated);
    return () => {
      isActive = false;
      window.removeEventListener("student-profile-updated", handleStudentProfileUpdated);
    };
  }, [audience]);

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

            {audience === "student" ? (
              <div className="mt-4 rounded-2xl border border-[#d4e1db] bg-[#f6fbf8] p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#bfd2ca] bg-[#e5f2ec] text-xs font-semibold text-[#21453a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                    {studentIdentity?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={studentIdentity.avatarUrl} alt="Student avatar" className="h-full w-full object-cover" />
                    ) : (
                      studentInitials
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5a776e] dark:text-slate-400">
                      Student
                    </span>
                    <span className="block truncate text-sm font-semibold text-[#173f33] dark:text-slate-100">
                      {studentIdentity?.displayName ?? "Student"}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#446258] dark:text-slate-400">
              {audience === "admin"
                ? "Admin Navigation"
                : `${audience === "recruiter" ? "Recruiter" : audience === "referrer" ? "Referrer" : "Student"} Navigation`}
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
                        <span className="block text-sm font-semibold text-[#143a2f] dark:text-slate-100">
                          {item.label}
                          {item.badge ? (
                            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                              {item.badge}
                            </span>
                          ) : null}
                        </span>
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
            <div className={`grid gap-1 ${mobileBottomNavItems.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {mobileBottomNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                const mobileLabel =
                  item.key === "student-profile" ? "Profile" : item.key === "student-targets" ? "Targets" : item.shortLabel;

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
