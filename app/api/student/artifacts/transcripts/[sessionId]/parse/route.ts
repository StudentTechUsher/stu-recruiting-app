import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { consumeAIFeatureQuota } from "@/lib/ai/feature-quota";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromPdfBuffer } from "@/lib/transcript/pdf-text";
import { parseTranscriptTextWithOpenAI } from "@/lib/transcript/openai-parser";

type SessionRow = {
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

type ArtifactRow = {
  artifact_id: string;
  profile_id: string;
  artifact_data: unknown;
  file_refs: unknown;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toFileRef = (value: unknown): { bucket: string; path: string; kind?: string } | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const bucket = typeof row.bucket === "string" ? row.bucket : null;
  const path = typeof row.path === "string" ? row.path : null;
  const kind = typeof row.kind === "string" ? row.kind : undefined;
  if (!bucket || !path) return null;
  return { bucket, path, kind };
};

const normalizeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name
    };
  }
  return {
    message: "unknown_error"
  };
};

export async function POST(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthContext();
  if (!hasPersona(auth, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const { sessionId } = await context.params;

  const { data: session } = await supabase
    .from("transcript_parse_sessions")
    .select("session_id, profile_id, transcript_artifact_id, status, parser_model, parse_summary, parse_error, created_at, updated_at")
    .eq("session_id", sessionId)
    .single<SessionRow>();

  if (!session || session.profile_id !== auth.user_id) return forbidden();
  if (session.status === "processing") return badRequest("transcript_parse_already_processing");

  const quota = await consumeAIFeatureQuota({
    userId: auth.user_id,
    featureKey: "transcript_parse",
    supabase
  });
  if (!quota.allowed) {
    return Response.json(
      {
        ok: false,
        error: "ai_feature_quota_exceeded",
        feature: "transcript_parse",
        remaining: quota.remaining,
        max_uses: quota.maxUses
      },
      { status: 429 }
    );
  }

  await supabase
    .from("transcript_parse_sessions")
    .update({
      status: "processing",
      parse_error: null
    })
    .eq("session_id", session.session_id)
    .eq("profile_id", auth.user_id);

  try {
    const { data: artifact } = await supabase
      .from("artifacts")
      .select("artifact_id, profile_id, artifact_data, file_refs")
      .eq("artifact_id", session.transcript_artifact_id)
      .single<ArtifactRow>();

    if (!artifact || artifact.profile_id !== auth.user_id) {
      throw new Error("transcript_artifact_not_found");
    }

    const fileRefs = Array.isArray(artifact.file_refs) ? artifact.file_refs.map(toFileRef).filter(Boolean) : [];
    const transcriptFileRef = fileRefs.find((fileRef) => fileRef?.kind === "transcript") ?? fileRefs[0];
    if (!transcriptFileRef) throw new Error("transcript_file_ref_missing");

    const { data: transcriptBlob, error: downloadError } = await supabase.storage
      .from(transcriptFileRef.bucket)
      .download(transcriptFileRef.path);

    if (downloadError || !transcriptBlob) throw new Error("transcript_download_failed");

    const transcriptBuffer = Buffer.from(await transcriptBlob.arrayBuffer());
    const transcriptText = extractTextFromPdfBuffer(transcriptBuffer);
    const parseResult = await parseTranscriptTextWithOpenAI({
      transcriptText,
      model: session.parser_model
    });

    await supabase.from("transcript_parsed_courses").delete().eq("session_id", session.session_id);

    if (parseResult.courses.length > 0) {
      await supabase.from("transcript_parsed_courses").insert(
        parseResult.courses.map((course, index) => ({
          session_id: session.session_id,
          ordinal: index + 1,
          course_code: course.course_code,
          course_title: course.course_title,
          term: course.term,
          credits: course.credits,
          grade: course.grade,
          course_meta: course.course_meta
        }))
      );
    }

    const existingArtifactData = toRecord(artifact.artifact_data);
    const parseSummary = {
      ...parseResult.summary,
      course_count: parseResult.courses.length,
      parsed_at: new Date().toISOString()
    };
    const nextArtifactData = {
      ...existingArtifactData,
      status: "parsed",
      parsed_snapshot: {
        model: session.parser_model,
        summary: parseSummary,
        courses: parseResult.courses
      }
    };

    const { data: versionRows, error: versionError } = await supabase
      .from("artifact_versions")
      .insert({
        artifact_id: session.transcript_artifact_id,
        profile_id: auth.user_id,
        operation: "replace",
        artifact_type: "transcript",
        artifact_data: nextArtifactData,
        file_refs: Array.isArray(artifact.file_refs) ? artifact.file_refs : [],
        verification_status: "unverified",
        source_provenance: {
          source: "transcript_parse",
          transcript_session_id: session.session_id
        },
        source_object_id: `transcript:${session.session_id}`,
        ingestion_run_id: new Date().toISOString()
      })
      .select("version_id");
    const versionId =
      Array.isArray(versionRows) && versionRows.length > 0 && typeof (versionRows[0] as Record<string, unknown>).version_id === "string"
        ? ((versionRows[0] as Record<string, unknown>).version_id as string)
        : null;
    if (!versionId || versionError) {
      throw new Error("transcript_version_persist_failed");
    }

    await supabase
      .from("artifacts")
      .update({
        artifact_data: nextArtifactData,
        active_version_id: versionId,
        is_active: true,
        deactivated_at: null
      })
      .eq("artifact_id", session.transcript_artifact_id)
      .eq("profile_id", auth.user_id);

    await supabase
      .from("transcript_parse_sessions")
      .update({
        status: "parsed",
        parse_error: null,
        parse_summary: parseSummary
      })
      .eq("session_id", session.session_id)
      .eq("profile_id", auth.user_id);

    return ok({
      resource: "transcript_parse",
      session_id: session.session_id,
      status: "parsed",
      parse_summary: parseSummary
    });
  } catch (error) {
    const parseError = normalizeError(error);
    await supabase
      .from("transcript_parse_sessions")
      .update({
        status: "failed",
        parse_error: parseError
      })
      .eq("session_id", session.session_id)
      .eq("profile_id", auth.user_id);

    return badRequest("transcript_parse_failed");
  }
}
