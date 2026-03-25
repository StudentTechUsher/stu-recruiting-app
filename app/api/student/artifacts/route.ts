import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  source_provenance: unknown;
  source_object_id: string | null;
  ingestion_run_id: string | null;
  active_version_id: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type ArtifactVersionRow = {
  version_id: string;
  artifact_id: string;
  operation: "legacy_seed" | "manual_create" | "replace" | "reextract" | "deactivate";
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  verification_status: string | null;
  source_provenance: unknown;
  source_object_id: string | null;
  ingestion_run_id: string | null;
  created_at: string;
};

type StudentDataRow = {
  student_data: unknown;
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
  "club",
  "project",
  "internship",
  "certification",
  "leadership",
  "competition",
  "research",
  "employment",
  "test",
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
  "score",
  "verification_status",
  "verification_method",
  "verification_source",
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

const toVerificationStatus = (artifactData: Record<string, unknown>): "verified" | "pending" | "unverified" => {
  const normalized = toTrimmedString(artifactData.verification_status)?.toLowerCase();
  if (normalized === "verified" || normalized === "pending" || normalized === "unverified") return normalized;
  return "unverified";
};

const getArtifactsClient = async (sessionSource: "mock" | "supabase" | "none" | undefined) => {
  if (sessionSource === "mock") {
    const serviceRoleClient = getSupabaseServiceRoleClient();
    if (serviceRoleClient) return serviceRoleClient;
  }
  return getSupabaseServerClient();
};

const buildDevFallbackArtifacts = (profileId: string) => {
  const now = Date.now();
  const iso = (offsetHours: number) => new Date(now - offsetHours * 60 * 60 * 1000).toISOString();

  return [
    {
      artifact_id: `dev-sample-verified-${profileId}`,
      artifact_type: "coursework",
      artifact_data: {
        title: "CS 330 Algorithms Coursework",
        source: "BYU Transcript",
        description: "Completed an advanced algorithms course and documented runtime tradeoffs.",
        type: "coursework",
        tags: ["coursework", "algorithms", "verified"],
        course_code: "CS 330",
        course_title: "Algorithms",
        verification_status: "verified",
        verification_method: "transcript_parse",
        verification_source: "transcript_pdf",
      },
      file_refs: [],
      created_at: iso(72),
      updated_at: iso(72),
      provenance_versions: [],
    },
    {
      artifact_id: `dev-sample-unverified-${profileId}`,
      artifact_type: "project",
      artifact_data: {
        title: "Churn Prediction Side Project",
        source: "LinkedIn",
        description: "Built a churn model prototype and wrote a deployment-readiness summary.",
        type: "project",
        tags: ["ml", "product-analytics", "unverified"],
        project_demo_link: "https://github.com/sample/churn-prediction",
        verification_status: "unverified",
        verification_method: "linkedin_extraction",
        verification_source: "linkedin_profile",
      },
      file_refs: [],
      created_at: iso(24),
      updated_at: iso(24),
      provenance_versions: [],
    },
  ];
};

const hasCourseworkVerificationFile = (fileRefs: Record<string, unknown>[]): boolean => {
  if (fileRefs.length === 0) return false;
  return fileRefs.some((fileRef) => {
    const kind = toTrimmedString(fileRef.kind);
    return kind === "syllabus" || kind === "artifact_supporting_file";
  });
};

const isTranscriptBackedCoursework = (artifactData: Record<string, unknown>): boolean => {
  const parsedCourseId = toTrimmedString(artifactData.parsed_course_id);
  if (parsedCourseId) return true;

  const provenance = toRecord(artifactData.provenance);
  return toTrimmedString(provenance.source) === "transcript_parse";
};

const withCourseworkVerificationMetadata = ({
  artifactData,
  transcriptBacked,
}: {
  artifactData: Record<string, unknown>;
  transcriptBacked: boolean;
}): Record<string, unknown> => {
  if (transcriptBacked) {
    return {
      ...artifactData,
      verification_status: "verified",
      verification_method: "transcript_parse",
    };
  }

  return {
    ...artifactData,
    verification_status: "pending",
    verification_method: "syllabus_upload",
    verification_source: "manual_coursework_submission",
  };
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
      const tags = rawValue
        .filter((item) => typeof item === "string")
        .map((item) => (item as string).trim())
        .filter(Boolean);
      updates[key] = tags.length > 0 ? tags : null;
      continue;
    }
  }

  return updates;
};

const createArtifactVersion = async ({
  supabase,
  artifactId,
  profileId,
  operation,
  artifactType,
  artifactData,
  fileRefs,
  sourceProvenance,
  sourceObjectId,
  ingestionRunId,
}: {
  supabase: Awaited<ReturnType<typeof getArtifactsClient>>;
  artifactId: string;
  profileId: string;
  operation: "manual_create" | "replace" | "reextract" | "deactivate";
  artifactType: string;
  artifactData: Record<string, unknown>;
  fileRefs: Record<string, unknown>[];
  sourceProvenance: Record<string, unknown>;
  sourceObjectId: string | null;
  ingestionRunId: string | null;
}) => {
  if (!supabase) throw new Error("supabase_unavailable");
  const { data, error } = await supabase
    .from("artifact_versions")
    .insert({
      artifact_id: artifactId,
      profile_id: profileId,
      operation,
      artifact_type: artifactType,
      artifact_data: artifactData,
      file_refs: fileRefs,
      verification_status: toVerificationStatus(artifactData),
      source_provenance: sourceProvenance,
      source_object_id: sourceObjectId,
      ingestion_run_id: ingestionRunId,
    })
    .select("version_id")
    .single<{ version_id: string }>();

  if (error || !data?.version_id) throw new Error("artifact_version_create_failed");
  return data.version_id;
};

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"], { requireOnboarding: false })) return forbidden();

  const supabase = await getArtifactsClient(context.session_source);
  if (!supabase) {
    return ok({
      resource: "artifacts",
      profile_id: context.user_id,
      artifacts: [],
      session_source: context.session_source ?? "none",
    });
  }

  const [{ data }, { data: sessionRows }, { data: studentRows }] = (await Promise.all([
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id, active_version_id, is_active, created_at, updated_at")
      .eq("profile_id", context.user_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("transcript_parse_sessions")
      .select("session_id, profile_id, transcript_artifact_id, status, parser_model, parse_summary, parse_error, created_at, updated_at")
      .eq("profile_id", context.user_id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
  ])) as [{ data: ArtifactRow[] | null }, { data: TranscriptSessionRow[] | null }, { data: StudentDataRow[] | null }];

  const activeRows = (data ?? []).filter((row) => row.is_active !== false);
  const artifactIds = activeRows.map((row) => row.artifact_id);

  const versionsQuery =
    artifactIds.length > 0
      ? await (supabase
          .from("artifact_versions")
          .select("version_id, artifact_id, operation, artifact_type, artifact_data, file_refs, verification_status, source_provenance, source_object_id, ingestion_run_id, created_at")
          .in("artifact_id", artifactIds)
          .order("created_at", { ascending: false })) as { data: ArtifactVersionRow[] | null }
      : ({ data: [] } as { data: ArtifactVersionRow[] | null });

  const versionsByArtifactId = new Map<string, ArtifactVersionRow[]>();
  for (const versionRow of versionsQuery.data ?? []) {
    const existing = versionsByArtifactId.get(versionRow.artifact_id) ?? [];
    existing.push(versionRow);
    versionsByArtifactId.set(versionRow.artifact_id, existing);
  }

  const artifacts = activeRows.map((row) => {
    const versions = versionsByArtifactId.get(row.artifact_id) ?? [];
    const provenanceVersions = versions
      .filter((version) => version.version_id !== row.active_version_id)
      .map((version) => ({
        version_id: version.version_id,
        operation: version.operation,
        artifact_data: version.artifact_data,
        file_refs: version.file_refs,
        verification_status: version.verification_status,
        source_provenance: version.source_provenance,
        source_object_id: version.source_object_id,
        ingestion_run_id: version.ingestion_run_id,
        created_at: version.created_at,
      }));

    return {
      artifact_id: row.artifact_id,
      artifact_type: row.artifact_type,
      artifact_data: row.artifact_data,
      file_refs: row.file_refs,
      source_provenance: row.source_provenance,
      source_object_id: row.source_object_id,
      ingestion_run_id: row.ingestion_run_id,
      active_version_id: row.active_version_id,
      version_count: versions.length,
      provenance_versions: provenanceVersions,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  const artifactsWithFallback =
    artifacts.length === 0 && context.session_source === "mock" ? buildDevFallbackArtifacts(context.user_id) : artifacts;

  const studentData = toRecord((studentRows ?? [])[0]?.student_data);
  const sourceExtractionLog = toRecord(studentData.source_extraction_log);
  const artifactProfileLinks = toRecord(studentData.artifact_profile_links);
  const profileLinksFromExtraction = toRecord(studentData.profile_links);
  const profileLinks: Record<string, unknown> = { ...artifactProfileLinks };
  for (const [key, value] of Object.entries(profileLinksFromExtraction)) {
    const normalized = toTrimmedString(value);
    if (normalized !== null) {
      profileLinks[key] = normalized;
      continue;
    }
    if (typeof value !== "string") {
      profileLinks[key] = value;
    }
  }

  return ok({
    resource: "artifacts",
    profile_id: context.user_id,
    artifacts: artifactsWithFallback,
    latest_transcript_session: sessionRows?.[0] ?? null,
    source_extraction_log: sourceExtractionLog,
    profile_links: profileLinks,
    session_source: context.session_source ?? "none",
  });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getArtifactsClient(context.session_source);
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
  const transcriptBackedCoursework = artifactType === "coursework" ? isTranscriptBackedCoursework(artifactData) : false;
  if (artifactType === "coursework" && !transcriptBackedCoursework && !hasCourseworkVerificationFile(fileRefs)) {
    return badRequest("coursework_syllabus_required");
  }
  const artifactDataToPersist =
    artifactType === "coursework"
      ? withCourseworkVerificationMetadata({ artifactData, transcriptBacked: transcriptBackedCoursework })
      : artifactData;
  const sourceProvenance = toRecord(payloadRecord.source_provenance ?? artifactDataToPersist.provenance);
  const sourceObjectId = toTrimmedString(payloadRecord.source_object_id ?? sourceProvenance.source_object_id);
  const ingestionRunId = toTrimmedString(payloadRecord.ingestion_run_id ?? sourceProvenance.ingestion_run_id);

  const { data: inserted, error } = await supabase
    .from("artifacts")
    .insert({
      profile_id: context.user_id,
      artifact_type: artifactType,
      artifact_data: artifactDataToPersist,
      file_refs: fileRefs,
      source_provenance: sourceProvenance,
      source_object_id: sourceObjectId,
      ingestion_run_id: ingestionRunId,
      is_active: true,
    })
    .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id, active_version_id, is_active, created_at, updated_at")
    .single<ArtifactRow>();

  if (error || !inserted) return badRequest("artifact_create_failed");

  try {
    const versionId = await createArtifactVersion({
      supabase,
      artifactId: inserted.artifact_id,
      profileId: context.user_id,
      operation: "manual_create",
      artifactType,
      artifactData: toRecord(inserted.artifact_data),
      fileRefs: toFileRefs(inserted.file_refs),
      sourceProvenance: toRecord(inserted.source_provenance),
      sourceObjectId: inserted.source_object_id,
      ingestionRunId: inserted.ingestion_run_id,
    });

    await supabase.from("artifacts").update({ active_version_id: versionId }).eq("artifact_id", inserted.artifact_id);

    return ok({
      resource: "artifacts",
      artifact: {
        ...inserted,
        active_version_id: versionId,
        version_count: 1,
        provenance_versions: [],
      },
      status: "created",
      session_source: context.session_source ?? "none",
    });
  } catch {
    await supabase.from("artifacts").delete().eq("artifact_id", inserted.artifact_id).eq("profile_id", context.user_id);
    return badRequest("artifact_create_failed");
  }
}

export async function PATCH(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getArtifactsClient(context.session_source);
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
    .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id, active_version_id, is_active")
    .eq("artifact_id", artifactId)
    .eq("profile_id", context.user_id)
    .single<ArtifactRow>();

  if (existingError || !existing) return badRequest("artifact_not_found");

  let nextArtifactData = {
    ...toRecord(existing.artifact_data),
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete nextArtifactData[key];
    } else {
      nextArtifactData[key] = value;
    }
  }

  const nextFileRefs = fileRefs.length > 0 ? fileRefs : toFileRefs(existing.file_refs);
  if (existing.artifact_type === "coursework") {
    const transcriptBackedCoursework = isTranscriptBackedCoursework(nextArtifactData);
    if (!transcriptBackedCoursework && !hasCourseworkVerificationFile(nextFileRefs)) {
      return badRequest("coursework_syllabus_required");
    }
    nextArtifactData = withCourseworkVerificationMetadata({
      artifactData: nextArtifactData,
      transcriptBacked: transcriptBackedCoursework,
    });
  }

  const sourceProvenance =
    Object.prototype.hasOwnProperty.call(payloadRecord, "source_provenance")
      ? toRecord(payloadRecord.source_provenance)
      : toRecord(existing.source_provenance);
  const sourceObjectId =
    Object.prototype.hasOwnProperty.call(payloadRecord, "source_object_id")
      ? toTrimmedString(payloadRecord.source_object_id)
      : toTrimmedString(existing.source_object_id);
  const ingestionRunId =
    Object.prototype.hasOwnProperty.call(payloadRecord, "ingestion_run_id")
      ? toTrimmedString(payloadRecord.ingestion_run_id)
      : toTrimmedString(existing.ingestion_run_id);

  try {
    const versionId = await createArtifactVersion({
      supabase,
      artifactId,
      profileId: context.user_id,
      operation: "replace",
      artifactType: existing.artifact_type,
      artifactData: nextArtifactData,
      fileRefs: nextFileRefs,
      sourceProvenance,
      sourceObjectId,
      ingestionRunId,
    });

    const { data: updated, error: updateError } = await supabase
      .from("artifacts")
      .update({
        artifact_data: nextArtifactData,
        file_refs: nextFileRefs,
        source_provenance: sourceProvenance,
        source_object_id: sourceObjectId,
        ingestion_run_id: ingestionRunId,
        is_active: true,
        deactivated_at: null,
        active_version_id: versionId,
      })
      .eq("artifact_id", artifactId)
      .eq("profile_id", context.user_id)
      .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id, active_version_id, is_active, created_at, updated_at")
      .single<ArtifactRow>();

    if (updateError || !updated) return badRequest("artifact_update_failed");

    return ok({
      resource: "artifacts",
      artifact: {
        ...updated,
      },
      status: "updated",
      session_source: context.session_source ?? "none",
    });
  } catch {
    return badRequest("artifact_update_failed");
  }
}

export async function DELETE(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getArtifactsClient(context.session_source);
  if (!supabase) return badRequest("supabase_unavailable");

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const payloadRecord = payload as Record<string, unknown>;
  const artifactId = toTrimmedString(payloadRecord.artifact_id);
  if (!artifactId) return badRequest("artifact_id_required");

  const { data: existing, error: existingError } = await supabase
    .from("artifacts")
    .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id")
    .eq("artifact_id", artifactId)
    .eq("profile_id", context.user_id)
    .single<ArtifactRow>();

  if (existingError || !existing) return badRequest("artifact_not_found");

  try {
    await createArtifactVersion({
      supabase,
      artifactId,
      profileId: context.user_id,
      operation: "deactivate",
      artifactType: existing.artifact_type,
      artifactData: toRecord(existing.artifact_data),
      fileRefs: toFileRefs(existing.file_refs),
      sourceProvenance: toRecord(existing.source_provenance),
      sourceObjectId: toTrimmedString(existing.source_object_id),
      ingestionRunId: toTrimmedString(existing.ingestion_run_id),
    });
  } catch {
    return badRequest("artifact_remove_failed");
  }

  const { error: deactivateError } = await supabase
    .from("artifacts")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      active_version_id: null,
    })
    .eq("artifact_id", artifactId)
    .eq("profile_id", context.user_id);

  if (deactivateError) return badRequest("artifact_remove_failed");

  return ok({
    resource: "artifacts",
    artifact_id: artifactId,
    status: "removed",
    session_source: context.session_source ?? "none",
  });
}
