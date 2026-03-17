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

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const profileUrl = payload.profile_url;
  if (!profileUrl || typeof profileUrl !== "string") return badRequest("profile_url_required");

  const urlNormalized = profileUrl.trim();

  // Invoke the Supabase Edge Function to process the LinkedIn or generic profile
  const { data, error } = await supabase.functions.invoke("extract-profile", {
    body: {
      profile_id: context.user_id,
      profile_url: urlNormalized
    }
  });

  if (error) {
    console.error("Profile extraction edge function failed:", error);
    return badRequest("profile_extraction_failed");
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
      linkedin: {
        last_extracted_at: new Date().toISOString(),
        extracted_from: urlNormalized,
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
