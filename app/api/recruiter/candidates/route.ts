import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  attachRequestIdHeader,
  createApiObsContext,
  recordProductMetric,
  toActorSurrogate,
  type ObsOutcome
} from "@/lib/observability/api";
import { listRecruiterReviewCandidates } from "@/lib/recruiter/review-candidates";

const actionPayloadSchema = z.object({
  candidate_key: z.string().min(3),
  action_name: z.string().min(2),
});
const OBS_ROUTE = "/api/recruiter/candidates";
const isDemoFailureEnabled = () =>
  process.env.ENABLE_OBSERVABILITY_DEMO_FAILURE === "true" && process.env.NODE_ENV !== "production";

export async function GET(request: Request) {
  const obs = createApiObsContext({
    request,
    routeTemplate: OBS_ROUTE,
    component: "recruiter_candidates",
    operation: "search"
  });
  obs.recordStart({
    eventName: "recruiter.candidate_search.start",
    persona: "recruiter"
  });

  const finalize = ({
    response,
    outcome,
    errorCode,
    persona,
    orgId,
    actorIdSurrogate,
    details,
    sentryEventId
  }: {
    response: Response;
    outcome: ObsOutcome;
    errorCode?: string;
    persona?: string;
    orgId?: string;
    actorIdSurrogate?: string;
    details?: Record<string, unknown>;
    sentryEventId?: string;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    obs.recordResult({
      statusCode: response.status,
      eventName: "recruiter.candidate_search.result",
      outcome,
      errorCode,
      persona,
      orgId,
      actorIdSurrogate,
      sentryEventId,
      details
    });
    return response;
  };

  try {
    const context = await getAuthContext();
    const persona = context.persona;
    const orgId = context.org_id?.trim() ? context.org_id : undefined;
    const actorIdSurrogate = toActorSurrogate(context.user_id);
    if (!hasPersona(context, ["recruiter", "org_admin"])) {
      const response = forbidden();
      recordProductMetric(obs, "recruiter.candidate_search_performed.failed", {
        outcome: "handled_failure",
        statusCode: response.status,
        persona,
        orgId,
        actorIdSurrogate,
        errorCode: "forbidden"
      });
      return finalize({
        response,
        outcome: "handled_failure",
        errorCode: "forbidden",
        persona,
        orgId,
        actorIdSurrogate
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("page_size") ?? 25);
    const jobRole = searchParams.get("job_role") ?? undefined;
    const queryPresent = Boolean(jobRole && jobRole.trim().length > 0);
    const filtersCount = queryPresent ? 1 : 0;

    if (isDemoFailureEnabled() && searchParams.get("demo_fail") === "1") {
      throw new Error("observability_demo_failure");
    }

    const result = await listRecruiterReviewCandidates({
      orgId: context.org_id,
      page,
      pageSize,
      jobRole,
    });

    const response = ok({
      resource: "review_candidates",
      provider: result.provider,
      candidates: result.candidates,
      total: result.total,
      page: result.page,
      page_size: result.page_size,
      has_more: result.has_more,
      job_roles: result.job_roles,
    });

    const details = {
      query_present: queryPresent,
      filters_count: filtersCount,
      result_count: result.candidates.length,
      search_params_shape: {
        has_page: searchParams.has("page"),
        has_page_size: searchParams.has("page_size"),
        has_job_role: searchParams.has("job_role")
      }
    };

    recordProductMetric(obs, "recruiter.candidate_search_performed", {
      outcome: "success",
      statusCode: response.status,
      persona,
      orgId,
      actorIdSurrogate,
      details
    });
    return finalize({
      response,
      outcome: "success",
      persona,
      orgId,
      actorIdSurrogate,
      details
    });
  } catch (error) {
    const sentryEventId = obs.recordUnexpected({
      eventName: "recruiter.candidate_search.unexpected",
      error,
      persona: "recruiter",
      errorCode: "unexpected_exception"
    });
    const response = Response.json({ ok: false, error: "unexpected_exception" }, { status: 500 });
    recordProductMetric(obs, "recruiter.candidate_search_performed.failed", {
      outcome: "unexpected_failure",
      statusCode: response.status,
      persona: "recruiter",
      errorCode: "unexpected_exception",
      sentryEventId
    });
    return finalize({
      response,
      outcome: "unexpected_failure",
      errorCode: "unexpected_exception",
      persona: "recruiter",
      sentryEventId
    });
  }
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = actionPayloadSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_candidate_action_payload");

  return ok({
    resource: "candidate_action",
    status: "disabled_in_phase1",
    payload: parsed.data,
  });
}
