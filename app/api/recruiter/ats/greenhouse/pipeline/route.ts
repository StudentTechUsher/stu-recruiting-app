import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchGreenhousePipeline } from "@/lib/ats/greenhouse";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { searchParams } = new URL(request.url);
  try {
    const result = await fetchGreenhousePipeline(context.org_id, {
      jobId: searchParams.get("job_id") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
    });
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "greenhouse_not_configured")
      return badRequest("Greenhouse integration not configured");
    throw e;
  }
}
