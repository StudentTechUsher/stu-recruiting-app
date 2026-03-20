import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { ATSProviderResolutionError } from "@/lib/ats/provider-config";
import {
  getRecruiterCandidateDiscovery,
  recordRecruiterCandidateAction,
} from "@/lib/recruiter/candidate-discovery";

const actionPayloadSchema = z.object({
  candidate_key: z.string().min(3),
  action_name: z.string().min(2),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { searchParams } = new URL(request.url);

  try {
    const discovery = await getRecruiterCandidateDiscovery(context.org_id, context.user_id, {
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("page_size") ?? 25),
      university: searchParams.get("university") ?? undefined,
      targetRole: searchParams.get("target_role") ?? undefined,
      recommendationState:
        (searchParams.get("recommendation_state") as
          | "recommended"
          | "hold"
          | "manual_review"
          | null) ?? undefined,
      matchStatus:
        (searchParams.get("match_status") as
          | "MATCHED_STUDENT"
          | "NO_STUDENT_MATCH"
          | null) ?? undefined,
    });

    return ok({
      provider: discovery.provider,
      summary: discovery.summary,
      candidates: discovery.candidates,
      total: discovery.total,
      page: discovery.page,
      page_size: discovery.page_size,
      has_more: discovery.has_more,
      timeline_preview_by_candidate_key: discovery.timeline_preview_by_candidate_key,
    });
  } catch (error) {
    if (error instanceof ATSProviderResolutionError) {
      const message =
        error.code === "provider_conflict"
          ? "Multiple ATS providers are enabled for this org"
          : "No ATS provider configured";
      return badRequest(message);
    }

    throw error;
  }
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = actionPayloadSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_candidate_action_payload");

  const result = await recordRecruiterCandidateAction({
    orgId: context.org_id,
    userId: context.user_id,
    candidateKey: parsed.data.candidate_key,
    actionName: parsed.data.action_name,
    details: parsed.data.details,
  });

  return ok({
    resource: "candidate_action",
    status: result.recorded ? "recorded" : "not_recorded",
    payload: parsed.data,
  });
}
