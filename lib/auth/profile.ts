import type { Persona, ProfileSnapshot } from "@/lib/route-policy";

export type ProfileRow = {
  id: string;
  role: string | null;
  personal_info: unknown;
  auth_preferences: unknown;
  onboarding_completed_at: string | null;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

export function resolvePersonaFromProfileRole(role: unknown): Persona | null {
  if (role === "student") return "student";
  if (role === "recruiter") return "recruiter";
  if (role === "org_admin" || role === "admin") return "org_admin";
  if (role === "referrer") return "referrer";
  return null;
}

export function toProfileSnapshot(row: ProfileRow | null | undefined): ProfileSnapshot | null {
  if (!row) return null;

  return {
    id: row.id,
    role: resolvePersonaFromProfileRole(row.role),
    personal_info: toRecord(row.personal_info),
    auth_preferences: toRecord(row.auth_preferences),
    onboarding_completed_at: row.onboarding_completed_at
  };
}

type ProfileQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<unknown>;
      };
    };
  };
};

export async function getProfileByUserId(supabaseClient: unknown, userId: string): Promise<ProfileSnapshot | null> {
  const supabase = supabaseClient as ProfileQueryClient;
  const { data, error } = (await supabase
    .from("profiles")
    .select("id, role, personal_info, auth_preferences, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle()) as { data: ProfileRow | null; error: unknown };

  if (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;
    if (code !== "PGRST116") {
      return null;
    }
  }

  return toProfileSnapshot(data);
}
