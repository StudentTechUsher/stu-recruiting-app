import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getRecruiterReviewCandidateEvidence } from "@/lib/recruiter/review-candidates";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { applicationId } = await params;
  if (!applicationId || applicationId.trim().length < 2) {
    return badRequest("invalid_application_id");
  }

  const { searchParams } = new URL(request.url);
  const capabilityId = searchParams.get("capability_id") ?? undefined;

  const detail = await getRecruiterReviewCandidateEvidence({
    orgId: context.org_id,
    applicationId,
    capabilityId,
  });

  if (!detail) return badRequest("application_not_found");

  return ok({
    resource: "review_candidate_evidence",
    detail,
  });
}
