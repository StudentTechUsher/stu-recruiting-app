import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchLeverPipeline } from "@/lib/ats/lever";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { searchParams } = new URL(request.url);

  try {
    const result = await fetchLeverPipeline(context.org_id, {
      postingId: searchParams.get("posting_id") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("lever_not_configured")) {
      return badRequest("Lever integration not configured");
    }

    throw error;
  }
}
