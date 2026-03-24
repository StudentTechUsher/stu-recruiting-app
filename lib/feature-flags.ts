export type StudentViewReleaseKey =
  | "artifactRepository"
  | "capabilityDashboard"
  | "pathwayPlanner"
  | "aiGuidance"
  | "interviewPrep"
  | "manageRoles";

export type StudentViewReleaseFlags = Record<StudentViewReleaseKey, boolean>;

export const defaultStudentViewReleaseFlags: StudentViewReleaseFlags = {
  artifactRepository: true,
  capabilityDashboard: true,
  pathwayPlanner: true,
  aiGuidance: true,
  interviewPrep: true,
  manageRoles: true
};

export type RecruiterViewReleaseKey = "candidateRelationshipManager";

export type RecruiterViewReleaseFlags = Record<RecruiterViewReleaseKey, boolean>;

export const defaultRecruiterViewReleaseFlags: RecruiterViewReleaseFlags = {
  candidateRelationshipManager: false
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
  aiGuidance: "/student/guidance",
  interviewPrep: "/student/interview-prep",
  manageRoles: "/student/targets"
};

const studentRouteReleaseOrder: StudentViewReleaseKey[] = [
  "capabilityDashboard",
  "artifactRepository",
  "pathwayPlanner",
  "aiGuidance",
  "interviewPrep",
  "manageRoles"
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
