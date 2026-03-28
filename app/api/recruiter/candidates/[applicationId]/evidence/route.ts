import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  attachRequestIdHeader,
  createApiObsContext,
  recordProductMetric,
  toActorSurrogate,
  type ObsOutcome
} from "@/lib/observability/api";
import { getRecruiterReviewCandidateEvidence } from "@/lib/recruiter/review-candidates";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const obs = createApiObsContext({
    request,
    routeTemplate: "/api/recruiter/candidates/[applicationId]/evidence",
    component: "recruiter_candidates",
    operation: "open_candidate_profile"
  });
  obs.recordStart({
    eventName: "recruiter.candidate_profile_open.start",
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
    domainIds,
    sentryEventId
  }: {
    response: Response;
    outcome: ObsOutcome;
    errorCode?: string;
    persona?: string;
    orgId?: string;
    actorIdSurrogate?: string;
    details?: Record<string, unknown>;
    domainIds?: Record<string, string>;
    sentryEventId?: string;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    obs.recordResult({
      statusCode: response.status,
      eventName: "recruiter.candidate_profile_open.result",
      outcome,
      errorCode,
      persona,
      orgId,
      actorIdSurrogate,
      domainIds,
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
      recordProductMetric(obs, "recruiter.candidate_profile_opened.failed", {
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

    const { applicationId } = await params;
    const applicationIdValue = applicationId?.trim() ?? "";
    const domainIds = {
      application_id: toActorSurrogate(applicationIdValue) ?? "unknown_application"
    };

    if (!applicationIdValue || applicationIdValue.length < 2) {
      const response = badRequest("invalid_application_id");
      recordProductMetric(obs, "recruiter.candidate_profile_opened.failed", {
        outcome: "handled_failure",
        statusCode: response.status,
        persona,
        orgId,
        actorIdSurrogate,
        domainIds,
        errorCode: "invalid_application_id"
      });
      return finalize({
        response,
        outcome: "handled_failure",
        errorCode: "invalid_application_id",
        persona,
        orgId,
        actorIdSurrogate,
        domainIds
      });
    }

    const { searchParams } = new URL(request.url);
    const capabilityId = searchParams.get("capability_id") ?? undefined;

    const detail = await getRecruiterReviewCandidateEvidence({
      orgId: context.org_id,
      applicationId: applicationIdValue,
      capabilityId,
    });

    if (!detail) {
      const response = badRequest("application_not_found");
      recordProductMetric(obs, "recruiter.candidate_profile_opened.failed", {
        outcome: "handled_failure",
        statusCode: response.status,
        persona,
        orgId,
        actorIdSurrogate,
        domainIds,
        errorCode: "application_not_found"
      });
      return finalize({
        response,
        outcome: "handled_failure",
        errorCode: "application_not_found",
        persona,
        orgId,
        actorIdSurrogate,
        domainIds
      });
    }

    const response = ok({
      resource: "review_candidate_evidence",
      detail,
    });

    const details = {
      capability_id_requested: capabilityId ?? null,
      evidence_sections_returned: Array.isArray(detail.artifacts) ? detail.artifacts.length : undefined
    };

    recordProductMetric(obs, "recruiter.candidate_profile_opened", {
      outcome: "success",
      statusCode: response.status,
      persona,
      orgId,
      actorIdSurrogate,
      domainIds,
      details
    });
    return finalize({
      response,
      outcome: "success",
      persona,
      orgId,
      actorIdSurrogate,
      domainIds,
      details
    });
  } catch (error) {
    const sentryEventId = obs.recordUnexpected({
      eventName: "recruiter.candidate_profile_open.unexpected",
      error,
      persona: "recruiter",
      errorCode: "unexpected_exception"
    });
    const response = Response.json({ ok: false, error: "unexpected_exception" }, { status: 500 });
    recordProductMetric(obs, "recruiter.candidate_profile_opened.failed", {
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
