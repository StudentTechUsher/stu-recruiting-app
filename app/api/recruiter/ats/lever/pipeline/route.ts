import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchLeverPipeline, getLeverConfig } from "@/lib/ats/lever";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const config = getLeverConfig();
  if (!config) return badRequest("Lever integration not configured");

  const { searchParams } = new URL(request.url);
  const result = await fetchLeverPipeline({
    postingId: searchParams.get("posting_id") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  return ok(result);
}
