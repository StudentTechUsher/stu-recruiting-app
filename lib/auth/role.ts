import type { Persona } from "@/lib/route-policy";

type RoleLike = string | null | undefined;
export type UserLike = {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function normalizeRole(value: RoleLike): Persona | null {
  if (!value) return null;
  if (value === "student") return "student";
  if (value === "recruiter") return "recruiter";
  if (value === "org_admin" || value === "admin") return "org_admin";
  if (value === "referrer") return "referrer";
  return null;
}

export function resolvePersonaFromUser(user: UserLike): Persona | null {
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};

  return (
    normalizeRole((appMeta as Record<string, unknown>).stu_persona as RoleLike) ??
    normalizeRole((appMeta as Record<string, unknown>).role as RoleLike) ??
    normalizeRole((userMeta as Record<string, unknown>).stu_persona as RoleLike) ??
    normalizeRole((userMeta as Record<string, unknown>).role as RoleLike)
  );
}

export function resolveOrgIdFromUser(user: UserLike): string {
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};

  const orgFromApp = (appMeta as Record<string, unknown>).org_id;
  const orgFromUser = (userMeta as Record<string, unknown>).org_id;

  if (typeof orgFromApp === "string" && orgFromApp.length > 0) return orgFromApp;
  if (typeof orgFromUser === "string" && orgFromUser.length > 0) return orgFromUser;
  return "";
}

export function resolveAssignmentsFromUser(user: UserLike): string[] {
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};

  const fromApp = (appMeta as Record<string, unknown>).assignment_ids;
  const fromUser = (userMeta as Record<string, unknown>).assignment_ids;

  const toArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  };

  const appAssignments = toArray(fromApp);
  if (appAssignments.length > 0) return appAssignments;
  return toArray(fromUser);
}

export function resolvePersonaFromProfileOrUser(profileRole: Persona | null | undefined, user: UserLike): Persona | null {
  return profileRole ?? resolvePersonaFromUser(user);
}
