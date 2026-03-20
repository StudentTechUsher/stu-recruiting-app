import type { CapabilityModelVersion, RecruiterCapabilityModel } from "@/lib/recruiter/types";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type CapabilityModelRow = {
  capability_model_id: string;
  org_id: string;
  model_name: string;
  description: string | null;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type CapabilityModelVersionRow = {
  capability_model_version_id: string;
  capability_model_id: string;
  org_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  weights: Record<string, number> | null;
  thresholds: Record<string, number> | null;
  required_evidence: string[] | null;
  notes: string | null;
  created_at: string;
  published_at: string | null;
};

const toModel = (row: CapabilityModelRow): RecruiterCapabilityModel => ({
  capability_model_id: row.capability_model_id,
  org_id: row.org_id,
  model_name: row.model_name,
  description: row.description,
  active_version_id: row.active_version_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const toVersion = (row: CapabilityModelVersionRow): CapabilityModelVersion => ({
  capability_model_version_id: row.capability_model_version_id,
  capability_model_id: row.capability_model_id,
  org_id: row.org_id,
  version_number: row.version_number,
  status: row.status,
  weights: row.weights ?? {},
  thresholds: row.thresholds ?? {},
  required_evidence: row.required_evidence ?? [],
  notes: row.notes,
  created_at: row.created_at,
  published_at: row.published_at,
});

export async function listCapabilityModels(orgId: string): Promise<RecruiterCapabilityModel[]> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return [];

  const { data } = (await supabase
    .from("capability_models")
    .select("capability_model_id, org_id, model_name, description, active_version_id, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })) as { data: CapabilityModelRow[] | null };

  return (data ?? []).map(toModel);
}

export async function getCapabilityModel(orgId: string, modelId: string): Promise<{
  model: RecruiterCapabilityModel | null;
  versions: CapabilityModelVersion[];
}> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { model: null, versions: [] };

  const [{ data: modelRows }, { data: versionRows }] = await Promise.all([
    supabase
      .from("capability_models")
      .select("capability_model_id, org_id, model_name, description, active_version_id, created_at, updated_at")
      .eq("org_id", orgId)
      .eq("capability_model_id", modelId)
      .limit(1),
    supabase
      .from("capability_model_versions")
      .select(
        "capability_model_version_id, capability_model_id, org_id, version_number, status, weights, thresholds, required_evidence, notes, created_at, published_at"
      )
      .eq("org_id", orgId)
      .eq("capability_model_id", modelId)
      .order("version_number", { ascending: false }),
  ]) as [{ data: CapabilityModelRow[] | null }, { data: CapabilityModelVersionRow[] | null }];

  const model = modelRows?.[0] ? toModel(modelRows[0]) : null;
  const versions = (versionRows ?? []).map(toVersion);

  return { model, versions };
}

export async function createCapabilityModel(input: {
  orgId: string;
  userId: string;
  modelName: string;
  description?: string | null;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  requiredEvidence: string[];
  notes?: string | null;
  publish?: boolean;
}): Promise<{ model: RecruiterCapabilityModel; version: CapabilityModelVersion }> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data: insertedModels, error: modelInsertError } = (await supabase
    .from("capability_models")
    .insert({
      org_id: input.orgId,
      model_name: input.modelName,
      description: input.description ?? null,
      created_by: input.userId,
    })
    .select("capability_model_id, org_id, model_name, description, active_version_id, created_at, updated_at")
    .limit(1)) as { data: CapabilityModelRow[] | null; error: unknown };

  if (modelInsertError || !insertedModels?.[0]) {
    throw new Error("capability_model_create_failed");
  }

  const status: "draft" | "published" = input.publish ? "published" : "draft";

  const { data: insertedVersions, error: versionInsertError } = (await supabase
    .from("capability_model_versions")
    .insert({
      capability_model_id: insertedModels[0].capability_model_id,
      org_id: input.orgId,
      version_number: 1,
      status,
      weights: input.weights,
      thresholds: input.thresholds,
      required_evidence: input.requiredEvidence,
      notes: input.notes ?? null,
      created_by: input.userId,
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select(
      "capability_model_version_id, capability_model_id, org_id, version_number, status, weights, thresholds, required_evidence, notes, created_at, published_at"
    )
    .limit(1)) as { data: CapabilityModelVersionRow[] | null; error: unknown };

  if (versionInsertError || !insertedVersions?.[0]) {
    throw new Error("capability_model_version_create_failed");
  }

  if (status === "published") {
    await supabase
      .from("capability_models")
      .update({ active_version_id: insertedVersions[0].capability_model_version_id })
      .eq("capability_model_id", insertedModels[0].capability_model_id)
      .eq("org_id", input.orgId);
  }

  return {
    model: toModel(insertedModels[0]),
    version: toVersion(insertedVersions[0]),
  };
}

export async function createCapabilityModelVersion(input: {
  orgId: string;
  userId: string;
  modelId: string;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  requiredEvidence: string[];
  notes?: string | null;
}): Promise<CapabilityModelVersion> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data: latestRows } = (await supabase
    .from("capability_model_versions")
    .select("version_number")
    .eq("org_id", input.orgId)
    .eq("capability_model_id", input.modelId)
    .order("version_number", { ascending: false })
    .limit(1)) as { data: Array<{ version_number: number }> | null };

  const nextVersionNumber = (latestRows?.[0]?.version_number ?? 0) + 1;

  const { data: insertedVersions, error } = (await supabase
    .from("capability_model_versions")
    .insert({
      capability_model_id: input.modelId,
      org_id: input.orgId,
      version_number: nextVersionNumber,
      status: "draft",
      weights: input.weights,
      thresholds: input.thresholds,
      required_evidence: input.requiredEvidence,
      notes: input.notes ?? null,
      created_by: input.userId,
    })
    .select(
      "capability_model_version_id, capability_model_id, org_id, version_number, status, weights, thresholds, required_evidence, notes, created_at, published_at"
    )
    .limit(1)) as { data: CapabilityModelVersionRow[] | null; error: unknown };

  if (error || !insertedVersions?.[0]) {
    throw new Error("capability_model_version_create_failed");
  }

  return toVersion(insertedVersions[0]);
}

export async function publishCapabilityModelVersion(input: {
  orgId: string;
  modelId: string;
  versionId: string;
}): Promise<CapabilityModelVersion> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  await supabase
    .from("capability_model_versions")
    .update({ status: "archived" })
    .eq("org_id", input.orgId)
    .eq("capability_model_id", input.modelId)
    .eq("status", "published");

  const { data: publishedRows, error } = (await supabase
    .from("capability_model_versions")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("org_id", input.orgId)
    .eq("capability_model_id", input.modelId)
    .eq("capability_model_version_id", input.versionId)
    .select(
      "capability_model_version_id, capability_model_id, org_id, version_number, status, weights, thresholds, required_evidence, notes, created_at, published_at"
    )
    .limit(1)) as { data: CapabilityModelVersionRow[] | null; error: unknown };

  if (error || !publishedRows?.[0]) {
    throw new Error("capability_model_publish_failed");
  }

  await supabase
    .from("capability_models")
    .update({ active_version_id: input.versionId })
    .eq("org_id", input.orgId)
    .eq("capability_model_id", input.modelId);

  return toVersion(publishedRows[0]);
}
