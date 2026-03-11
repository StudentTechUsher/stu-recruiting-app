import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  return ok({
    resource: "off_platform_ingest",
    context,
    payload,
    warning: "heuristic_only_unvalidated_longitudinal_behavior",
    status: "queued"
  });
}
