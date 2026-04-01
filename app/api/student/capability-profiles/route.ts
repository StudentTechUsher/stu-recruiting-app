import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  buildEvidenceFreshnessMarker,
  buildLegacyMigrationSelections,
  buildSelectionFingerprint,
  computeCapabilityProfileFit,
  deriveLegacyTargetsFromActive,
  parseActiveCapabilityProfiles,
  parseCapabilityProfileSelectionHistory,
  toArchivedSelection,
  toStringArray,
  toTrimmedString,
  type CapabilityProfileFit,
  type CapabilityProfileOption,
} from "@/lib/student/capability-targeting";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type StudentRow = { student_data: unknown };
type CapabilityModelRow = {
  capability_model_id: string;
  company_id: string | null;
  role_name?: string | null;
  model_data: unknown;
  is_active: boolean | null;
  updated_at: string;
};
type CompanyRow = { company_id: string; company_name: string | null };
type RoleRow = { role_id: string; role_name: string | null; role_data: unknown };
type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  updated_at: string | null;
  is_active: boolean | null;
};
type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: unknown;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toNumericRecord = (value: unknown): Record<string, number> => {
  const record = toRecord(value);
  const parsed: Record<string, number> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) continue;
    parsed[normalizedKey] = raw;
  }
  return parsed;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeLabelKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const resolveRoleCapabilityIds = (roleData: unknown): string[] => {
  const record = toRecord(roleData);
  const raw = record.capability_ids;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const parts = [
    typeof candidate.message === "string" ? candidate.message : "",
    typeof candidate.details === "string" ? candidate.details : "",
    typeof candidate.hint === "string" ? candidate.hint : "",
    typeof candidate.code === "string" ? `code=${candidate.code}` : "",
  ].filter((part) => part.trim().length > 0);
  if (parts.length === 0) return null;
  return parts.join(" | ");
};

const fetchCapabilityModels = async (
  supabase: any
): Promise<SupabaseQueryResult<CapabilityModelRow>> => {
  const query = (await supabase
    .from("capability_models")
    .select("*")
    ) as SupabaseQueryResult<CapabilityModelRow>;
  return {
    data: query.data ?? [],
    error: query.error ?? null,
  };
};

const resolveModelRoleLabel = ({
  model,
  roleLabelById,
}: {
  model: CapabilityModelRow;
  roleLabelById: Map<string, string>;
}): string | null => {
  const roleNameColumn = toTrimmedString(model.role_name);
  if (roleNameColumn) return roleNameColumn;

  const modelData = toRecord(model.model_data);
  const roleNameFromModel = toTrimmedString(modelData.role_name);
  if (roleNameFromModel) return roleNameFromModel;

  const roleLabelFromModel = toTrimmedString(modelData.role_label);
  if (roleLabelFromModel) return roleLabelFromModel;

  const roleId = toTrimmedString(modelData.role_id);
  if (roleId) {
    const byRoleId = roleLabelById.get(roleId);
    if (byRoleId) return byRoleId;
  }

  return toTrimmedString(modelData.model_name);
};

const fitCacheTtlMs =
  process.env.NODE_ENV === "production"
    ? 20_000
    : 2_000;
const fitCache = new Map<string, { expiresAt: number; fitByCapabilityProfileId: Record<string, CapabilityProfileFit> }>();

const createCapabilityProfileOptions = ({
  models,
  companies,
  roles,
}: {
  models: CapabilityModelRow[];
  companies: CompanyRow[];
  roles: RoleRow[];
}): CapabilityProfileOption[] => {
  const companyNameById = new Map<string, string>();
  for (const company of companies) {
    if (!company.company_id) continue;
    const label = toTrimmedString(company.company_name);
    if (label) companyNameById.set(company.company_id, label);
  }

  const roleById = new Map<
    string,
    {
      role_label: string;
      role_capability_ids: string[];
    }
  >();
  for (const role of roles) {
    if (!role.role_id) continue;
    const roleLabel = toTrimmedString(role.role_name);
    if (!roleLabel) continue;
    roleById.set(role.role_id, {
      role_label: roleLabel,
      role_capability_ids: resolveRoleCapabilityIds(role.role_data),
    });
  }
  const roleLabelById = new Map(Array.from(roleById.entries()).map(([id, data]) => [id, data.role_label]));

  const options: CapabilityProfileOption[] = [];
  const sortedModels = models.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  for (const model of sortedModels) {
    const companyId = toTrimmedString(model.company_id);
    if (!companyId) continue;

    const modelData = toRecord(model.model_data);
    const modelRoleLabel = resolveModelRoleLabel({
      model,
      roleLabelById,
    });
    const roleIdExplicit = toTrimmedString(modelData.role_id) ?? null;
    const companyLabel = companyNameById.get(companyId) ?? `Unknown (${companyId.slice(0, 8)})`;
    const roleRef = roleIdExplicit ? roleById.get(roleIdExplicit) : null;
    const roleLabel = modelRoleLabel ?? roleRef?.role_label ?? "Unknown role";
    const roleKey = `name:${normalizeLabelKey(roleLabel)}`;

    const targetWeights = toNumericRecord(modelData.weights);
    const weightedCapabilityIds = Object.keys(targetWeights).filter((capabilityId) => capabilityId.length > 0);
    const capabilityIds =
      weightedCapabilityIds.length > 0
        ? weightedCapabilityIds
        : roleRef?.role_capability_ids ?? [];

    options.push({
      capability_profile_id: model.capability_model_id,
      company_id: companyId,
      company_label: companyLabel,
      role_id: roleKey,
      role_label: roleLabel,
      capability_ids: Array.from(new Set(capabilityIds)),
      target_weights: targetWeights,
      updated_at: model.updated_at,
    });
  }

  return options;
};

const toRolesResponseFromModels = ({
  models,
  roles,
}: {
  models: CapabilityModelRow[];
  roles: RoleRow[];
}) => {
  const roleLabelById = new Map<string, string>();
  for (const role of roles) {
    if (!role.role_id) continue;
    const label = toTrimmedString(role.role_name);
    if (!label) continue;
    roleLabelById.set(role.role_id, label);
  }

  const deduped = new Map<string, { role_id: string; role_label: string }>();
  for (const model of models) {
    const roleLabel = resolveModelRoleLabel({ model, roleLabelById });
    if (!roleLabel) continue;
    const roleId = `name:${normalizeLabelKey(roleLabel)}`;
    if (!deduped.has(roleId)) {
      deduped.set(roleId, {
        role_id: roleId,
        role_label: roleLabel,
      });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.role_label.localeCompare(b.role_label));
};

const toCompaniesResponse = (companies: CompanyRow[]) =>
  companies
    .map((company) => ({
      company_id: company.company_id,
      company_label: toTrimmedString(company.company_name) ?? "",
    }))
    .filter((company) => company.company_id && company.company_label.length > 0)
    .sort((a, b) => a.company_label.localeCompare(b.company_label));

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"], { requireOnboarding: false })) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return ok({
      roles: [],
      companies: [],
      capability_profiles: [],
      active_capability_profiles: [],
      fit_by_capability_profile_id: {},
    });
  }
  const serviceRoleClient = getSupabaseServiceRoleClient();
  const capabilityModelsClient = serviceRoleClient ?? supabase;

  const [studentQuery, modelQuery, companyQuery, roleQuery, artifactQuery] = (await Promise.all([
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
    fetchCapabilityModels(capabilityModelsClient),
    supabase.from("companies").select("*"),
    supabase.from("job_roles").select("role_id, role_name, role_data"),
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, updated_at, is_active")
      .eq("profile_id", context.user_id)
      .order("updated_at", { ascending: false }),
  ])) as [
    SupabaseQueryResult<StudentRow>,
    SupabaseQueryResult<CapabilityModelRow>,
    SupabaseQueryResult<CompanyRow>,
    SupabaseQueryResult<RoleRow>,
    SupabaseQueryResult<ArtifactRow>
  ];

  const studentRows = studentQuery.data ?? [];
  const modelRows = modelQuery.data ?? [];
  const companyRows = companyQuery.data ?? [];
  const roleRows = roleQuery.data ?? [];
  const artifactRows = artifactQuery.data ?? [];

  const studentRow = studentRows?.[0];
  const existingStudentData = toRecord(studentRow?.student_data);
  const capabilityProfiles = createCapabilityProfileOptions({
    models: modelRows,
    companies: companyRows,
    roles: roleRows,
  });
  const profileById = new Map(capabilityProfiles.map((profile) => [profile.capability_profile_id, profile]));
  const nowIso = new Date().toISOString();

  let activeCapabilityProfiles = parseActiveCapabilityProfiles(existingStudentData.active_capability_profiles);
  let capabilityProfileSelectionHistory = parseCapabilityProfileSelectionHistory(
    existingStudentData.capability_profile_selection_history
  );

  activeCapabilityProfiles = activeCapabilityProfiles.map((selection) => {
    const profile = profileById.get(selection.capability_profile_id);
    if (!profile) return selection;
    return {
      ...selection,
      company_id: profile.company_id,
      company_label: profile.company_label,
      role_id: profile.role_id,
      role_label: profile.role_label,
      status: "active",
    };
  });

  const filteredActive = activeCapabilityProfiles.filter((item) => profileById.has(item.capability_profile_id));
  if (filteredActive.length !== activeCapabilityProfiles.length) {
    const removed = activeCapabilityProfiles.filter(
      (item) => !filteredActive.some((next) => next.capability_profile_id === item.capability_profile_id)
    );
    capabilityProfileSelectionHistory = [
      ...capabilityProfileSelectionHistory,
      ...removed.map((item) =>
        toArchivedSelection({
          active: item,
          archivedAt: nowIso,
          reason: "migration_cleanup",
        })
      ),
    ].slice(-100);
    activeCapabilityProfiles = filteredActive;
  }

  if (activeCapabilityProfiles.length === 0) {
    const migratedSelections = buildLegacyMigrationSelections({
      targetRoles: toStringArray(existingStudentData.target_roles),
      targetCompanies: toStringArray(existingStudentData.target_companies),
      profiles: capabilityProfiles,
    });
    if (migratedSelections.length > 0) {
      activeCapabilityProfiles = migratedSelections;
    }
  }

  const derivedLegacyTargets = deriveLegacyTargetsFromActive(activeCapabilityProfiles);
  const existingLegacyRoles = toStringArray(existingStudentData.target_roles);
  const existingLegacyCompanies = toStringArray(existingStudentData.target_companies);

  const shouldPersistStudentData =
    JSON.stringify(activeCapabilityProfiles) !== JSON.stringify(parseActiveCapabilityProfiles(existingStudentData.active_capability_profiles)) ||
    JSON.stringify(capabilityProfileSelectionHistory) !==
      JSON.stringify(parseCapabilityProfileSelectionHistory(existingStudentData.capability_profile_selection_history)) ||
    JSON.stringify(existingLegacyRoles) !== JSON.stringify(derivedLegacyTargets.target_roles) ||
    JSON.stringify(existingLegacyCompanies) !== JSON.stringify(derivedLegacyTargets.target_companies);

  if (shouldPersistStudentData) {
    const nextStudentData: Record<string, unknown> = {
      ...existingStudentData,
      active_capability_profiles: activeCapabilityProfiles,
      capability_profile_selection_history: capabilityProfileSelectionHistory,
      target_roles: derivedLegacyTargets.target_roles,
      target_companies: derivedLegacyTargets.target_companies,
    };

    await supabase.from("students").upsert(
      {
        profile_id: context.user_id,
        student_data: nextStudentData,
      },
      { onConflict: "profile_id" }
    );
  }

  const activeProfiles = activeCapabilityProfiles
    .map((selection) => profileById.get(selection.capability_profile_id))
    .filter((profile): profile is CapabilityProfileOption => Boolean(profile));
  const activeArtifacts = artifactRows
    .filter((artifact) => artifact.is_active !== false)
    .map((artifact) => ({
      artifact_id: artifact.artifact_id,
      artifact_type: artifact.artifact_type,
      artifact_data: toRecord(artifact.artifact_data),
      updated_at: artifact.updated_at,
    }));

  const selectionFingerprint = buildSelectionFingerprint(activeCapabilityProfiles);
  const evidenceFreshnessMarker = buildEvidenceFreshnessMarker(activeArtifacts);
  const fitCacheKey = `${context.user_id}:${selectionFingerprint}:${evidenceFreshnessMarker}`;
  const now = Date.now();
  const cached = fitCache.get(fitCacheKey);
  let fitByCapabilityProfileId: Record<string, CapabilityProfileFit> = {};

  if (cached && cached.expiresAt > now) {
    fitByCapabilityProfileId = cached.fitByCapabilityProfileId;
  } else {
    fitByCapabilityProfileId = Object.fromEntries(
      activeProfiles.map((profile) => [
        profile.capability_profile_id,
        computeCapabilityProfileFit({
          profile,
          artifacts: activeArtifacts,
          evidenceFreshnessMarker,
        }),
      ])
    );
    fitCache.set(fitCacheKey, {
      expiresAt: now + fitCacheTtlMs,
      fitByCapabilityProfileId,
    });
  }

  const rolesResponse = toRolesResponseFromModels({
    models: modelRows,
    roles: roleRows,
  });

  if (process.env.NODE_ENV !== "production") {
    const activeModelCount = modelRows.filter((model) => model.is_active === true).length;
    console.log("[student-capability-profiles] role query debug", {
      profile_id: context.user_id,
      model_count_total: modelRows.length,
      model_count_active: activeModelCount,
      role_row_count: roleRows.length,
      roles_response_count: rolesResponse.length,
      roles_response_sample: rolesResponse.slice(0, 10).map((role) => role.role_label),
      query_errors: {
        students: toErrorMessage(studentQuery.error),
        capability_models: toErrorMessage(modelQuery.error),
        companies: toErrorMessage(companyQuery.error),
        job_roles: toErrorMessage(roleQuery.error),
        artifacts: toErrorMessage(artifactQuery.error),
      },
    });
  }

  const queryErrors = {
    students: toErrorMessage(studentQuery.error),
    capability_models: toErrorMessage(modelQuery.error),
    companies: toErrorMessage(companyQuery.error),
    job_roles: toErrorMessage(roleQuery.error),
    artifacts: toErrorMessage(artifactQuery.error),
  };
  const debugPayload =
    process.env.NODE_ENV !== "production"
      ? {
          has_service_role_client: Boolean(serviceRoleClient),
          query_errors: queryErrors,
          row_counts: {
            capability_models: modelRows.length,
            companies: companyRows.length,
            job_roles: roleRows.length,
            artifacts: artifactRows.length,
            capability_profiles: capabilityProfiles.length,
          },
          dropped_model_counts: {
            missing_company_id: modelRows.filter((model) => !toTrimmedString(model.company_id)).length,
          },
        }
      : undefined;

  return ok({
    roles: rolesResponse,
    companies: toCompaniesResponse(companyRows),
    capability_profiles: capabilityProfiles.map((profile) => ({
      capability_profile_id: profile.capability_profile_id,
      company_id: profile.company_id,
      company_label: profile.company_label,
      role_id: profile.role_id,
      role_label: profile.role_label,
      capability_ids: profile.capability_ids,
    })),
    active_capability_profiles: activeCapabilityProfiles,
    employer_visibility_opt_in: toBoolean(
      existingStudentData.employer_visibility_opt_in ?? existingStudentData.target_employer_visibility_opt_in,
      false
    ),
    fit_by_capability_profile_id: fitByCapabilityProfileId,
    ...(debugPayload ? { debug: debugPayload } : {}),
  });
}
