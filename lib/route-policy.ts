export type Persona = "student" | "recruiter" | "org_admin" | "referrer";

export type SessionUserSnapshot = {
  id: string;
  email: string | null;
  aud: string;
  role: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

export type ProfileSnapshot = {
  id: string;
  role: Persona | null;
  personal_info: Record<string, unknown>;
  auth_preferences: Record<string, unknown>;
  onboarding_completed_at: string | null;
};

export type AuthContext = {
  authenticated: boolean;
  user_id: string;
  org_id: string;
  persona: Persona;
  assignment_ids: string[];
  profile?: ProfileSnapshot | null;
  session_source?: "mock" | "supabase" | "none";
  session_user?: SessionUserSnapshot | null;
};

export const routePersonaPolicy: Record<string, Persona[]> = {
  "/admin/onboarding": ["org_admin"],
  "/admin/recruiter-assignments": ["org_admin"],
  "/recruiter/onboarding": ["recruiter"],
  "/recruiter/capability-models": ["recruiter", "org_admin"],
  "/recruiter/pipeline": ["recruiter", "org_admin"],
  "/recruiter/off-platform-scoring": ["recruiter", "org_admin"],
  "/recruiter/candidates": ["recruiter", "org_admin"],
  "/recruiter/outcomes": ["recruiter", "org_admin"],
  "/recruiter/candidate-relationship-manager": ["recruiter", "org_admin"],
  "/referrer/onboarding": ["referrer"],
  "/referrer/endorsements": ["referrer"],
  "/student/onboarding": ["student"],
  "/student/profile": ["student"],
  "/student/targets": ["student"],
  "/student/dashboard": ["student"],
  "/student/artifacts": ["student"],
  "/student/pathway": ["student"],
  "/student/capability-coach": ["student"],
  "/student/networking-coach": ["student"],
  "/student/guidance": ["student"],
  "/student/interview-prep": ["student"]
};
