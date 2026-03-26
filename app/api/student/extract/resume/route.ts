import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  extractArtifactsFromDocument,
  persistExtractedArtifacts,
  type SupabaseClientLike,
  upsertStudentExtractionMetadata
} from "@/lib/artifacts/extraction";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart
} from "@/lib/observability/api";

type StorageFileRef = {
  bucket: string;
  path: string;
};
type StudentRow = { student_data: unknown };
type ArtifactCleanupRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  source_provenance: unknown;
  source_object_id: string | null;
  is_active: boolean | null;
};

const ARTIFACT_BUCKET = "student-artifacts-private";
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseStorageFileRef = (value: unknown): StorageFileRef | null => {
  const row = toRecord(value);
  const bucket = toTrimmedString(row.bucket);
  const path = toTrimmedString(row.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

const collectEmailsFromValue = (value: unknown, emailSet: Set<string>) => {
  if (typeof value === "string") {
    const matches = value.match(emailPattern) ?? [];
    for (const match of matches) {
      const normalized = match.trim().toLowerCase();
      if (normalized.length > 0) emailSet.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) collectEmailsFromValue(entry, emailSet);
    return;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectEmailsFromValue(entry, emailSet);
    }
  }
};

const collectResumeEmailsFromArtifacts = (artifacts: Array<{ artifact_data: Record<string, unknown> }>): string[] => {
  const emailSet = new Set<string>();
  for (const artifact of artifacts) {
    collectEmailsFromValue(artifact.artifact_data, emailSet);
  }
  return Array.from(emailSet.values());
};

const persistResumeSignals = async ({
  supabase,
  profileId,
  authEmail,
  resumeEmail,
  lowExtractionConfidence,
  fileName,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;
  profileId: string;
  authEmail: string | null;
  resumeEmail: string | null;
  lowExtractionConfidence: boolean;
  fileName: string;
}) => {
  const { data: studentRows } = (await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", profileId)
    .limit(1)) as { data: StudentRow[] | null };
  const existingStudentData = toRecord(studentRows?.[0]?.student_data);
  const existingSignals = toRecord(existingStudentData.onboarding_signals);
  const existingMismatch = toRecord(existingSignals.resume_email_mismatch);
  const existingIntake = toRecord(existingStudentData.onboarding_artifact_intake);
  const now = new Date().toISOString();

  const normalizedAuthEmail = toTrimmedString(authEmail)?.toLowerCase() ?? null;
  const normalizedResumeEmail = toTrimmedString(resumeEmail)?.toLowerCase() ?? null;
  const mismatchActive =
    Boolean(normalizedAuthEmail) &&
    Boolean(normalizedResumeEmail) &&
    normalizedAuthEmail !== normalizedResumeEmail;

  let nextMismatchSignal: Record<string, unknown> | null = null;
  if (mismatchActive && normalizedAuthEmail && normalizedResumeEmail) {
    nextMismatchSignal = {
      status: "active",
      auth_email: normalizedAuthEmail,
      resume_email: normalizedResumeEmail,
      detected_at: now,
      message:
        "Resume email does not match your account email. Employers using Stu Recruiting may not link your applications to this profile if emails differ.",
    };
  } else if (Object.keys(existingMismatch).length > 0) {
    nextMismatchSignal = {
      ...existingMismatch,
      status: "resolved",
      resolved_at: now,
      dismissed_at: null,
    };
  }

  const nextSignals: Record<string, unknown> = {
    ...existingSignals,
    low_extraction_confidence: {
      scope: "resume",
      active: lowExtractionConfidence,
      updated_at: now,
      reason: lowExtractionConfidence ? "resume_extraction_failed_or_low_yield" : "resume_extraction_ok",
    },
  };
  if (nextMismatchSignal) {
    nextSignals.resume_email_mismatch = nextMismatchSignal;
  }

  const nextStudentData: Record<string, unknown> = {
    ...existingStudentData,
    onboarding_signals: nextSignals,
    onboarding_artifact_intake: {
      ...existingIntake,
      resume_uploaded_at: now,
      resume_file_name: fileName,
      resume_extraction_status: lowExtractionConfidence ? "low_confidence" : "succeeded",
    },
  };

  await supabase.from("students").upsert(
    {
      profile_id: profileId,
      student_data: nextStudentData,
    },
    { onConflict: "profile_id" }
  );

  return {
    mismatch: nextMismatchSignal && nextMismatchSignal.status === "active" ? nextMismatchSignal : null,
    lowExtractionConfidence,
  };
};

const deactivateSupersededResumeArtifacts = async ({
  supabase,
  profileId,
  currentSourceObjectId,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;
  profileId: string;
  currentSourceObjectId: string;
}) => {
  const { data: artifactRows } = (await supabase
    .from("artifacts")
    .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, is_active")
    .eq("profile_id", profileId)
    .eq("is_active", true)) as { data: ArtifactCleanupRow[] | null };

  const rows = artifactRows ?? [];
  const staleResumeRows = rows.filter((row) => {
    const provenance = toRecord(row.source_provenance);
    const source = toTrimmedString(provenance.source)?.toLowerCase() ?? "";
    if (source !== "resume") return false;
    const sourceObjectId = toTrimmedString(row.source_object_id);
    if (!sourceObjectId) return false;
    return sourceObjectId !== currentSourceObjectId;
  });

  if (staleResumeRows.length === 0) return;

  const deactivatedAt = new Date().toISOString();
  for (const row of staleResumeRows) {
    const artifactId = toTrimmedString(row.artifact_id);
    const artifactType = toTrimmedString(row.artifact_type);
    if (!artifactId || !artifactType) continue;

    await supabase.from("artifact_versions").insert({
      artifact_id: artifactId,
      profile_id: profileId,
      operation: "deactivate",
      artifact_type: artifactType,
      artifact_data: toRecord(row.artifact_data),
      file_refs: Array.isArray(row.file_refs) ? row.file_refs : [],
      verification_status: toTrimmedString(toRecord(row.artifact_data).verification_status) ?? "unverified",
      source_provenance: toRecord(row.source_provenance),
      source_object_id: toTrimmedString(row.source_object_id),
      ingestion_run_id: `resume_supersede_${deactivatedAt}`,
    });

    await supabase
      .from("artifacts")
      .update({
        is_active: false,
        deactivated_at: deactivatedAt,
        active_version_id: null,
      })
      .eq("artifact_id", artifactId)
      .eq("profile_id", profileId);
  }
};

export async function POST(req: Request) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: "/api/student/extract/resume",
    component: "student_artifacts",
    operation: "resume_extract"
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    outcome,
    errorCode,
    details
  }: {
    response: Response;
    outcome: "success" | "failure" | "timeout" | "retry" | "dropped";
    errorCode?: string;
    details?: Record<string, unknown>;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    logApiRequestResult({
      context: obs,
      statusCode: response.status,
      eventName: `stu.extract.resume.run.${outcome}`,
      outcome,
      errorCode,
      provider: "openai",
      persona: "student",
      details
    });
    return response;
  };

  const context = await getAuthContext();
  if (!hasPersona(context, ["student"], { requireOnboarding: false })) {
    return finalize({
      response: forbidden(),
      outcome: "failure",
      errorCode: "forbidden"
    });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return finalize({
      response: badRequest("supabase_unavailable"),
      outcome: "failure",
      errorCode: "supabase_unavailable"
    });
  }
  const extractionSupabase = supabase as unknown as SupabaseClientLike;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return finalize({
      response: badRequest("invalid_form_data"),
      outcome: "failure",
      errorCode: "invalid_form_data"
    });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return finalize({
      response: badRequest("file_required"),
      outcome: "failure",
      errorCode: "file_required"
    });
  }
  const flow = toTrimmedString(formData.get("flow"));
  const isOnboardingFlow = flow === "onboarding";

  if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
    return finalize({
      response: badRequest("unsupported_file_type"),
      outcome: "failure",
      errorCode: "unsupported_file_type"
    });
  }

  const { data: studentRows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1);

  const studentData = toRecord((studentRows as Array<{ student_data: unknown }> | null)?.[0]?.student_data);
  const claimReview = toRecord(studentData.claim_review);
  if (claimReview.status === "flagged_mismatch") {
    return finalize({
      response: badRequest("claim_under_review"),
      outcome: "failure",
      errorCode: "claim_under_review"
    });
  }
  const sourceExtractionLog = toRecord(studentData.source_extraction_log);
  const existingSourceEntry = toRecord(sourceExtractionLog.resume);
  const previousFileRef = parseStorageFileRef(existingSourceEntry.storage_file_ref);

  const fileExt = file.name.split('.').pop();
  const filePath = `${context.user_id}/artifacts/${Date.now()}-resume.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(ARTIFACT_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    return finalize({
      response: badRequest("failed_to_upload_document"),
      outcome: "failure",
      errorCode: "failed_to_upload_document",
      details: { provider: "supabase_storage" }
    });
  }

  if (previousFileRef && previousFileRef.path !== filePath) {
    const expectedPrefix = `${context.user_id}/`;
    if (previousFileRef.path.startsWith(expectedPrefix)) {
      const { error: removeError } = await supabase.storage.from(previousFileRef.bucket).remove([previousFileRef.path]);
      if (removeError) {
        console.error("Previous resume source file cleanup failed:", removeError);
      }
    }
  }

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "resume",
      extractedFromFilename: file.name,
      artifactCount: 0,
      status: "extracting",
      storageFileRef: {
        bucket: ARTIFACT_BUCKET,
        path: filePath,
        kind: "resume"
      }
    });
  } catch (metadataError) {
    console.error("Resume extraction start metadata update failed:", metadataError);
  }

  try {
    const extractedArtifacts = await extractArtifactsFromDocument({
      sourceKind: "resume",
      file
    });
    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractedArtifacts,
      fileRef: {
        kind: "resume",
        bucket: ARTIFACT_BUCKET,
        path: filePath
      }
    });

    if (extractedArtifacts.length > 0) {
      const currentSourceObjectId = `${ARTIFACT_BUCKET}:${filePath}`;
      await deactivateSupersededResumeArtifacts({
        supabase,
        profileId: context.user_id,
        currentSourceObjectId,
      });
    }

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "resume",
      extractedFromFilename: file.name,
      artifactCount: persistedArtifacts.length,
      status: "succeeded",
      storageFileRef: {
        bucket: ARTIFACT_BUCKET,
        path: filePath,
        kind: "resume"
      }
    });

    const resumeEmails = collectResumeEmailsFromArtifacts(
      persistedArtifacts.map((artifact) => ({
        artifact_data: toRecord(artifact.artifact_data),
      }))
    );
    const preferredResumeEmail = resumeEmails[0] ?? null;
    const lowExtractionConfidence = persistedArtifacts.length === 0;
    const signals = await persistResumeSignals({
      supabase,
      profileId: context.user_id,
      authEmail: toTrimmedString(context.session_user?.email),
      resumeEmail: preferredResumeEmail,
      lowExtractionConfidence,
      fileName: file.name,
    });

    return finalize({
      response: ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts,
        signals: {
          resume_email_mismatch: signals.mismatch,
          low_extraction_confidence: signals.lowExtractionConfidence,
        },
      },
      session_source: context.session_source ?? "none"
      }),
      outcome: "success",
      details: { artifact_count: persistedArtifacts.length }
    });
  } catch (extractError) {
    console.error("Resume extraction failed:", extractError);
    const errorMessage = extractError instanceof Error ? extractError.message : "resume_extraction_failed";
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "resume",
        extractedFromFilename: file.name,
        artifactCount: 0,
        status: "failed",
        errorMessage,
        storageFileRef: {
          bucket: ARTIFACT_BUCKET,
          path: filePath,
          kind: "resume"
        }
      });
    } catch (metadataError) {
      console.error("Resume source-document metadata update failed:", metadataError);
    }
    const signals = await persistResumeSignals({
      supabase,
      profileId: context.user_id,
      authEmail: toTrimmedString(context.session_user?.email),
      resumeEmail: null,
      lowExtractionConfidence: true,
      fileName: file.name,
    }).catch(() => ({
      mismatch: null,
      lowExtractionConfidence: true,
    }));

    if (isOnboardingFlow) {
      return finalize({
        response: ok({
        resource: "artifacts_extraction",
        status: "accepted_with_extraction_failed",
        data: {
          artifacts: [],
          signals: {
            resume_email_mismatch: signals.mismatch,
            low_extraction_confidence: true,
          },
        },
        session_source: context.session_source ?? "none",
        }),
        outcome: "dropped",
        errorCode: "document_extraction_failed",
        details: { accepted_with_extraction_failed: true }
      });
    }
    return finalize({
      response: badRequest("document_extraction_failed"),
      outcome: "failure",
      errorCode: "document_extraction_failed"
    });
  }
}
