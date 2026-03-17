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

type StorageFileRef = {
  bucket: string;
  path: string;
};

const ARTIFACT_BUCKET = "student-artifacts-private";

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

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");
  const extractionSupabase = supabase as unknown as SupabaseClientLike;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("invalid_form_data");
  }

  const file = formData.get("file") as File | null;
  if (!file) return badRequest("file_required");

  if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
    return badRequest("unsupported_file_type");
  }

  const { data: studentRows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1);

  const studentData = toRecord((studentRows as Array<{ student_data: unknown }> | null)?.[0]?.student_data);
  const sourceExtractionLog = toRecord(studentData.source_extraction_log);
  const existingSourceEntry = toRecord(sourceExtractionLog.transcript);
  const previousFileRef = parseStorageFileRef(existingSourceEntry.storage_file_ref);

  const fileExt = file.name.split('.').pop();
  const filePath = `${context.user_id}/artifacts/${Date.now()}-transcript.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(ARTIFACT_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    return badRequest("failed_to_upload_document");
  }

  if (previousFileRef && previousFileRef.path !== filePath) {
    const expectedPrefix = `${context.user_id}/`;
    if (previousFileRef.path.startsWith(expectedPrefix)) {
      const { error: removeError } = await supabase.storage.from(previousFileRef.bucket).remove([previousFileRef.path]);
      if (removeError) {
        console.error("Previous transcript source file cleanup failed:", removeError);
      }
    }
  }

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "transcript",
      extractedFromFilename: file.name,
      artifactCount: 0,
      status: "extracting",
      storageFileRef: {
        bucket: ARTIFACT_BUCKET,
        path: filePath,
        kind: "transcript"
      }
    });
  } catch (metadataError) {
    console.error("Transcript extraction start metadata update failed:", metadataError);
  }

  try {
    const extractedArtifacts = await extractArtifactsFromDocument({
      sourceKind: "transcript",
      file
    });
    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractedArtifacts,
      fileRef: {
        kind: "transcript",
        bucket: ARTIFACT_BUCKET,
        path: filePath
      }
    });

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "transcript",
      extractedFromFilename: file.name,
      artifactCount: persistedArtifacts.length,
      status: "succeeded",
      storageFileRef: {
        bucket: ARTIFACT_BUCKET,
        path: filePath,
        kind: "transcript"
      }
    });

    return ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts
      },
      session_source: context.session_source ?? "none"
    });
  } catch (extractError) {
    console.error("Transcript extraction failed:", extractError);
    const errorMessage = extractError instanceof Error ? extractError.message : "transcript_extraction_failed";
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "transcript",
        extractedFromFilename: file.name,
        artifactCount: 0,
        status: "failed",
        errorMessage,
        storageFileRef: {
          bucket: ARTIFACT_BUCKET,
          path: filePath,
          kind: "transcript"
        }
      });
    } catch (metadataError) {
      console.error("Transcript source-document metadata update failed:", metadataError);
    }
    return badRequest("document_extraction_failed");
  }
}
