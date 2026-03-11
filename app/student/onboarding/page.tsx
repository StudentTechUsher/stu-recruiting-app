import { getAuthContext } from "@/lib/auth-context";
import { defaultFocusCompanyOptions } from "@/lib/companies/default-focus-companies";
import { defaultFocusRoleOptions } from "@/lib/roles/default-focus-roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StudentOnboardingClient } from "./StudentOnboardingClient";

const resolveCampusEmail = async (): Promise<string> => {
  const context = await getAuthContext();
  const sessionEmail = context.session_user?.email;
  if (typeof sessionEmail === "string" && sessionEmail.trim().length > 0) {
    return sessionEmail.trim();
  }

  const profileEmail = context.profile?.personal_info?.email;
  if (typeof profileEmail === "string" && profileEmail.trim().length > 0) {
    return profileEmail.trim();
  }

  return "";
};

type CompanyRow = { company_name: string | null };
type RoleRow = { role_name: string | null };

const resolveFocusCompanyOptions = async (): Promise<string[]> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [...defaultFocusCompanyOptions];

  const { data, error } = (await supabase
    .from("companies")
    .select("company_name")
    .order("company_name", { ascending: true })) as { data: CompanyRow[] | null; error: unknown };

  if (error || !data || data.length === 0) return [...defaultFocusCompanyOptions];

  const deduped = new Map<string, string>();
  for (const row of data) {
    const name = typeof row.company_name === "string" ? row.company_name.trim() : "";
    if (name.length === 0) continue;
    const key = name.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, name);
  }

  return deduped.size > 0 ? Array.from(deduped.values()) : [...defaultFocusCompanyOptions];
};

const resolveFocusRoleOptions = async (): Promise<string[]> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [...defaultFocusRoleOptions];

  const { data, error } = (await supabase
    .from("job_roles")
    .select("role_name")
    .order("role_name", { ascending: true })) as { data: RoleRow[] | null; error: unknown };

  if (error || !data || data.length === 0) return [...defaultFocusRoleOptions];

  const deduped = new Map<string, string>();
  for (const row of data) {
    const name = typeof row.role_name === "string" ? row.role_name.trim() : "";
    if (name.length === 0) continue;
    const key = name.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, name);
  }

  return deduped.size > 0 ? Array.from(deduped.values()) : [...defaultFocusRoleOptions];
};

export default async function StudentOnboardingPage() {
  const [defaultCampusEmail, focusCompanyOptions, focusRoleOptions] = await Promise.all([
    resolveCampusEmail(),
    resolveFocusCompanyOptions(),
    resolveFocusRoleOptions()
  ]);
  return (
    <StudentOnboardingClient
      defaultCampusEmail={defaultCampusEmail}
      focusCompanyOptions={focusCompanyOptions}
      focusRoleOptions={focusRoleOptions}
    />
  );
}
