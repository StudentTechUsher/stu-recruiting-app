import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { listRecruiterReviewCandidates } from "@/lib/recruiter/review-candidates";

const actionPayloadSchema = z.object({
  candidate_key: z.string().min(3),
  action_name: z.string().min(2),
});

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { searchParams } = new URL(request.url);

  const result = await listRecruiterReviewCandidates({
    orgId: context.org_id,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("page_size") ?? 25),
    jobRole: searchParams.get("job_role") ?? undefined,
  });

  return ok({
    resource: "review_candidates",
    provider: result.provider,
    candidates: result.candidates,
    total: result.total,
    page: result.page,
    page_size: result.page_size,
    has_more: result.has_more,
    job_roles: result.job_roles,
  });
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
