const coreProfilePersonalInfoKeys = new Set(["first_name", "last_name", "full_name", "email"]);

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export type OnboardingPersistenceResult = {
  profilePersonalInfo: Record<string, unknown>;
  studentData: Record<string, unknown>;
};

export function extractTargetCompanyNames(studentData: Record<string, unknown>): string[] {
  const raw = studentData.target_companies;
  if (!Array.isArray(raw)) return [];

  const deduped = new Map<string, string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, trimmed);
  }

  return Array.from(deduped.values());
}

export function extractTargetRoleNames(studentData: Record<string, unknown>): string[] {
  const raw = studentData.target_roles;
  if (!Array.isArray(raw)) return [];

  const deduped = new Map<string, string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, trimmed);
  }

  return Array.from(deduped.values());
}

export function splitOnboardingPersistenceData({
  payload,
  existingProfilePersonalInfo,
  sessionEmail
}: {
  payload: unknown;
  existingProfilePersonalInfo: Record<string, unknown> | null | undefined;
  sessionEmail: string | null | undefined;
}): OnboardingPersistenceResult {
  const payloadRecord = toRecord(payload);
  const personalInfo = toRecord(payloadRecord.personal_info);
  const existing = toRecord(existingProfilePersonalInfo);

  const firstName = asTrimmedString(personalInfo.first_name) ?? asTrimmedString(existing.first_name);
  const lastName = asTrimmedString(personalInfo.last_name) ?? asTrimmedString(existing.last_name);
  const payloadFullName = asTrimmedString(personalInfo.full_name);
  const derivedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName = payloadFullName ?? (derivedFullName || asTrimmedString(existing.full_name));
  const email = asTrimmedString(sessionEmail) ?? asTrimmedString(personalInfo.email) ?? asTrimmedString(existing.email);

  const profilePersonalInfo: Record<string, unknown> = {
    ...existing
  };

  if (firstName) profilePersonalInfo.first_name = firstName;
  if (lastName) profilePersonalInfo.last_name = lastName;
  if (fullName) profilePersonalInfo.full_name = fullName;
  if (email) profilePersonalInfo.email = email;

  const studentData = Object.fromEntries(
    Object.entries(personalInfo).filter(([key, value]) => !coreProfilePersonalInfoKeys.has(key) && value !== undefined)
  );

  return { profilePersonalInfo, studentData };
}
