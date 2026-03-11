import { forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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

type ParsedCourseRow = {
  parsed_course_id: string;
  session_id: string;
  ordinal: number;
  course_code: string | null;
  course_title: string;
  term: string | null;
  credits: number | null;
  grade: string | null;
  course_meta: Record<string, unknown>;
};

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthContext();
  if (!hasPersona(auth, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return ok({ resource: "transcript_courses", courses: [] });

  const { sessionId } = await context.params;
  const { data: session } = await supabase
    .from("transcript_parse_sessions")
    .select("session_id, profile_id, transcript_artifact_id, status, parser_model, parse_summary, parse_error, created_at, updated_at")
    .eq("session_id", sessionId)
    .single<SessionRow>();

  if (!session || session.profile_id !== auth.user_id) return forbidden();

  const { data: parsedCourses } = await supabase
    .from("transcript_parsed_courses")
    .select("parsed_course_id, session_id, ordinal, course_code, course_title, term, credits, grade, course_meta")
    .eq("session_id", session.session_id)
    .order("ordinal", { ascending: true });

  return ok({
    resource: "transcript_courses",
    session,
    courses: (parsedCourses ?? []) as ParsedCourseRow[]
  });
}
