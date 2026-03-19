import type { NextResponse } from "next/server";
import type { AuthContext, Persona, ProfileSnapshot, SessionUserSnapshot } from "@/lib/route-policy";

export const devIdentityCookieName = "stu-dev-persona";

const parseCookieHeader = (cookieHeader: string | null) => {
  if (!cookieHeader) return new Map<string, string>();

  const cookies = new Map<string, string>();
  cookieHeader.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return;
    cookies.set(name, decodeURIComponent(rest.join("=")));
  });

  return cookies;
};

const parseDevPersona = (value: string | null | undefined): Persona | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "student") return "student";
  if (normalized === "recruiter") return "recruiter";
  if (normalized === "org_admin" || normalized === "admin") return "org_admin";
  if (normalized === "referrer") return "referrer";
  return null;
};

export const isDevIdentitiesEnabled = () => {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env.ENABLE_DEV_IDENTITIES ?? "true";
  return raw.toLowerCase() !== "false";
};

export const resolveDevPersonaFromCookieHeader = (cookieHeader: string | null): Persona | null => {
  if (!isDevIdentitiesEnabled()) return null;
  const cookies = parseCookieHeader(cookieHeader);
  return parseDevPersona(cookies.get(devIdentityCookieName));
};

export const resolveDevPersonaFromCookieValue = (cookieValue: string | null | undefined): Persona | null => {
  if (!isDevIdentitiesEnabled()) return null;
  return parseDevPersona(cookieValue);
};

export const buildDevAuthContext = (persona: Persona): AuthContext => {
  const nowIso = new Date().toISOString();
  const userId = `dev-${persona}-user`;
  const orgId = "dev-org";
  const assignmentIds = persona === "recruiter" ? ["dev-assignment-1"] : [];
  const roleClaim = persona === "org_admin" ? "org_admin" : persona;
  const fullName =
    persona === "student"
      ? "Dev Student"
      : persona === "recruiter"
        ? "Dev Recruiter"
        : persona === "referrer"
          ? "Dev Referrer"
          : "Dev Admin";
  const firstName = fullName.split(/\s+/)[0] ?? "Dev";

  const profile: ProfileSnapshot = {
    id: userId,
    role: persona,
    personal_info: {
      first_name: firstName,
      full_name: fullName,
      email: `${userId}@dev.local`
    },
    auth_preferences: {
      passkeys_enabled: false
    },
    onboarding_completed_at: nowIso
  };

  const sessionUser: SessionUserSnapshot = {
    id: userId,
    email: `${userId}@dev.local`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {
      provider: "dev",
      providers: ["dev"],
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

  return {
    authenticated: true,
    user_id: userId,
    org_id: orgId,
    persona,
    assignment_ids: assignmentIds,
    profile,
    session_source: "mock",
    session_user: sessionUser
  };
};

export const applyDevIdentityCookie = (response: NextResponse, persona: Persona) => {
  response.cookies.set(devIdentityCookieName, persona, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14
  });
};

export const clearDevIdentityCookie = (response: NextResponse) => {
  response.cookies.set(devIdentityCookieName, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
};
