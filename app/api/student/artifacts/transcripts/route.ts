import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const TRANSCRIPT_BUCKET = "student-artifacts-private";
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const toSafeFileName = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const getMaxUploadBytes = (): number => {
  const raw = process.env.TRANSCRIPT_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const form = await req.formData().catch(() => null);
  const uploaded = form?.get("transcript");
  if (!(uploaded instanceof File)) return badRequest("transcript_file_required");

  const fileName = uploaded.name || "transcript.pdf";
  const normalizedName = fileName.toLowerCase();
  const isPdf = uploaded.type === "application/pdf" || normalizedName.endsWith(".pdf");
  if (!isPdf) return badRequest("transcript_pdf_only");

  const maxUploadBytes = getMaxUploadBytes();
  if (uploaded.size <= 0 || uploaded.size > maxUploadBytes) {
    return badRequest("transcript_file_size_invalid");
  }

  const now = new Date().toISOString();
  const safeName = toSafeFileName(fileName) || "transcript.pdf";
  const filePath = `${context.user_id}/transcripts/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(TRANSCRIPT_BUCKET).upload(filePath, uploaded, {
    contentType: "application/pdf",
    upsert: false
  });

  if (uploadError) return badRequest("transcript_upload_failed");

  const transcriptFileRef = {
    kind: "transcript",
    bucket: TRANSCRIPT_BUCKET,
    path: filePath,
    file_name: fileName,
    content_type: "application/pdf",
    size_bytes: uploaded.size,
    uploaded_at: now
  };

  const { data: artifactRow, error: artifactError } = await supabase
    .from("artifacts")
    .insert({
      profile_id: context.user_id,
      artifact_type: "transcript",
      artifact_data: {
        title: `Transcript: ${fileName}`,
        source: "Transcript upload",
        description: "Transcript uploaded for coursework parsing.",
        status: "uploaded"
      },
      file_refs: [transcriptFileRef]
    })
    .select("artifact_id")
    .single<{ artifact_id: string }>();

  if (artifactError || !artifactRow) return badRequest("transcript_artifact_create_failed");

  const parserModel = process.env.OPENAI_TRANSCRIPT_PARSE_MODEL || "gpt-5-mini";
  const { data: sessionRow, error: sessionError } = await supabase
    .from("transcript_parse_sessions")
    .insert({
      profile_id: context.user_id,
      transcript_artifact_id: artifactRow.artifact_id,
      status: "uploaded",
      parser_model: parserModel,
      parse_summary: {
        course_count: 0
      }
    })
    .select("session_id, status, parser_model, parse_summary, parse_error, transcript_artifact_id, created_at, updated_at")
    .single<{
      session_id: string;
      status: string;
      parser_model: string;
      parse_summary: Record<string, unknown>;
      parse_error: Record<string, unknown> | null;
      transcript_artifact_id: string;
      created_at: string;
      updated_at: string;
    }>();

  if (sessionError || !sessionRow) return badRequest("transcript_session_create_failed");

  return ok({
    resource: "transcript_upload",
    profile_id: context.user_id,
    session: sessionRow,
    transcript_file_ref: transcriptFileRef
  });
}
