import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentRow = { student_data: unknown };
type ProfileRow = { personal_info: unknown; onboarding_completed_at: string | null };

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string").map((entry) => (entry as string).trim()).filter(Boolean);
};

const supportedActions = new Set(["dismiss_resume_email_mismatch", "flag_claim_mismatch"] as const);

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const payloadRecord = toRecord(payload);
  const action = toTrimmedString(payloadRecord.action);
  if (!action || !supportedActions.has(action as "dismiss_resume_email_mismatch" | "flag_claim_mismatch")) {
    return badRequest("unsupported_action");
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const [{ data: studentRows }, { data: profileRows }] = (await Promise.all([
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
    supabase.from("profiles").select("personal_info, onboarding_completed_at").eq("id", context.user_id).limit(1),
  ])) as [{ data: StudentRow[] | null }, { data: ProfileRow[] | null }];

  const now = new Date().toISOString();
  const existingStudentData = toRecord(studentRows?.[0]?.student_data);
  const existingProfileInfo = toRecord(profileRows?.[0]?.personal_info);
  const onboardingSignals = toRecord(existingStudentData.onboarding_signals);

  if (action === "dismiss_resume_email_mismatch") {
    const currentMismatch = toRecord(onboardingSignals.resume_email_mismatch);
    if (Object.keys(currentMismatch).length === 0) return ok({ resource: "student_onboarding_signals", status: "noop" });

    const nextStudentData: Record<string, unknown> = {
      ...existingStudentData,
      onboarding_signals: {
        ...onboardingSignals,
        resume_email_mismatch: {
          ...currentMismatch,
          status: "dismissed",
          dismissed_at: now,
        },
      },
    };

    const { error } = await supabase.from("students").upsert(
      {
        profile_id: context.user_id,
        student_data: nextStudentData,
      },
      { onConflict: "profile_id" }
    );
    if (error) return badRequest("student_signal_dismiss_failed");

    return ok({
      resource: "student_onboarding_signals",
      status: "saved",
      action,
      student_data: nextStudentData,
    });
  }

  const claimReview = toRecord(existingStudentData.claim_review);
  const reviewEvents = toStringArray(toRecord(claimReview.events).items);
  const nextClaimReview: Record<string, unknown> = {
    ...claimReview,
    status: "flagged_mismatch",
    flagged_at: now,
    reason: toTrimmedString(payloadRecord.reason) ?? "student_flagged_claim_mismatch",
    events: {
      items: [...reviewEvents, `flagged_mismatch:${now}`],
    },
  };

  const nextStudentData: Record<string, unknown> = {
    ...existingStudentData,
    claim_review: nextClaimReview,
  };
  const nextProfileInfo: Record<string, unknown> = {
    ...existingProfileInfo,
    claim_review_status: "flagged_mismatch",
    claim_review_flagged_at: now,
  };

  const [{ error: studentError }, { error: profileError }] = await Promise.all([
    supabase.from("students").upsert(
      {
        profile_id: context.user_id,
        student_data: nextStudentData,
      },
      { onConflict: "profile_id" }
    ),
    supabase
      .from("profiles")
      .update({
        personal_info: nextProfileInfo,
        onboarding_completed_at: null,
      })
      .eq("id", context.user_id),
  ]);

  if (studentError || profileError) return badRequest("claim_mismatch_flag_failed");

  return ok({
    resource: "student_onboarding_signals",
    status: "saved",
    action,
    claim_review: nextClaimReview,
  });
}
