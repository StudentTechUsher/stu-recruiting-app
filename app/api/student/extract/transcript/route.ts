import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

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

  const fileExt = file.name.split('.').pop();
  const filePath = `${context.user_id}/artifacts/${Date.now()}-transcript.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('student-artifacts-private')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    return badRequest("failed_to_upload_document");
  }

  const { data, error: extractError } = await supabase.functions.invoke("extract-document", {
    body: {
      profile_id: context.user_id,
      document_path: filePath,
      document_type: "transcript"
    }
  });

  if (extractError) {
    console.error("Transcript extraction failed:", extractError);
    return badRequest("document_extraction_failed");
  }

  // Write source_extraction_log back into student_data
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1);

  const existingStudentData = toRecord((studentRows as Array<{ student_data: unknown }> | null)?.[0]?.student_data);
  const existingLog = toRecord(existingStudentData.source_extraction_log);

  const updatedStudentData = {
    ...existingStudentData,
    source_extraction_log: {
      ...existingLog,
      transcript: {
        last_extracted_at: new Date().toISOString(),
        extracted_from_filename: file.name,
        artifact_count: Array.isArray((data as Record<string, unknown>)?.artifacts)
          ? ((data as Record<string, unknown>).artifacts as unknown[]).length
          : 0
      }
    }
  };

  await supabase
    .from("students")
    .upsert({ profile_id: context.user_id, student_data: updatedStudentData }, { onConflict: "profile_id" });

  return ok({
    resource: "artifacts_extraction",
    status: "success",
    data,
    session_source: context.session_source ?? "none"
  });
}
