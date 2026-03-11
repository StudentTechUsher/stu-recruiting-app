import type { Persona } from "@/lib/route-policy";
import { getFirstReleasedStudentRoute, type StudentViewReleaseFlags } from "@/lib/feature-flags";
import { getHomeRouteForPersona, getOnboardingRouteForPersona } from "@/lib/session-routing";

export function resolvePostAuthRedirect({
  persona,
  onboardingCompletedAt,
  studentViewReleaseFlags
}: {
  persona: Persona;
  onboardingCompletedAt: string | null;
  studentViewReleaseFlags: StudentViewReleaseFlags;
}): string {
  if (!onboardingCompletedAt) {
    return getOnboardingRouteForPersona(persona);
  }

  if (persona === "student") {
    return getFirstReleasedStudentRoute(studentViewReleaseFlags);
  }

  return getHomeRouteForPersona(persona);
}
