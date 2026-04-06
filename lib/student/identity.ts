type AvatarFileRef = { bucket: string; path: string };

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl?: string | null } | null; error: unknown }>;
    };
  };
};

const AVATAR_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseAvatarFileRef = (value: unknown): AvatarFileRef | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const bucket = asTrimmedString(record.bucket);
  const path = asTrimmedString(record.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

const resolveDisplayName = ({
  personalInfo,
  fallbackEmail,
}: {
  personalInfo: Record<string, unknown>;
  fallbackEmail?: string | null;
}): string => {
  const firstName = asTrimmedString(personalInfo.first_name);
  const lastName = asTrimmedString(personalInfo.last_name);
  const fullName = asTrimmedString(personalInfo.full_name);
  const email = asTrimmedString(personalInfo.email) ?? asTrimmedString(fallbackEmail);

  const derivedName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  if (derivedName.length > 0) return derivedName;
  if (fullName) return fullName;
  if (email) return email.split("@")[0]?.trim() || "Candidate";
  return "Candidate";
};

const resolveFirstName = ({
  personalInfo,
  fallbackEmail,
}: {
  personalInfo: Record<string, unknown>;
  fallbackEmail?: string | null;
}): string | null => {
  const explicitFirstName = asTrimmedString(personalInfo.first_name);
  if (explicitFirstName) return explicitFirstName;

  const fullName = asTrimmedString(personalInfo.full_name);
  if (fullName) {
    const firstToken = fullName.split(/\s+/).filter(Boolean)[0] ?? "";
    if (firstToken.length > 0) return firstToken;
  }

  const email = asTrimmedString(personalInfo.email) ?? asTrimmedString(fallbackEmail);
  if (email) {
    const localPart = email.split("@")[0]?.trim() ?? "";
    if (localPart.length > 0) return localPart;
  }

  return null;
};

const toInitials = (value: string): string => {
  const tokens = value
    .split(/[\s@._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return "ST";
  const first = tokens[0]?.[0] ?? "";
  const second = tokens[1]?.[0] ?? "";
  const initials = `${first}${second}`.toUpperCase();
  return initials.length > 0 ? initials : "ST";
};

const resolveAvatarUrl = async ({
  supabase,
  personalInfo,
}: {
  supabase: unknown;
  personalInfo: Record<string, unknown>;
}): Promise<string | null> => {
  const fallbackAvatarUrl = asTrimmedString(personalInfo.avatar_url) ?? asTrimmedString(personalInfo.avatarUrl);
  const avatarFileRef = parseAvatarFileRef(personalInfo.avatar_file_ref ?? personalInfo.avatarFileRef);
  if (!avatarFileRef || !supabase) return fallbackAvatarUrl;

  const storageClient = supabase as SupabaseStorageClient;
  const { data, error } = await storageClient.storage
    .from(avatarFileRef.bucket)
    .createSignedUrl(avatarFileRef.path, AVATAR_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return fallbackAvatarUrl;
  return data.signedUrl;
};

export type StudentIdentitySnapshot = {
  display_name: string;
  first_name: string | null;
  initials_fallback: string;
  avatar_url: string | null;
  cache_scope: string;
};

export const buildStudentCacheScope = ({
  profileId,
  orgId,
}: {
  profileId: string;
  orgId?: string | null;
}): string => `${profileId}:${(orgId ?? "none").trim() || "none"}`;

export async function buildStudentIdentitySnapshot({
  profileId,
  orgId,
  personalInfo,
  fallbackEmail,
  supabase,
}: {
  profileId: string;
  orgId?: string | null;
  personalInfo: Record<string, unknown>;
  fallbackEmail?: string | null;
  supabase?: unknown;
}): Promise<StudentIdentitySnapshot> {
  const displayName = resolveDisplayName({ personalInfo, fallbackEmail });
  const firstName = resolveFirstName({ personalInfo, fallbackEmail });
  const avatarUrl = await resolveAvatarUrl({ supabase, personalInfo });

  return {
    display_name: displayName,
    first_name: firstName,
    initials_fallback: toInitials(displayName),
    avatar_url: avatarUrl,
    cache_scope: buildStudentCacheScope({ profileId, orgId }),
  };
}
