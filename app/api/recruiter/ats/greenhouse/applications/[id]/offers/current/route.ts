import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchGreenhouseCurrentOffer } from "@/lib/ats/greenhouse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { id } = await params;
  try {
    const result = await fetchGreenhouseCurrentOffer(context.org_id, id);
    if (!result) return badRequest("No offer found for this application");
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "greenhouse_not_configured")
      return badRequest("Greenhouse integration not configured");
    throw e;
  }
}
