import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { publishCapabilityModelVersion } from "@/lib/recruiter/capability-models";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ modelId: string; versionId: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { modelId, versionId } = await params;

  const version = await publishCapabilityModelVersion({
    orgId: context.org_id,
    modelId,
    versionId,
  });

  return ok({ version });
}
