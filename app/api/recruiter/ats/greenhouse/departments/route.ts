import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { ok, badRequest, forbidden } from "@/lib/api-response";
import { fetchGreenhouseDepartments } from "@/lib/ats/greenhouse";

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  try {
    const result = await fetchGreenhouseDepartments(context.org_id);
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "greenhouse_not_configured")
      return badRequest("Greenhouse integration not configured");
    throw e;
  }
}
