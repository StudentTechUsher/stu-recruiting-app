import { headers } from "next/headers";
import type { AuthContext, Persona, ProfileSnapshot, SessionUserSnapshot } from "@/lib/route-policy";
import { isSessionCheckEnabled } from "@/lib/session-flags";
import { resolveAssignmentsFromUser, resolveOrgIdFromUser, resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/auth/profile";
import { isExpectedUnauthenticatedAuthError } from "@/lib/supabase/auth-session";
import { buildDevAuthContext, resolveDevPersonaFromCookieHeader } from "@/lib/dev-auth";

const parsePersonaFromHeader = (value: string | null): Persona => {
  if (!value) return "student";
  const normalized = value.trim().toLowerCase();
  if (normalized === "recruiter") return "recruiter";
  if (normalized === "org_admin" || normalized === "admin") return "org_admin";
  if (normalized === "referrer") return "referrer";
  return "student";
};

const parseAssignmentIds = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseOnboardingCompleted = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return new Date().toISOString();
  }
  return null;
};

const toUnauthenticatedContext = (): AuthContext => ({
  authenticated: false,
  user_id: "",
  org_id: "",
  persona: "student",
  assignment_ids: [],
  profile: null,
  session_source: "none",
  session_user: null
});

const toErrorDetails = (error: unknown): { message: string; code: string } => {
  if (!error || typeof error !== "object") {
    return { message: String(error), code: "" };
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : String(error);
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return { message, code };
};

const deriveFirstName = (sessionUser: SessionUserSnapshot, profile: ProfileSnapshot | null): string | null => {
  const fromProfile = profile?.personal_info?.first_name;
  if (typeof fromProfile === "string" && fromProfile.trim().length > 0) return fromProfile.trim();

  const fromSession = sessionUser.user_metadata.first_name;
  if (typeof fromSession === "string" && fromSession.trim().length > 0) return fromSession.trim();

  return null;
};

const toAuthContextFromSessionUser = ({
  sessionUser,
  sessionSource,
  profile
}: {
  sessionUser: SessionUserSnapshot;
  sessionSource: "mock" | "supabase";
  profile: ProfileSnapshot | null;
}): AuthContext => {
  const persona = resolvePersonaFromProfileOrUser(profile?.role, sessionUser);

  const firstName = deriveFirstName(sessionUser, profile);
  const normalizedSessionUser: SessionUserSnapshot =
    firstName && typeof sessionUser.user_metadata.first_name !== "string"
      ? {
          ...sessionUser,
          user_metadata: {
            ...sessionUser.user_metadata,
            first_name: firstName
          }
        }
      : sessionUser;

  return {
    authenticated: Boolean(persona),
    user_id: normalizedSessionUser.id,
    org_id: resolveOrgIdFromUser(normalizedSessionUser),
    persona: persona ?? "student",
    assignment_ids: resolveAssignmentsFromUser(normalizedSessionUser),
    profile,
    session_source: sessionSource,
    session_user: normalizedSessionUser
  };
};

const createMockSessionData = (h: Headers): { sessionUser: SessionUserSnapshot; profile: ProfileSnapshot } => {
  const persona = parsePersonaFromHeader(h.get("x-stu-persona"));
  const userId = h.get("x-stu-user-id") ?? `dev-${persona}-user`;
  const orgId = h.get("x-stu-org-id") ?? "dev-org";
  const requestedAssignments = parseAssignmentIds(h.get("x-stu-assignment-ids"));
  const assignmentIds =
    requestedAssignments.length > 0 ? requestedAssignments : persona === "recruiter" ? ["pos-1"] : [];
  const roleClaim = persona === "org_admin" ? "org_admin" : persona;
  const requestedFirstName = h.get("x-stu-first-name")?.trim() ?? "";
  const requestedFullName = h.get("x-stu-full-name")?.trim() ?? "";
  const fallbackFullName = "Vin Jones";
  const fullName = requestedFullName || (requestedFirstName ? `${requestedFirstName} Dev` : fallbackFullName);
  const firstName = requestedFirstName || fullName.split(/\s+/).filter(Boolean)[0] || "Vin";

  const profile: ProfileSnapshot = {
    id: userId,
    role: persona,
    personal_info: {
      first_name: firstName,
      full_name: fullName,
      email: h.get("x-stu-email") ?? `${userId}@dev.local`
    },
    auth_preferences: {
      passkeys_enabled: false
    },
    onboarding_completed_at: parseOnboardingCompleted(h.get("x-stu-onboarding-completed"))
  };

  const sessionUser: SessionUserSnapshot = {
    id: userId,
    email: h.get("x-stu-email") ?? `${userId}@dev.local`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {
      provider: "email",
      providers: ["email"],
      role: roleClaim,
      stu_persona: persona,
      org_id: orgId,
      assignment_ids: assignmentIds
    },
    user_metadata: {
      role: roleClaim,
      stu_persona: persona,
      org_id: orgId,
      assignment_ids: assignmentIds,
      first_name: firstName,
      full_name: fullName
    }
  };

  return { sessionUser, profile };
};

export async function getAuthContext(): Promise<AuthContext> {
  const h = await headers();
  const devPersona = resolveDevPersonaFromCookieHeader(h.get("cookie"));
  if (devPersona) {
    return buildDevAuthContext(devPersona);
  }

  if (!isSessionCheckEnabled()) {
    const mockSessionData = createMockSessionData(h);
    return toAuthContextFromSessionUser({
      sessionUser: mockSessionData.sessionUser,
      sessionSource: "mock",
      profile: mockSessionData.profile
    });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return toUnauthenticatedContext();

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let error: unknown = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch (thrownError) {
    error = thrownError;
  }

  if (error) {
    if (!isExpectedUnauthenticatedAuthError(error)) {
      console.error("auth_context_get_user_failed", toErrorDetails(error));
    }
    return toUnauthenticatedContext();
  }

  if (!user) {
    return toUnauthenticatedContext();
  }

  const sessionUser: SessionUserSnapshot = {
    id: user.id,
    email: user.email ?? null,
    aud: user.aud ?? "authenticated",
    role: user.role ?? null,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {}
  };

  const profile = await getProfileByUserId(supabase, user.id);

  return toAuthContextFromSessionUser({
    sessionUser,
    sessionSource: "supabase",
    profile
  });
}
