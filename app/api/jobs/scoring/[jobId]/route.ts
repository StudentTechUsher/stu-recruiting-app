import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  const authContext = await getAuthContext();
  if (!hasPersona(authContext, ["recruiter", "org_admin"])) return forbidden();

  const { jobId } = await context.params;

  return ok({
    resource: "scoring_job_status",
    context: authContext,
    jobId,
    status: "queued",
    lifecycle: ["queued", "running", "complete", "failed"]
  });
}
