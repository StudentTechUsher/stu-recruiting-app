import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const TRANSCRIPT_BUCKET = "student-artifacts-private";

const toSafeFileName = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

type SessionRow = {
  session_id: string;
  profile_id: string;
};

type ParsedCourseRow = {
  parsed_course_id: string;
};

export async function POST(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthContext();
  if (!hasPersona(auth, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const { sessionId } = await context.params;
  const { data: session } = await supabase
    .from("transcript_parse_sessions")
    .select("session_id, profile_id")
    .eq("session_id", sessionId)
    .single<SessionRow>();

  if (!session || session.profile_id !== auth.user_id) return forbidden();

  const form = await req.formData().catch(() => null);
  const parsedCourseId = typeof form?.get("parsed_course_id") === "string" ? (form?.get("parsed_course_id") as string) : "";
  const uploaded = form?.get("syllabus");

  if (!(uploaded instanceof File)) return badRequest("syllabus_file_required");
  if (parsedCourseId.trim().length === 0) return badRequest("parsed_course_id_required");

  const { data: parsedCourse } = await supabase
    .from("transcript_parsed_courses")
    .select("parsed_course_id")
    .eq("session_id", session.session_id)
    .eq("parsed_course_id", parsedCourseId)
    .single<ParsedCourseRow>();

  if (!parsedCourse) return badRequest("parsed_course_not_found");

  const safeName = toSafeFileName(uploaded.name || "syllabus-file");
  const filePath = `${auth.user_id}/syllabi/${session.session_id}/${parsedCourseId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(TRANSCRIPT_BUCKET).upload(filePath, uploaded, {
    upsert: false,
    contentType: uploaded.type || "application/octet-stream"
  });

  if (uploadError) return badRequest("syllabus_upload_failed");

  const fileRef = {
    kind: "syllabus",
    bucket: TRANSCRIPT_BUCKET,
    path: filePath,
    file_name: uploaded.name || safeName,
    content_type: uploaded.type || "application/octet-stream",
    size_bytes: uploaded.size,
    parsed_course_id: parsedCourseId,
    uploaded_at: new Date().toISOString()
  };

  return ok({
    resource: "transcript_syllabus_upload",
    parsed_course_id: parsedCourseId,
    file_ref: fileRef
  });
}
