import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getCapabilityModel } from "@/lib/recruiter/capability-models";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { modelId } = await params;

  const result = await getCapabilityModel(context.org_id, modelId);
  if (!result.model) return badRequest("capability_model_not_found");

  return ok(result);
}
