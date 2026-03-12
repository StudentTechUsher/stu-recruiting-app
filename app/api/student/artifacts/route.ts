import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  created_at: string;
  updated_at: string;
};

type TranscriptSessionRow = {
  session_id: string;
  profile_id: string;
  transcript_artifact_id: string;
  status: "uploaded" | "processing" | "parsed" | "failed";
  parser_model: string;
  parse_summary: Record<string, unknown>;
  parse_error: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const allowedArtifactTypes = new Set([
  "coursework",
  "project",
  "internship",
  "certification",
  "leadership",
  "competition",
  "research",
  "employment",
  "test"
]);

const editableArtifactDataKeys = new Set([
  "title",
  "source",
  "description",
  "type",
  "tags",
  "link",
  "attachment_name",
  "reference_contact_name",
  "reference_contact_role",
  "reference_quote",
  "course_code",
  "course_title",
  "instructor_name",
  "impact_description",
  "project_demo_link",
  "company",
  "job_title",
  "start_date",
  "end_date",
  "mentor_email",
  "impact_statement",
  "certification_name",
  "awarded_date",
  "organization",
  "position",
  "performance",
  "deliverable_note",
  "research_title",
  "research_area",
  "advisor",
  "assessment_name",
  "provider",
  "score"
]);

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toFileRefs = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry))
    .map((entry) => entry as Record<string, unknown>);
};

const toEditableArtifactUpdatesRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const updates: Record<string, unknown> = {};
  const source = value as Record<string, unknown>;

  for (const [key, rawValue] of Object.entries(source)) {
    if (!editableArtifactDataKeys.has(key)) continue;

    if (rawValue === null) {
      updates[key] = null;
      continue;
    }

    if (typeof rawValue === "string") {
      const normalized = rawValue.trim();
      updates[key] = normalized.length > 0 ? normalized : null;
      continue;
    }

    if (key === "tags" && Array.isArray(rawValue)) {
      const tags = rawValue.filter((item) => typeof item === "string").map((item) => (item as string).trim()).filter(Boolean);
      updates[key] = tags.length > 0 ? tags : null;
      continue;
    }
  }

  return updates;
};

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return ok({
      resource: "artifacts",
      profile_id: context.user_id,
      artifacts: [],
      session_source: context.session_source ?? "none"
    });
  }

  const [{ data }, { data: sessionRows }] = (await Promise.all([
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, file_refs, created_at, updated_at")
      .eq("profile_id", context.user_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("transcript_parse_sessions")
      .select("session_id, profile_id, transcript_artifact_id, status, parser_model, parse_summary, parse_error, created_at, updated_at")
      .eq("profile_id", context.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
  ])) as [{ data: ArtifactRow[] | null }, { data: TranscriptSessionRow[] | null }];

  const artifacts = (data ?? []).map((row) => ({
    artifact_id: row.artifact_id,
    artifact_type: row.artifact_type,
    artifact_data: row.artifact_data,
    file_refs: row.file_refs,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));

  return ok({
    resource: "artifacts",
    profile_id: context.user_id,
    artifacts,
    latest_transcript_session: sessionRows?.[0] ?? null,
    session_source: context.session_source ?? "none"
  });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const payloadRecord = payload as Record<string, unknown>;
  const artifactType = toTrimmedString(payloadRecord.artifact_type);
  if (!artifactType || !allowedArtifactTypes.has(artifactType)) return badRequest("artifact_type_invalid");

  const artifactData = toRecord(payloadRecord.artifact_data);
  const title = toTrimmedString(artifactData.title);
  const source = toTrimmedString(artifactData.source);
  const description = toTrimmedString(artifactData.description);
  if (!title || !source || !description) return badRequest("artifact_data_required_fields_missing");

  const fileRefs = toFileRefs(payloadRecord.file_refs);
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("artifacts")
    .insert({
      profile_id: context.user_id,
      artifact_type: artifactType,
      artifact_data: artifactData,
      file_refs: fileRefs
    })
    .select("artifact_id, artifact_type, artifact_data, file_refs, created_at, updated_at")
    .single<ArtifactRow>();

  if (error || !inserted) return badRequest("artifact_create_failed");

  return ok({
    resource: "artifacts",
    artifact: {
      ...inserted
    },
    status: "created",
    session_source: context.session_source ?? "none",
    created_at: now
  });
}

export async function PATCH(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const payloadRecord = payload as Record<string, unknown>;
  const artifactId = toTrimmedString(payloadRecord.artifact_id);
  if (!artifactId) return badRequest("artifact_id_required");

  const updates = toEditableArtifactUpdatesRecord(payloadRecord.updates);
  if (Object.keys(updates).length === 0) return badRequest("artifact_updates_required");
  const fileRefs = toFileRefs(payloadRecord.file_refs);

  const { data: existing, error: existingError } = await supabase
    .from("artifacts")
    .select("artifact_id, artifact_data")
    .eq("artifact_id", artifactId)
    .eq("profile_id", context.user_id)
    .single<{ artifact_id: string; artifact_data: unknown }>();

  if (existingError || !existing) return badRequest("artifact_not_found");

  const nextArtifactData = {
    ...toRecord(existing.artifact_data)
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete nextArtifactData[key];
    } else {
      nextArtifactData[key] = value;
    }
  }

  const updatePayload: Record<string, unknown> = {
    artifact_data: nextArtifactData
  };
  if (fileRefs.length > 0) {
    updatePayload.file_refs = fileRefs;
  }

  const { data: updated, error: updateError } = await supabase
    .from("artifacts")
    .update(updatePayload)
    .eq("artifact_id", artifactId)
    .eq("profile_id", context.user_id)
    .select("artifact_id, artifact_type, artifact_data, file_refs, created_at, updated_at")
    .single<ArtifactRow>();

  if (updateError || !updated) return badRequest("artifact_update_failed");

  return ok({
    resource: "artifacts",
    artifact: {
      ...updated
    },
    status: "updated",
    session_source: context.session_source ?? "none"
  });
}
