import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { defaultFocusCompanyOptions } from "@/lib/companies/default-focus-companies";
import { defaultFocusRoleOptions } from "@/lib/roles/default-focus-roles";
import { hasPersona } from "@/lib/authorization";
import { extractTargetCompanyNames, extractTargetRoleNames } from "@/lib/auth/onboarding-persistence";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOptionSelections } from "@/lib/text/fuzzy-option-match";

type StudentRow = { student_data: unknown };
type CompanyRow = { company_name: string | null };
type RoleRow = { role_name: string | null };
type ShareLinkRow = { share_slug: string | null };
type EndorsementRow = {
  endorsement_id: string;
  referrer_full_name: string;
  referrer_company: string | null;
  referrer_position: string | null;
  referrer_linkedin_url: string | null;
  endorsement_text: string;
  updated_at: string | null;
  created_at: string | null;
};
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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildOptionList = (values: string[], fallback: readonly string[]): string[] => {
  const source = values.length > 0 ? values : [...fallback];
  const deduped = new Map<string, string>();

  for (const value of source) {
    const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (normalized.length < 2) continue;
    const key = normalized.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, normalized);
  }

  return Array.from(deduped.values());
};

const hasOwn = (record: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

const parseAvatarFileRef = (value: unknown): AvatarFileRef | null => {
  const parsed = toRecord(value);
  const bucket = asTrimmedString(parsed.bucket);
  const path = asTrimmedString(parsed.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

const deriveShareSlug = (profileId: string): string => profileId.toLowerCase().replace(/-/g, "");

const resolveAvatarUrl = async (supabase: unknown, personalInfo: Record<string, unknown>): Promise<string | null> => {
  const fallbackAvatarUrl = asTrimmedString(personalInfo.avatar_url) ?? asTrimmedString(personalInfo.avatarUrl);
  const avatarFileRef = parseAvatarFileRef(personalInfo.avatar_file_ref ?? personalInfo.avatarFileRef);
  if (!avatarFileRef || !supabase) return fallbackAvatarUrl;

  const storageClient = supabase as SupabaseStorageClient;
  const { data, error } = await storageClient.storage.from(avatarFileRef.bucket).createSignedUrl(avatarFileRef.path, AVATAR_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return fallbackAvatarUrl;
  return data.signedUrl;
};

const hydrateProfilePersonalInfo = async (supabase: unknown, personalInfo: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const hydrated = { ...personalInfo };
  const avatarUrl = await resolveAvatarUrl(supabase, hydrated);

  if (avatarUrl) hydrated.avatar_url = avatarUrl;
  else delete hydrated.avatar_url;

  return hydrated;
};

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  const profilePersonalInfo = toRecord(context.profile?.personal_info);
  let studentData: Record<string, unknown> = {};
  let roleOptions: string[] = [...defaultFocusRoleOptions];
  let companyOptions: string[] = [...defaultFocusCompanyOptions];
  let shareSlug = "";
  let endorsements: EndorsementRow[] = [];

  if (supabase) {
    const [{ data: studentRows }, { data: roleRows }, { data: companyRows }, { data: shareRows }, { data: endorsementRows }] =
      (await Promise.all([
      supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
      supabase.from("job_roles").select("role_name").order("role_name", { ascending: true }),
      supabase.from("companies").select("company_name").order("company_name", { ascending: true }),
      supabase.from("student_share_links").select("share_slug").eq("profile_id", context.user_id).limit(1),
      supabase
        .from("endorsements")
        .select(
          "endorsement_id, referrer_full_name, referrer_company, referrer_position, referrer_linkedin_url, endorsement_text, updated_at, created_at"
        )
        .eq("student_profile_id", context.user_id)
        .order("updated_at", { ascending: false })
    ])) as [
      { data: StudentRow[] | null },
      { data: RoleRow[] | null },
      { data: CompanyRow[] | null },
      { data: ShareLinkRow[] | null },
      { data: EndorsementRow[] | null }
    ];

    studentData = toRecord(studentRows?.[0]?.student_data);
    roleOptions = buildOptionList(
      (roleRows ?? []).map((row) => row.role_name ?? ""),
      defaultFocusRoleOptions
    );
    companyOptions = buildOptionList(
      (companyRows ?? []).map((row) => row.company_name ?? ""),
      defaultFocusCompanyOptions
    );
    shareSlug = asTrimmedString(shareRows?.[0]?.share_slug) ?? deriveShareSlug(context.user_id);
    endorsements = endorsementRows ?? [];

    if ((shareRows?.length ?? 0) === 0) {
      await supabase
        .from("student_share_links")
        .upsert({ profile_id: context.user_id, share_slug: shareSlug }, { onConflict: "profile_id" });
    }
  } else {
    studentData = {};
  }

  const hydratedProfilePersonalInfo = await hydrateProfilePersonalInfo(supabase, profilePersonalInfo);

  return ok({
    resource: "student_profile",
    profile: {
      id: context.user_id,
      personal_info: hydratedProfilePersonalInfo
    },
    student_data: studentData,
    role_options: roleOptions,
    company_options: companyOptions,
    referral_profile: {
      share_slug: shareSlug,
      share_path: shareSlug.length > 0 ? `/profile/${shareSlug}` : null
    },
    endorsements: endorsements.map((endorsement) => ({
      endorsement_id: endorsement.endorsement_id,
      referrer_full_name: endorsement.referrer_full_name,
      referrer_company: endorsement.referrer_company,
      referrer_position: endorsement.referrer_position,
      referrer_linkedin_url: endorsement.referrer_linkedin_url,
      endorsement_text: endorsement.endorsement_text,
      updated_at: endorsement.updated_at ?? endorsement.created_at
    })),
    session_source: context.session_source ?? "none"
  });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest("invalid_payload");
  }

  const payloadRecord = toRecord(payload);
  const personalInfoInput = toRecord(payloadRecord.personal_info);
  const studentDataInput = toRecord(payloadRecord.student_data);
  const existingPersonalInfo = toRecord(context.profile?.personal_info);
  let existingStudentData: Record<string, unknown> = {};

  const firstName = asTrimmedString(personalInfoInput.first_name) ?? asTrimmedString(existingPersonalInfo.first_name);
  const lastName = asTrimmedString(personalInfoInput.last_name) ?? asTrimmedString(existingPersonalInfo.last_name);
  const derivedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName =
    asTrimmedString(personalInfoInput.full_name) ??
    (derivedFullName.length > 0 ? derivedFullName : asTrimmedString(existingPersonalInfo.full_name));
  const email =
    asTrimmedString(context.session_user?.email) ??
    asTrimmedString(personalInfoInput.email) ??
    asTrimmedString(existingPersonalInfo.email);

  const profilePersonalInfo: Record<string, unknown> = {
    ...existingPersonalInfo
  };
  if (firstName) profilePersonalInfo.first_name = firstName;
  if (lastName) profilePersonalInfo.last_name = lastName;
  if (fullName) profilePersonalInfo.full_name = fullName;
  if (email) profilePersonalInfo.email = email;

  const hasAvatarFileRefInput = hasOwn(personalInfoInput, "avatar_file_ref") || hasOwn(personalInfoInput, "avatarFileRef");
  if (hasAvatarFileRefInput) {
    const rawAvatarFileRef = personalInfoInput.avatar_file_ref ?? personalInfoInput.avatarFileRef;
    if (rawAvatarFileRef === null) {
      delete profilePersonalInfo.avatar_file_ref;
      delete profilePersonalInfo.avatar_url;
    } else {
      const rawAvatarFileRefRecord = toRecord(rawAvatarFileRef);
      const parsedAvatarFileRef = parseAvatarFileRef(rawAvatarFileRef);
      if (!parsedAvatarFileRef) return badRequest("invalid_avatar_file_ref");
      profilePersonalInfo.avatar_file_ref = {
        ...rawAvatarFileRefRecord,
        bucket: parsedAvatarFileRef.bucket,
        path: parsedAvatarFileRef.path
      };
    }
  }

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const { data: existingStudentRows } = (await supabase
      .from("students")
      .select("student_data")
      .eq("profile_id", context.user_id)
      .limit(1)) as { data: StudentRow[] | null };

    existingStudentData = toRecord(existingStudentRows?.[0]?.student_data);
  }

  const hasTargetRolesInput = Object.prototype.hasOwnProperty.call(studentDataInput, "target_roles");
  const hasTargetCompaniesInput = Object.prototype.hasOwnProperty.call(studentDataInput, "target_companies");

  let targetRoles = hasTargetRolesInput
    ? extractTargetRoleNames(studentDataInput)
    : extractTargetRoleNames(existingStudentData);
  let targetCompanies = hasTargetCompaniesInput
    ? extractTargetCompanyNames(studentDataInput)
    : extractTargetCompanyNames(existingStudentData);

  let rolesToInsert: string[] = [];
  let companiesToInsert: string[] = [];

  if (supabase && hasTargetRolesInput) {
    const { data: roleRows } = (await supabase
      .from("job_roles")
      .select("role_name")
      .order("role_name", { ascending: true })) as { data: RoleRow[] | null };

    const existingRoleOptions = buildOptionList(
      (roleRows ?? []).map((row) => row.role_name ?? ""),
      []
    );
    const resolved = resolveOptionSelections(targetRoles, existingRoleOptions);
    targetRoles = resolved.resolvedSelections;
    rolesToInsert = resolved.newEntries;
  }

  if (supabase && hasTargetCompaniesInput) {
    const { data: companyRows } = (await supabase
      .from("companies")
      .select("company_name")
      .order("company_name", { ascending: true })) as { data: CompanyRow[] | null };

    const existingCompanyOptions = buildOptionList(
      (companyRows ?? []).map((row) => row.company_name ?? ""),
      []
    );
    const resolved = resolveOptionSelections(targetCompanies, existingCompanyOptions);
    targetCompanies = resolved.resolvedSelections;
    companiesToInsert = resolved.newEntries;
  }

  const studentData: Record<string, unknown> = {
    ...existingStudentData,
    ...studentDataInput,
    target_roles: targetRoles,
    target_companies: targetCompanies
  };

  if (supabase) {
    await supabase.from("profiles").update({ personal_info: profilePersonalInfo }).eq("id", context.user_id);

    await supabase.from("students").upsert(
      {
        profile_id: context.user_id,
        student_data: studentData
      },
      { onConflict: "profile_id" }
    );

    if (rolesToInsert.length > 0) {
      await supabase.from("job_roles").upsert(
        rolesToInsert.map((roleName) => ({ role_name: roleName })),
        { onConflict: "role_name_normalized" }
      );
    }

    if (companiesToInsert.length > 0) {
      await supabase.from("companies").upsert(
        companiesToInsert.map((companyName) => ({ company_name: companyName })),
        { onConflict: "company_name_normalized" }
      );
    }
  }

  const hydratedProfilePersonalInfo = await hydrateProfilePersonalInfo(supabase, profilePersonalInfo);

  return ok({
    resource: "student_profile",
    profile: {
      id: context.user_id,
      personal_info: hydratedProfilePersonalInfo
    },
    student_data: studentData,
    status: "saved",
    session_source: context.session_source ?? "none"
  });
}
