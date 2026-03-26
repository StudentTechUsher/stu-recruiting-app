import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildCourseworkArtifactData, type TranscriptCourse } from "@/lib/transcript/intake";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart
} from "@/lib/observability/api";

type SessionRow = {
  session_id: string;
  profile_id: string;
  transcript_artifact_id: string;
  status: "uploaded" | "processing" | "parsed" | "failed";
};

type ParsedCourseRow = {
  parsed_course_id: string;
  session_id: string;
  course_code: string | null;
  course_title: string;
  term: string | null;
  credits: number | null;
  grade: string | null;
  course_meta: Record<string, unknown>;
};

type MaterializeSelection = {
  parsed_course_id: string;
  impact_description: string;
  syllabus_file_refs?: unknown[];
};

type ArtifactRow = {
  artifact_id: string;
  artifact_data: unknown;
  file_refs?: unknown;
  source_provenance?: unknown;
  source_object_id?: string | null;
  ingestion_run_id?: string | null;
};

const toSelectionArray = (value: unknown): MaterializeSelection[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "object" && entry !== null && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      parsed_course_id: typeof entry.parsed_course_id === "string" ? entry.parsed_course_id : "",
      impact_description: typeof entry.impact_description === "string" ? entry.impact_description : "",
      syllabus_file_refs: Array.isArray(entry.syllabus_file_refs) ? entry.syllabus_file_refs : []
    }))
    .filter((entry) => entry.parsed_course_id.trim().length > 0);
};

const normalizeSyllabusRefs = (value: unknown[]): Record<string, unknown>[] =>
  value
    .filter((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry))
    .map((entry) => entry as Record<string, unknown>);

export async function POST(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: "/api/student/artifacts/transcripts/[sessionId]/materialize",
    component: "transcript",
    operation: "transcript_materialize"
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
      eventName: `stu.transcript.materialize.run.${outcome}`,
      outcome,
      errorCode,
      details
    });
    return response;
  };

  const auth = await getAuthContext();
  if (!hasPersona(auth, ["student"])) {
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

  const { sessionId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const selections = toSelectionArray((body as Record<string, unknown>).selections);
  if (selections.length === 0) {
    return finalize({
      response: badRequest("materialize_selections_required"),
      outcome: "failure",
      errorCode: "materialize_selections_required"
    });
  }

  const { data: session } = await supabase
    .from("transcript_parse_sessions")
    .select("session_id, profile_id, transcript_artifact_id, status")
    .eq("session_id", sessionId)
    .single<SessionRow>();

  if (!session || session.profile_id !== auth.user_id) {
    return finalize({
      response: forbidden(),
      outcome: "failure",
      errorCode: "forbidden"
    });
  }
  if (session.status !== "parsed") {
    return finalize({
      response: badRequest("transcript_session_not_parsed"),
      outcome: "failure",
      errorCode: "transcript_session_not_parsed"
    });
  }

  const parsedCourseIds = Array.from(new Set(selections.map((selection) => selection.parsed_course_id)));
  const { data: parsedRows } = await supabase
    .from("transcript_parsed_courses")
    .select("parsed_course_id, session_id, course_code, course_title, term, credits, grade, course_meta")
    .eq("session_id", session.session_id)
    .in("parsed_course_id", parsedCourseIds);

  const parsedCourses = (parsedRows ?? []) as ParsedCourseRow[];
  if (parsedCourses.length === 0) {
    return finalize({
      response: badRequest("transcript_courses_not_found"),
      outcome: "failure",
      errorCode: "transcript_courses_not_found"
    });
  }

  const parsedById = new Map(parsedCourses.map((course) => [course.parsed_course_id, course]));
  const selectionsById = new Map(selections.map((selection) => [selection.parsed_course_id, selection]));

  const selectedParsedIds = parsedCourseIds.filter((id) => parsedById.has(id) && selectionsById.has(id));
  if (selectedParsedIds.length === 0) {
    return finalize({
      response: badRequest("materialize_selections_invalid"),
      outcome: "failure",
      errorCode: "materialize_selections_invalid"
    });
  }

  const { data: existingArtifacts } = await supabase
    .from("artifacts")
    .select("artifact_id, artifact_data")
    .eq("profile_id", auth.user_id)
    .eq("artifact_type", "coursework");

  const existingParsedIds = new Set(
    ((existingArtifacts ?? []) as ArtifactRow[])
      .map((artifact) =>
        typeof artifact.artifact_data === "object" &&
        artifact.artifact_data !== null &&
        !Array.isArray(artifact.artifact_data)
          ? ((artifact.artifact_data as Record<string, unknown>).parsed_course_id as string | undefined)
          : undefined
      )
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  );

  const rowsToInsert = selectedParsedIds
    .filter((parsedCourseId) => !existingParsedIds.has(parsedCourseId))
    .map((parsedCourseId) => {
      const courseRow = parsedById.get(parsedCourseId)!;
      const selection = selectionsById.get(parsedCourseId)!;
      const impactDescription = selection.impact_description.trim();
      if (impactDescription.length === 0) return null;

      const course: TranscriptCourse = {
        course_code: courseRow.course_code,
        course_title: courseRow.course_title,
        term: courseRow.term,
        credits: courseRow.credits,
        grade: courseRow.grade,
        course_meta: courseRow.course_meta ?? {}
      };

      const sourceObjectId = `transcript:${session.session_id}:${parsedCourseId}`;
      return {
        profile_id: auth.user_id,
        artifact_type: "coursework",
        artifact_data: buildCourseworkArtifactData({
          course,
          impactDescription,
          transcriptSessionId: session.session_id,
          parsedCourseId,
          transcriptArtifactId: session.transcript_artifact_id
        }),
        file_refs: normalizeSyllabusRefs(selection.syllabus_file_refs ?? []),
        source_provenance: {
          source: "transcript_parse",
          transcript_session_id: session.session_id,
          parsed_course_id: parsedCourseId,
          transcript_artifact_id: session.transcript_artifact_id
        },
        source_object_id: sourceObjectId,
        ingestion_run_id: new Date().toISOString(),
        // Publish only after version + pointer writes succeed.
        is_active: false
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rowsToInsert.length === 0) {
    return finalize({
      response: ok({
      resource: "transcript_materialize",
      created_count: 0,
      skipped_count: selectedParsedIds.length
      }),
      outcome: "success",
      details: { created_count: 0, skipped_count: selectedParsedIds.length }
    });
  }

  const { data: insertedRows } = await supabase
    .from("artifacts")
    .insert(rowsToInsert)
    .select("artifact_id, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id");

  const insertedArtifacts = (insertedRows ?? []) as ArtifactRow[];
  for (const row of insertedArtifacts) {
    const sourceProvenance =
      typeof row.source_provenance === "object" && row.source_provenance !== null && !Array.isArray(row.source_provenance)
        ? (row.source_provenance as Record<string, unknown>)
        : {};
    const artifactData =
      typeof row.artifact_data === "object" && row.artifact_data !== null && !Array.isArray(row.artifact_data)
        ? (row.artifact_data as Record<string, unknown>)
        : {};
    const verificationStatus = typeof artifactData.verification_status === "string" ? artifactData.verification_status : "verified";

    const { data: versionRows, error: versionError } = await supabase
      .from("artifact_versions")
      .insert({
        artifact_id: row.artifact_id,
        profile_id: auth.user_id,
        operation: "reextract",
        artifact_type: "coursework",
        artifact_data: artifactData,
        file_refs: Array.isArray(row.file_refs) ? row.file_refs : [],
        verification_status: verificationStatus,
        source_provenance: sourceProvenance,
        source_object_id: typeof row.source_object_id === "string" ? row.source_object_id : null,
        ingestion_run_id: typeof row.ingestion_run_id === "string" ? row.ingestion_run_id : null
      })
      .select("version_id");

    const versionId =
      Array.isArray(versionRows) && versionRows.length > 0 && typeof (versionRows[0] as Record<string, unknown>).version_id === "string"
        ? ((versionRows[0] as Record<string, unknown>).version_id as string)
        : null;
    if (!versionId || versionError) {
      await supabase
        .from("artifacts")
        .delete()
        .eq("artifact_id", row.artifact_id)
        .eq("profile_id", auth.user_id);
      continue;
    }

    await supabase
      .from("artifacts")
      .update({ active_version_id: versionId, is_active: true, deactivated_at: null })
      .eq("artifact_id", row.artifact_id)
      .eq("profile_id", auth.user_id);
  }

  return finalize({
    response: ok({
    resource: "transcript_materialize",
    created_count: insertedArtifacts.length,
    skipped_count: selectedParsedIds.length - rowsToInsert.length,
    artifact_ids: insertedArtifacts.map((row) => row.artifact_id)
    }),
    outcome: "success",
    details: {
      created_count: insertedArtifacts.length,
      skipped_count: selectedParsedIds.length - rowsToInsert.length
    }
  });
}
