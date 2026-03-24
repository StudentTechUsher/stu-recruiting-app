import type { NextResponse } from "next/server";
import type { AuthContext, Persona, ProfileSnapshot, SessionUserSnapshot } from "@/lib/route-policy";

export const devIdentityCookieName = "stu-dev-persona";
const defaultDevStudentProfileId = "11111111-1111-4111-8111-111111111119";
const defaultDevStudentEmail = "sam.r@example.com";
const defaultDevStudentFullName = "Sam Robinson";
const defaultDevRecruiterProfileId = "22222222-2222-4222-8222-222222222229";
const defaultDevRecruiterId = "33333333-3333-4333-8333-333333333339";
const defaultDevRecruiterEmail = "riley.recruiter@example.com";
const defaultDevRecruiterFullName = "Riley Recruiter";
const defaultDevOrgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

type DevRecruiterIdentity = {
  profileId: string;
  recruiterId: string;
  email: string;
  fullName: string;
  orgId: string;
};

const resolveConfiguredValue = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

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

export const getDevRecruiterIdentity = (): DevRecruiterIdentity => ({
  profileId: resolveConfiguredValue(process.env.DEV_RECRUITER_PROFILE_ID, defaultDevRecruiterProfileId),
  recruiterId: resolveConfiguredValue(process.env.DEV_RECRUITER_ID, defaultDevRecruiterId),
  email: resolveConfiguredValue(process.env.DEV_RECRUITER_EMAIL, defaultDevRecruiterEmail),
  fullName: resolveConfiguredValue(process.env.DEV_RECRUITER_FULL_NAME, defaultDevRecruiterFullName),
  orgId: resolveConfiguredValue(process.env.DEV_RECRUITER_ORG_ID, defaultDevOrgId),
});

export const buildDevAuthContext = (persona: Persona): AuthContext => {
  const nowIso = new Date().toISOString();
  const devStudentProfileId = resolveConfiguredValue(process.env.DEV_STUDENT_PROFILE_ID, defaultDevStudentProfileId);
  const devStudentEmail = resolveConfiguredValue(process.env.DEV_STUDENT_EMAIL, defaultDevStudentEmail);
  const devStudentFullName = resolveConfiguredValue(process.env.DEV_STUDENT_FULL_NAME, defaultDevStudentFullName);
  const devRecruiterIdentity = getDevRecruiterIdentity();

  const userId =
    persona === "student"
      ? devStudentProfileId
      : persona === "recruiter"
        ? devRecruiterIdentity.profileId
        : `dev-${persona}-user`;
  const orgId = persona === "recruiter" || persona === "org_admin" ? devRecruiterIdentity.orgId : "dev-org";
  const assignmentIds = persona === "recruiter" ? ["dev-assignment-1"] : [];
  const roleClaim = persona === "org_admin" ? "org_admin" : persona;
  const fullName =
    persona === "student"
      ? devStudentFullName
      : persona === "recruiter"
        ? devRecruiterIdentity.fullName
        : persona === "referrer"
          ? "Dev Referrer"
          : "Dev Admin";
  const email =
    persona === "student"
      ? devStudentEmail
      : persona === "recruiter"
        ? devRecruiterIdentity.email
        : `${userId}@dev.local`;
  const firstName = fullName.split(/\s+/)[0] ?? "Dev";
  const recruiterMetadata = persona === "recruiter" ? { recruiter_id: devRecruiterIdentity.recruiterId } : {};

  const profile: ProfileSnapshot = {
    id: userId,
    role: persona,
    personal_info: {
      first_name: firstName,
      full_name: fullName,
      email
    },
    auth_preferences: {
      passkeys_enabled: false
    },
    onboarding_completed_at: nowIso
  };

  const sessionUser: SessionUserSnapshot = {
    id: userId,
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {
      provider: "dev",
      providers: ["dev"],
      role: roleClaim,
      stu_persona: persona,
      org_id: orgId,
      assignment_ids: assignmentIds,
      ...recruiterMetadata
    },
    user_metadata: {
      role: roleClaim,
      stu_persona: persona,
      org_id: orgId,
      assignment_ids: assignmentIds,
      first_name: firstName,
      full_name: fullName,
      ...recruiterMetadata
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
