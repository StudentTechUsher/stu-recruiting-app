import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();
  return ok({ resource: "candidate_explorer", context });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();
  const payload = await req.json().catch(() => null);
  return ok({ resource: "candidate_action", context, payload, status: "accepted" });
}
