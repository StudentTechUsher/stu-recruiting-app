import type { CapabilityModelVersion, RecruiterCapabilityModel } from "@/lib/recruiter/types";
import { getDevRecruiterIdentity, isDevIdentitiesEnabled } from "@/lib/dev-auth";
import {
  getActiveRoleCapabilityAxes,
  normalizeRoleCapabilityAxes,
  toLegacyWeights,
  validateRoleCapabilityAxes,
  type RoleCapabilityAxis,
} from "@/lib/recruiter/capability-axes";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type CapabilityModelRow = {
  capability_model_id: string;
  company_id: string | null;
  role_id?: string | null;
  recruiter_id: string | null;
  model_data: Record<string, unknown> | null;
  active_version_id: string | null;
  current_version: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type CapabilityModelVersionRow = {
  capability_model_version_id: string;
  capability_model_id: string;
  version_number: number | null;
  model_payload: Record<string, unknown> | null;
  created_at: string;
};

type LegacyCapabilityModelVersionRow = {
  capability_model_version_id: string;
  capability_model_id: string;
  version_number: number | null;
  org_id: string | null;
  weights: Record<string, number> | null;
  thresholds: Record<string, number> | null;
  required_evidence: string[] | null;
  notes: string | null;
  created_at: string;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumberRecord = (value: unknown): Record<string, number> => {
  const source = toRecord(value);
  const result: Record<string, number> = {};

  for (const [key, raw] of Object.entries(source)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }

  return result;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toVersionNumber = (value: number | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return 1;
};

const isCapabilityModelVersionsTableMissing = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code !== "PGRST205") return false;
  if (typeof candidate.message !== "string") return false;
  return candidate.message.toLowerCase().includes("capability_model_versions");
};

const buildSyntheticCapabilityModelVersion = (input: {
  capabilityModelId: string;
  companyId: string;
  modelPayload: Record<string, unknown>;
  status: CapabilityModelVersion["status"];
  createdAt: string;
  versionNumber?: number;
}): CapabilityModelVersion => {
  const axes = normalizeRoleCapabilityAxes({
    axes: input.modelPayload.axes,
    weights: input.modelPayload.weights,
  });
  const explicitWeights = toNumberRecord(input.modelPayload.weights);
  const weights = Object.keys(explicitWeights).length > 0 ? explicitWeights : toLegacyWeights(getActiveRoleCapabilityAxes(axes));
  return ({
  capability_model_version_id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${input.capabilityModelId}-synthetic-v${input.versionNumber ?? 1}`,
  capability_model_id: input.capabilityModelId,
  org_id: input.companyId,
  version_number: input.versionNumber ?? 1,
  status: input.status,
  axes,
  weights,
  thresholds: toNumberRecord(input.modelPayload.thresholds),
  required_evidence: toStringArray(input.modelPayload.required_evidence),
  notes: toStringOrNull(input.modelPayload.notes),
  created_at: input.createdAt,
  published_at: input.status === "published" ? input.createdAt : null,
  });
};

const toVersionRowFromLegacy = (row: LegacyCapabilityModelVersionRow): CapabilityModelVersionRow => ({
  capability_model_version_id: row.capability_model_version_id,
  capability_model_id: row.capability_model_id,
  version_number: row.version_number,
  model_payload: {
    company_id: row.org_id,
    axes: normalizeRoleCapabilityAxes({
      axes: null,
      weights: row.weights ?? {},
    }),
    weights: row.weights ?? {},
    thresholds: row.thresholds ?? {},
    required_evidence: row.required_evidence ?? [],
    notes: row.notes ?? null,
  },
  created_at: row.created_at,
});

const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuidLike = (value: string): boolean => uuidLikePattern.test(value.trim());

async function resolveScopedCompanyId(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceRoleClient>>,
  orgId: string,
  { createIfMissing }: { createIfMissing: boolean }
): Promise<string | null> {
  const normalizedOrgId = orgId.trim();

  if (isUuidLike(normalizedOrgId)) {
    if (!createIfMissing || !isDevIdentitiesEnabled()) {
      return normalizedOrgId;
    }

    const { data: existingCompany } = (await supabase
      .from("companies")
      .select("company_id")
      .eq("company_id", normalizedOrgId)
      .limit(1)
      .single()) as { data: { company_id: string } | null };

    if (existingCompany?.company_id) {
      return existingCompany.company_id;
    }

    const { data: insertedCompany } = (await supabase
      .from("companies")
      .insert({
        company_id: normalizedOrgId,
        company_name: `Dev Org ${normalizedOrgId.slice(0, 8)}`,
      })
      .select("company_id")
      .limit(1)
      .single()) as { data: { company_id: string } | null };

    return insertedCompany?.company_id ?? normalizedOrgId;
  }

  if (!isDevIdentitiesEnabled()) {
    return null;
  }

  const { data: firstCompanyRows } = (await supabase
    .from("companies")
    .select("company_id")
    .order("created_at", { ascending: true })
    .limit(1)) as { data: Array<{ company_id: string }> | null };

  const firstCompanyId = firstCompanyRows?.[0]?.company_id ?? null;
  if (firstCompanyId) {
    return firstCompanyId;
  }

  if (!createIfMissing) {
    return null;
  }

  const { data: insertedFallbackCompany } = (await supabase
    .from("companies")
    .insert({ company_name: `Dev Company ${Date.now()}` })
    .select("company_id")
    .limit(1)
    .single()) as { data: { company_id: string } | null };

  return insertedFallbackCompany?.company_id ?? null;
}

async function fetchCapabilityModelVersionRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceRoleClient>>,
  modelId: string
): Promise<CapabilityModelVersionRow[]> {
  const nextShape = (await supabase
    .from("capability_model_versions")
    .select("capability_model_version_id, capability_model_id, version_number, model_payload, created_at")
    .eq("capability_model_id", modelId)
    .order("version_number", { ascending: false })) as { data: CapabilityModelVersionRow[] | null; error: unknown };

  if (!nextShape.error) {
    return nextShape.data ?? [];
  }

  const legacyShape = (await supabase
    .from("capability_model_versions")
    .select(
      "capability_model_version_id, capability_model_id, version_number, org_id, weights, thresholds, required_evidence, notes, created_at"
    )
    .eq("capability_model_id", modelId)
    .order("version_number", { ascending: false })) as {
    data: LegacyCapabilityModelVersionRow[] | null;
    error: unknown;
  };

  if (legacyShape.error) {
    return [];
  }

  return (legacyShape.data ?? []).map(toVersionRowFromLegacy);
}

async function fetchCapabilityModelVersionRowById(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceRoleClient>>,
  modelId: string,
  versionId: string
): Promise<CapabilityModelVersionRow | null> {
  const nextShape = (await supabase
    .from("capability_model_versions")
    .select("capability_model_version_id, capability_model_id, version_number, model_payload, created_at")
    .eq("capability_model_id", modelId)
    .eq("capability_model_version_id", versionId)
    .limit(1)
    .single()) as { data: CapabilityModelVersionRow | null; error: unknown };

  if (!nextShape.error && nextShape.data) {
    return nextShape.data;
  }

  const legacyShape = (await supabase
    .from("capability_model_versions")
    .select(
      "capability_model_version_id, capability_model_id, version_number, org_id, weights, thresholds, required_evidence, notes, created_at"
    )
    .eq("capability_model_id", modelId)
    .eq("capability_model_version_id", versionId)
    .limit(1)
    .single()) as { data: LegacyCapabilityModelVersionRow | null; error: unknown };

  if (legacyShape.error || !legacyShape.data) {
    return null;
  }

  return toVersionRowFromLegacy(legacyShape.data);
}

async function insertCapabilityModelVersionRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceRoleClient>>,
  input: {
    capabilityModelId: string;
    versionNumber: number;
    companyId: string;
    modelPayload: Record<string, unknown>;
    publish: boolean;
  }
): Promise<{ row: CapabilityModelVersionRow | null; error: unknown }> {
  const nextShape = (await supabase
    .from("capability_model_versions")
    .insert({
      capability_model_id: input.capabilityModelId,
      version_number: input.versionNumber,
      model_payload: input.modelPayload,
    })
    .select("capability_model_version_id, capability_model_id, version_number, model_payload, created_at")
    .limit(1)
    .single()) as { data: CapabilityModelVersionRow | null; error: unknown };

  if (!nextShape.error && nextShape.data) {
    return { row: nextShape.data, error: null };
  }

  const legacyShape = (await supabase
    .from("capability_model_versions")
    .insert({
      capability_model_id: input.capabilityModelId,
      org_id: input.companyId,
      version_number: input.versionNumber,
      status: input.publish ? "published" : "draft",
      weights: toNumberRecord(input.modelPayload.weights),
      thresholds: toNumberRecord(input.modelPayload.thresholds),
      required_evidence: toStringArray(input.modelPayload.required_evidence),
      notes: toStringOrNull(input.modelPayload.notes),
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select(
      "capability_model_version_id, capability_model_id, version_number, org_id, weights, thresholds, required_evidence, notes, created_at"
    )
    .limit(1)
    .single()) as { data: LegacyCapabilityModelVersionRow | null; error: unknown };

  if (legacyShape.error || !legacyShape.data) {
    return { row: null, error: legacyShape.error ?? nextShape.error };
  }

  return { row: toVersionRowFromLegacy(legacyShape.data), error: null };
}

const resolveVersionStatus = ({
  versionId,
  activeVersionId,
  versionNumber,
  currentVersion,
}: {
  versionId: string;
  activeVersionId: string | null;
  versionNumber: number;
  currentVersion: number;
}): CapabilityModelVersion["status"] => {
  if (activeVersionId && activeVersionId === versionId) return "published";
  if (versionNumber === currentVersion) return "draft";
  return "archived";
};

const buildModelPayload = (input: {
  companyId: string;
  recruiterId: string;
  modelName: string;
  description?: string | null;
  roleId?: string | null;
  axes: RoleCapabilityAxis[];
  thresholds: Record<string, number>;
  requiredEvidence: string[];
  notes?: string | null;
}): Record<string, unknown> => ({
  company_id: input.companyId,
  recruiter_id: input.recruiterId,
  role_id: input.roleId ?? null,
  model_name: input.modelName,
  description: input.description ?? null,
  axes: input.axes,
  weights: toLegacyWeights(input.axes),
  thresholds: input.thresholds,
  required_evidence: input.requiredEvidence,
  notes: input.notes ?? null,
});

const toModel = (row: CapabilityModelRow): RecruiterCapabilityModel => ({
  capability_model_id: row.capability_model_id,
  org_id: row.company_id ?? "",
  model_name: toStringOrNull(row.model_data?.model_name) ?? "Untitled Model",
  description: toStringOrNull(row.model_data?.description),
  active_version_id: row.active_version_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const toVersion = (
  row: CapabilityModelVersionRow,
  { activeVersionId, currentVersion }: { activeVersionId: string | null; currentVersion: number }
): CapabilityModelVersion => {
  const payload = toRecord(row.model_payload);
  const versionNumber = toVersionNumber(row.version_number);
  const status = resolveVersionStatus({
    versionId: row.capability_model_version_id,
    activeVersionId,
    versionNumber,
    currentVersion,
  });

  return {
    capability_model_version_id: row.capability_model_version_id,
    capability_model_id: row.capability_model_id,
    org_id: toStringOrNull(payload.company_id) ?? "",
    version_number: versionNumber,
    status,
    axes: normalizeRoleCapabilityAxes({
      axes: payload.axes,
      weights: payload.weights,
    }),
    weights: (() => {
      const explicitWeights = toNumberRecord(payload.weights);
      if (Object.keys(explicitWeights).length > 0) return explicitWeights;
      const normalizedAxes = normalizeRoleCapabilityAxes({
        axes: payload.axes,
        weights: payload.weights,
      });
      return toLegacyWeights(getActiveRoleCapabilityAxes(normalizedAxes));
    })(),
    thresholds: toNumberRecord(payload.thresholds),
    required_evidence: toStringArray(payload.required_evidence),
    notes: toStringOrNull(payload.notes),
    created_at: row.created_at,
    published_at: status === "published" ? row.created_at : null,
  };
};

export async function getRecruiterIdByUserId(userId: string): Promise<string | null> {
  const devRecruiterIdentity = getDevRecruiterIdentity();
  const isDevRecruiterProfile = isDevIdentitiesEnabled() && userId === devRecruiterIdentity.profileId;
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return isDevRecruiterProfile ? devRecruiterIdentity.recruiterId : null;
  }

  const { data, error } = await supabase
    .from("recruiters")
    .select("recruiter_id")
    .eq("profile_id", userId)
    .limit(1)
    .single();

  if (!error && data) {
    return (data as { recruiter_id: string }).recruiter_id;
  }

  if (isDevRecruiterProfile) {
    const { data: devRecruiterById } = (await supabase
      .from("recruiters")
      .select("recruiter_id")
      .eq("recruiter_id", devRecruiterIdentity.recruiterId)
      .limit(1)
      .single()) as { data: { recruiter_id: string } | null };

    if (devRecruiterById?.recruiter_id) {
      return devRecruiterById.recruiter_id;
    }
  }

  return null;
}

export async function ensureRecruiterIdByUserId(userId: string): Promise<string | null> {
  const existingRecruiterId = await getRecruiterIdByUserId(userId);
  if (existingRecruiterId) return existingRecruiterId;

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;

  if (isUuidLike(userId)) {
    const { data: insertedRecruiter } = (await supabase
      .from("recruiters")
      .insert({ profile_id: userId })
      .select("recruiter_id")
      .limit(1)
      .single()) as { data: { recruiter_id: string } | null };

    if (insertedRecruiter?.recruiter_id) {
      return insertedRecruiter.recruiter_id;
    }
  }

  if (isDevIdentitiesEnabled()) {
    const { data: recruiterRows } = (await supabase
      .from("recruiters")
      .select("recruiter_id")
      .order("created_at", { ascending: true })
      .limit(1)) as { data: Array<{ recruiter_id: string }> | null };

    const fallbackRecruiterId = recruiterRows?.[0]?.recruiter_id ?? null;
    if (fallbackRecruiterId) {
      return fallbackRecruiterId;
    }
  }

  // Handle conflict/race: another request may have created the row first.
  return getRecruiterIdByUserId(userId);
}

export async function listCapabilityModels(recruiterId: string): Promise<RecruiterCapabilityModel[]> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return [];

  const { data } = (await supabase
    .from("capability_models")
    .select(
      "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
    )
    .eq("recruiter_id", recruiterId)
    .order("updated_at", { ascending: false })) as { data: CapabilityModelRow[] | null };

  return (data ?? []).map(toModel);
}

export async function getCapabilityModel(orgId: string, modelId: string): Promise<{
  model: RecruiterCapabilityModel | null;
  versions: CapabilityModelVersion[];
}> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { model: null, versions: [] };
  const scopedCompanyId = await resolveScopedCompanyId(supabase, orgId, { createIfMissing: false });
  if (!scopedCompanyId) return { model: null, versions: [] };

  const [{ data: modelRow }, versionRows] = await Promise.all([
    supabase
      .from("capability_models")
      .select(
        "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
      )
      .eq("company_id", scopedCompanyId)
      .eq("capability_model_id", modelId)
      .limit(1)
      .single(),
    fetchCapabilityModelVersionRows(supabase, modelId),
  ]) as [{ data: CapabilityModelRow | null }, CapabilityModelVersionRow[]];

  const model = modelRow ? toModel(modelRow) : null;
  const currentVersion = toVersionNumber(modelRow?.current_version);
  const activeVersionId = modelRow?.active_version_id ?? null;
  const versions = versionRows.map((row) => toVersion(row, { activeVersionId, currentVersion }));

  return { model, versions };
}

export async function createCapabilityModel(input: {
  orgId: string;
  userId: string;
  recruiterId: string;
  modelName: string;
  description?: string | null;
  roleId?: string | null;
  axes?: RoleCapabilityAxis[];
  weights?: Record<string, number>;
  thresholds: Record<string, number>;
  requiredEvidence: string[];
  notes?: string | null;
  publish?: boolean;
}): Promise<{ model: RecruiterCapabilityModel; version: CapabilityModelVersion }> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");
  const scopedCompanyId = await resolveScopedCompanyId(supabase, input.orgId, { createIfMissing: true });
  if (!scopedCompanyId) {
    throw new Error("capability_model_company_not_found");
  }

  const normalizedAxes = normalizeRoleCapabilityAxes({
    axes: input.axes ?? null,
    weights: input.weights ?? {},
  });
  const validationError = validateRoleCapabilityAxes(normalizedAxes);
  if (validationError) throw new Error(validationError);

  const modelPayload = buildModelPayload({
    companyId: scopedCompanyId,
    recruiterId: input.recruiterId,
    modelName: input.modelName,
    description: input.description ?? null,
    roleId: input.roleId ?? null,
    axes: normalizedAxes,
    thresholds: input.thresholds,
    requiredEvidence: input.requiredEvidence,
    notes: input.notes ?? null,
  });

  const { data: insertedModel, error: modelInsertError } = (await supabase
    .from("capability_models")
    .insert({
      company_id: scopedCompanyId,
      role_id: input.roleId ?? null,
      recruiter_id: input.recruiterId,
      model_data: modelPayload,
      current_version: 1,
      is_active: Boolean(input.publish),
    })
    .select(
      "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
    )
    .limit(1)
    .single()) as { data: CapabilityModelRow | null; error: unknown };

  if (modelInsertError || !insertedModel) {
    console.error("capability_model_create_insert_failed", {
      company_id: scopedCompanyId,
      recruiter_id: input.recruiterId,
      user_id: input.userId,
      org_id: input.orgId,
      error: modelInsertError,
    });
    throw new Error("capability_model_create_failed");
  }

  const { row: insertedVersion, error: versionInsertError } = await insertCapabilityModelVersionRow(supabase, {
    capabilityModelId: insertedModel.capability_model_id,
    versionNumber: 1,
    companyId: scopedCompanyId,
    modelPayload,
    publish: Boolean(input.publish),
  });

  if (versionInsertError || !insertedVersion) {
    if (isCapabilityModelVersionsTableMissing(versionInsertError)) {
      console.warn("capability_model_versions_table_missing_create_fallback", {
        capability_model_id: insertedModel.capability_model_id,
        company_id: scopedCompanyId,
      });

      return {
        model: toModel(insertedModel),
        version: buildSyntheticCapabilityModelVersion({
          capabilityModelId: insertedModel.capability_model_id,
          companyId: scopedCompanyId,
          modelPayload,
          status: input.publish ? "published" : "draft",
          createdAt: insertedModel.created_at,
          versionNumber: 1,
        }),
      };
    }

    console.error("capability_model_version_create_insert_failed", {
      capability_model_id: insertedModel.capability_model_id,
      company_id: scopedCompanyId,
      recruiter_id: input.recruiterId,
      error: versionInsertError,
    });
    await supabase.from("capability_models").delete().eq("capability_model_id", insertedModel.capability_model_id);
    throw new Error("capability_model_version_create_failed");
  }

  let finalModel = insertedModel;
  if (input.publish) {
    const { data: updatedModel } = await supabase
      .from("capability_models")
      .update({ active_version_id: insertedVersion.capability_model_version_id, is_active: true })
      .eq("capability_model_id", insertedModel.capability_model_id)
      .select(
        "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
      )
      .limit(1)
      .single();

    if (updatedModel) {
      finalModel = updatedModel as CapabilityModelRow;
    }
  }

  return {
    model: toModel(finalModel),
    version: toVersion(insertedVersion, {
      activeVersionId: finalModel.active_version_id ?? null,
      currentVersion: toVersionNumber(finalModel.current_version),
    }),
  };
}

export async function createCapabilityModelVersion(input: {
  orgId: string;
  userId: string;
  modelId: string;
  axes?: RoleCapabilityAxis[];
  weights?: Record<string, number>;
  thresholds: Record<string, number>;
  requiredEvidence: string[];
  notes?: string | null;
}): Promise<CapabilityModelVersion> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");
  const scopedCompanyId = await resolveScopedCompanyId(supabase, input.orgId, { createIfMissing: false });
  if (!scopedCompanyId) {
    throw new Error("capability_model_company_not_found");
  }

  const { data: modelRow } = (await supabase
    .from("capability_models")
    .select(
      "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
    )
    .eq("company_id", scopedCompanyId)
    .eq("capability_model_id", input.modelId)
    .limit(1)
    .single()) as { data: CapabilityModelRow | null };

  if (!modelRow) {
    throw new Error("capability_model_not_found");
  }

  const currentModelData = toRecord(modelRow.model_data);
  const nextVersionNumber = toVersionNumber(modelRow.current_version) + 1;
  const normalizedAxes = normalizeRoleCapabilityAxes({
    axes: input.axes ?? null,
    weights: input.weights ?? {},
  });
  const validationError = validateRoleCapabilityAxes(normalizedAxes);
  if (validationError) throw new Error(validationError);

  const modelPayload = {
    ...currentModelData,
    company_id: scopedCompanyId,
    axes: normalizedAxes,
    weights: toLegacyWeights(normalizedAxes),
    thresholds: input.thresholds,
    required_evidence: input.requiredEvidence,
    notes: input.notes ?? null,
  };

  const { row: insertedVersion, error } = await insertCapabilityModelVersionRow(supabase, {
    capabilityModelId: input.modelId,
    versionNumber: nextVersionNumber,
    companyId: scopedCompanyId,
    modelPayload,
    publish: false,
  });

  if (error || !insertedVersion) {
    throw new Error("capability_model_version_create_failed");
  }

  await supabase
    .from("capability_models")
    .update({
      current_version: nextVersionNumber,
      model_data: modelPayload,
    })
    .eq("capability_model_id", input.modelId);

  return toVersion(insertedVersion, {
    activeVersionId: modelRow.active_version_id ?? null,
    currentVersion: nextVersionNumber,
  });
}

export async function publishCapabilityModelVersion(input: {
  orgId: string;
  modelId: string;
  versionId: string;
}): Promise<CapabilityModelVersion> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");
  const scopedCompanyId = await resolveScopedCompanyId(supabase, input.orgId, { createIfMissing: false });
  if (!scopedCompanyId) {
    throw new Error("capability_model_company_not_found");
  }

  const [{ data: modelRow }, versionRow] = (await Promise.all([
    supabase
      .from("capability_models")
      .select(
        "capability_model_id, company_id, recruiter_id, model_data, active_version_id, current_version, is_active, created_at, updated_at"
      )
      .eq("company_id", scopedCompanyId)
      .eq("capability_model_id", input.modelId)
      .limit(1)
      .single(),
    fetchCapabilityModelVersionRowById(supabase, input.modelId, input.versionId),
  ])) as [{ data: CapabilityModelRow | null }, CapabilityModelVersionRow | null];

  if (!modelRow || !versionRow) {
    throw new Error("capability_model_publish_failed");
  }

  await supabase
    .from("capability_models")
    .update({
      active_version_id: input.versionId,
      is_active: true,
      model_data: toRecord(versionRow.model_payload),
      current_version: Math.max(toVersionNumber(modelRow.current_version), toVersionNumber(versionRow.version_number)),
    })
    .eq("capability_model_id", input.modelId)
    .limit(1);

  return toVersion(versionRow, {
    activeVersionId: input.versionId,
    currentVersion: Math.max(toVersionNumber(modelRow.current_version), toVersionNumber(versionRow.version_number)),
  });
}
