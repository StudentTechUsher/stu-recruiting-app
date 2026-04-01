import { sendCapabilityProfileRequestAlert } from "@/lib/capabilities/capability-profile-request-alerts";
import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { normalizeCapabilityProfileRequestKey, toTrimmedString } from "@/lib/student/capability-targeting";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentRow = { student_data: unknown };

const duplicateWindowMs = 24 * 60 * 60 * 1000;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const normalizeLabel = (value: string): string => value.trim().replace(/\s+/g, " ");

const asDateMs = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"], { requireOnboarding: false })) return forbidden();

  const payload = await req.json().catch(() => null);
  const payloadRecord = toRecord(payload);

  const companyId = toTrimmedString(payloadRecord.company_id);
  const roleId = toTrimmedString(payloadRecord.role_id);
  const companyLabelRaw = toTrimmedString(payloadRecord.company_label);
  const roleLabelRaw = toTrimmedString(payloadRecord.role_label);
  const sourceModeRaw = toTrimmedString(payloadRecord.source_mode)?.toLowerCase();
  const sourceMode = sourceModeRaw === "employer_first" ? "employer_first" : "role_first";

  const companyLabel = companyLabelRaw ? normalizeLabel(companyLabelRaw) : null;
  const roleLabel = roleLabelRaw ? normalizeLabel(roleLabelRaw) : null;

  if ((!companyId && !companyLabel) || (!roleId && !roleLabel)) {
    return badRequest("company_and_role_required");
  }

  const requestKey = normalizeCapabilityProfileRequestKey({
    companyId,
    roleId,
    companyLabel,
    roleLabel,
  });
  if (!requestKey) return badRequest("invalid_request_key");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_not_configured");

  const { data: studentRows } = (await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1)) as { data: StudentRow[] | null };

  const studentData = toRecord(studentRows?.[0]?.student_data);
  const requestLog = Array.isArray(studentData.capability_profile_request_log)
    ? studentData.capability_profile_request_log
        .map((entry) => toRecord(entry))
        .filter((entry) => toTrimmedString(entry.request_key))
    : [];

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const duplicate = requestLog.find((entry) => {
    const existingKey = toTrimmedString(entry.request_key);
    if (!existingKey || existingKey !== requestKey) return false;
    return nowMs - asDateMs(entry.requested_at) < duplicateWindowMs;
  });

  if (duplicate) {
    return ok({
      status: "duplicate_recent_request",
      request_key: requestKey,
      requested_at: toTrimmedString(duplicate.requested_at),
    });
  }

  try {
    const sent = await sendCapabilityProfileRequestAlert({
      candidateProfileId: context.user_id,
      candidateEmail: toTrimmedString(context.session_user?.email) ?? toTrimmedString(context.profile?.personal_info?.email),
      companyId,
      companyLabel: companyLabel ?? "Unknown company",
      roleId,
      roleLabel: roleLabel ?? "Unknown role",
      requestKey,
      submittedAt: nowIso,
      sourceMode,
    });

    const nextRequestLog = [
      ...requestLog,
      {
        request_key: requestKey,
        requested_at: nowIso,
        company_id: companyId,
        company_label: companyLabel,
        role_id: roleId,
        role_label: roleLabel,
        source_mode: sourceMode,
        email_message_id: sent.messageId,
      },
    ].slice(-50);

    await supabase.from("students").upsert(
      {
        profile_id: context.user_id,
        student_data: {
          ...studentData,
          capability_profile_request_log: nextRequestLog,
        },
      },
      { onConflict: "profile_id" }
    );

    return ok({
      status: "sent",
      request_key: requestKey,
      requested_at: nowIso,
    });
  } catch (error) {
    console.error("capability_profile_request_send_failed", {
      profile_id: context.user_id,
      request_key: requestKey,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ ok: false, error: "capability_profile_request_send_failed" }, { status: 500 });
  }
}
