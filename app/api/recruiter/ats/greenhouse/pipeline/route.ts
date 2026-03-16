import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchGreenhousePipeline, getGreenhouseConfig } from "@/lib/ats/greenhouse";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const config = getGreenhouseConfig();
  if (!config) return badRequest("Greenhouse integration not configured");

  const { searchParams } = new URL(request.url);
  const result = await fetchGreenhousePipeline({
    jobId: searchParams.get("job_id") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
  });
  return ok(result);
}
