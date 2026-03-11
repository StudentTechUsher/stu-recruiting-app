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

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  const profilePersonalInfo = toRecord(context.profile?.personal_info);
  let studentData: Record<string, unknown> = {};
  let roleOptions: string[] = [...defaultFocusRoleOptions];
  let companyOptions: string[] = [...defaultFocusCompanyOptions];

  if (supabase) {
    const [{ data: studentRows }, { data: roleRows }, { data: companyRows }] = (await Promise.all([
      supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
      supabase.from("job_roles").select("role_name").order("role_name", { ascending: true }),
      supabase.from("companies").select("company_name").order("company_name", { ascending: true })
    ])) as [{ data: StudentRow[] | null }, { data: RoleRow[] | null }, { data: CompanyRow[] | null }];

    studentData = toRecord(studentRows?.[0]?.student_data);
    roleOptions = buildOptionList(
      (roleRows ?? []).map((row) => row.role_name ?? ""),
      defaultFocusRoleOptions
    );
    companyOptions = buildOptionList(
      (companyRows ?? []).map((row) => row.company_name ?? ""),
      defaultFocusCompanyOptions
    );
  } else {
    studentData = {};
  }

  return ok({
    resource: "student_profile",
    profile: {
      id: context.user_id,
      personal_info: profilePersonalInfo
    },
    student_data: studentData,
    role_options: roleOptions,
    company_options: companyOptions,
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

  return ok({
    resource: "student_profile",
    profile: {
      id: context.user_id,
      personal_info: profilePersonalInfo
    },
    student_data: studentData,
    status: "saved",
    session_source: context.session_source ?? "none"
  });
}
