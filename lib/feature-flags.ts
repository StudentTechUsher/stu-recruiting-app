export type StudentViewReleaseKey =
  | "artifactRepository"
  | "capabilityDashboard"
  | "pathwayPlanner"
  | "capabilityCoach"
  | "networkingCoach"
  | "aiGuidance"
  | "interviewPrep"
  | "manageRoles";

export type StudentViewReleaseFlags = Record<StudentViewReleaseKey, boolean>;

export const defaultStudentViewReleaseFlags: StudentViewReleaseFlags = {
  artifactRepository: true,
  capabilityDashboard: true,
  pathwayPlanner: false,
  capabilityCoach: false,
  networkingCoach: true,
  aiGuidance: true,
  interviewPrep: false,
  manageRoles: true,
};

export type RecruiterViewReleaseKey = "candidateRelationshipManager" | "capabilityModel";

export type RecruiterViewReleaseFlags = Record<RecruiterViewReleaseKey, boolean>;

export const defaultRecruiterViewReleaseFlags: RecruiterViewReleaseFlags = {
  candidateRelationshipManager: false,
  capabilityModel: false,
};

export type StudentOnboardingPreviewFlagKey =
  | "aiGuidancePanelPreview"
  | "personalizedPathwayPreview"
  | "nextStudentViewsEnabledPreview";

export type StudentOnboardingPreviewFlags = Record<StudentOnboardingPreviewFlagKey, boolean>;

export const defaultStudentOnboardingPreviewFlags: StudentOnboardingPreviewFlags = {
  aiGuidancePanelPreview: true,
  personalizedPathwayPreview: true,
  nextStudentViewsEnabledPreview: true
};

export const studentViewReleaseRouteMap: Record<StudentViewReleaseKey, string> = {
  artifactRepository: "/student/artifacts",
  capabilityDashboard: "/student/dashboard",
  pathwayPlanner: "/student/pathway",
  capabilityCoach: "/student/capability-coach",
  networkingCoach: "/student/networking-coach",
  aiGuidance: "/student/guidance",
  interviewPrep: "/student/interview-prep",
  manageRoles: "/student/targets",
};

const studentRouteReleaseOrder: StudentViewReleaseKey[] = [
  "capabilityDashboard",
  "artifactRepository",
  "manageRoles",
  "pathwayPlanner",
  "capabilityCoach",
  "networkingCoach",
  "aiGuidance",
  "interviewPrep",
];

export const getFirstReleasedStudentRoute = (flags: StudentViewReleaseFlags): string => {
  const firstReleasedKey = studentRouteReleaseOrder.find((key) => flags[key]);
  if (!firstReleasedKey) return "/student/onboarding";
  return studentViewReleaseRouteMap[firstReleasedKey];
};

export const isStudentPathReleased = (pathname: string, flags: StudentViewReleaseFlags): boolean => {
  if (!pathname.startsWith("/student")) return true;
  if (pathname === "/student/onboarding") return true;

  const matchedEntry = Object.entries(studentViewReleaseRouteMap).find(([, route]) => pathname === route || pathname.startsWith(`${route}/`));
  if (!matchedEntry) return true;

  const [releaseKey] = matchedEntry as [StudentViewReleaseKey, string];
  return Boolean(flags[releaseKey]);
};
