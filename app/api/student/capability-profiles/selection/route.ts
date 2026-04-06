import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  deriveLegacyTargetsFromActive,
  parseActiveCapabilityProfiles,
  parseCapabilityProfileSelectionHistory,
  toArchivedSelection,
  toTrimmedString,
  type ActiveCapabilityProfileSelection,
  type CapabilityProfileOption,
} from "@/lib/student/capability-targeting";
import { getActiveRoleCapabilityAxes, normalizeRoleCapabilityAxes, toLegacyWeights } from "@/lib/recruiter/capability-axes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type StudentRow = { student_data: unknown };
type CapabilityModelRow = {
  capability_model_id: string;
  company_id: string | null;
  role_name?: string | null;
  model_data: unknown;
  is_active: boolean | null;
};
type CompanyRow = { company_id: string; company_name: string | null };

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseCapabilityProfileIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
};

const normalizeLabelKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const fetchCapabilityModels = async (
  supabase: any
): Promise<CapabilityModelRow[]> => {
  const query = (await supabase
    .from("capability_models")
    .select("*")
    ) as {
    data: CapabilityModelRow[] | null;
    error: unknown;
  };
  if (query.error) {
    return [];
  }
  return (query.data ?? []).filter((model) => model.is_active === true);
};

const createCapabilityProfileOptions = ({
  models,
  companies,
}: {
  models: CapabilityModelRow[];
  companies: CompanyRow[];
}): CapabilityProfileOption[] => {
  const companyNameById = new Map<string, string>();
  for (const company of companies) {
    if (!company.company_id) continue;
    const label = toTrimmedString(company.company_name);
    if (label) companyNameById.set(company.company_id, label);
  }

  const options: CapabilityProfileOption[] = [];
  for (const model of models) {
    const companyId = toTrimmedString(model.company_id);
    if (!companyId) continue;
    const modelData = toRecord(model.model_data);
    const roleLabelFromModel =
      toTrimmedString(model.role_name) ??
      toTrimmedString(modelData.role_label) ??
      toTrimmedString(modelData.role_name) ??
      toTrimmedString(modelData.model_name);
    const companyLabel = companyNameById.get(companyId) ?? `Unknown (${companyId.slice(0, 8)})`;
    const roleLabel = roleLabelFromModel ?? "Unknown role";
    const normalizedAxes = getActiveRoleCapabilityAxes(
      normalizeRoleCapabilityAxes({
        axes: modelData.axes,
        weights: modelData.weights,
      })
    );

    const comboRoleKey = normalizeLabelKey(roleLabel);
    options.push({
      capability_profile_id: model.capability_model_id,
      company_id: companyId,
      company_label: companyLabel,
      role_id: `name:${comboRoleKey}`,
      role_label: roleLabel,
      capability_ids: [],
      target_axes: normalizedAxes,
      target_weights: toLegacyWeights(normalizedAxes),
      updated_at: "",
    });
  }

  return options;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"], { requireOnboarding: false })) return forbidden();

  const payload = await req.json().catch(() => null);
  const payloadRecord = toRecord(payload);
  const parsedIds = parseCapabilityProfileIds(payloadRecord.capability_profile_ids);
  if (!parsedIds) return badRequest("invalid_capability_profile_ids");
  if (parsedIds.length > 2) return badRequest("capability_profile_limit_exceeded");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_not_configured");
  const capabilityModelsClient = getSupabaseServiceRoleClient() ?? supabase;

  const [
    { data: studentRows },
    modelRows,
    { data: companyRows },
  ] = (await Promise.all([
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
    fetchCapabilityModels(capabilityModelsClient),
    supabase.from("companies").select("*"),
  ])) as [
    { data: StudentRow[] | null },
    CapabilityModelRow[],
    { data: CompanyRow[] | null }
  ];

  const options = createCapabilityProfileOptions({
    models: modelRows,
    companies: companyRows ?? [],
  });
  const optionById = new Map(options.map((option) => [option.capability_profile_id, option]));

  if (parsedIds.some((capabilityProfileId) => !optionById.has(capabilityProfileId))) {
    return badRequest("capability_profile_not_found");
  }

  const studentData = toRecord(studentRows?.[0]?.student_data);
  const previousActive = parseActiveCapabilityProfiles(studentData.active_capability_profiles);
  const previousHistory = parseCapabilityProfileSelectionHistory(studentData.capability_profile_selection_history);
  const previousActiveById = new Map(previousActive.map((item) => [item.capability_profile_id, item]));
  const nowIso = new Date().toISOString();

  const nextActive: ActiveCapabilityProfileSelection[] = parsedIds.map((capabilityProfileId) => {
    const existing = previousActiveById.get(capabilityProfileId);
    if (existing) {
      return {
        ...existing,
        status: "active",
      };
    }

    const option = optionById.get(capabilityProfileId)!;
    return {
      capability_profile_id: option.capability_profile_id,
      company_id: option.company_id,
      company_label: option.company_label,
      role_id: option.role_id,
      role_label: option.role_label,
      selected_at: nowIso,
      selection_source: "manual",
      status: "active",
    };
  });

  const removedActive = previousActive.filter(
    (item) => !nextActive.some((active) => active.capability_profile_id === item.capability_profile_id)
  );
  const archiveReason = nextActive.length === 0 ? "removed_by_user" : "replaced";
  const nextHistory = [
    ...previousHistory,
    ...removedActive.map((item) =>
      toArchivedSelection({
        active: item,
        archivedAt: nowIso,
        reason: archiveReason,
      })
    ),
  ].slice(-100);

  const legacyTargets = deriveLegacyTargetsFromActive(nextActive);
  const nextStudentData = {
    ...studentData,
    active_capability_profiles: nextActive,
    capability_profile_selection_history: nextHistory,
    target_roles: legacyTargets.target_roles,
    target_companies: legacyTargets.target_companies,
  };

  await supabase.from("students").upsert(
    {
      profile_id: context.user_id,
      student_data: nextStudentData,
    },
    { onConflict: "profile_id" }
  );

  return ok({
    active_capability_profiles: nextActive,
    capability_profile_selection_history: nextHistory,
    target_roles: legacyTargets.target_roles,
    target_companies: legacyTargets.target_companies,
    selection_priority: nextActive.map((item, index) => ({
      capability_profile_id: item.capability_profile_id,
      priority_index: index,
      priority_label: index === 0 ? "primary" : "secondary",
    })),
    canonical_order_note: "Array order reflects candidate-selected priority. Index 0 is primary target.",
  });
}
