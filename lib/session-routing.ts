import { defaultStudentViewReleaseFlags, getFirstReleasedStudentRoute } from "@/lib/feature-flags";

export type SessionPersona = "student" | "recruiter" | "org_admin" | "referrer";

export function getHomeRouteForPersona(persona: SessionPersona | string | undefined): string {
  if (persona === "recruiter") return "/recruiter/pipeline";
  if (persona === "org_admin") return "/admin/recruiter-assignments";
  if (persona === "referrer") return "/referrer/endorsements";
  return getFirstReleasedStudentRoute(defaultStudentViewReleaseFlags);
}

export function getOnboardingRouteForPersona(persona: SessionPersona | string | undefined): string {
  if (persona === "recruiter") return "/recruiter/onboarding";
  if (persona === "org_admin") return "/admin/onboarding";
  if (persona === "referrer") return "/referrer/onboarding";
  return "/student/onboarding";
}
