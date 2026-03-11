import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();
  return ok({ resource: "interview_sessions", context });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();
  const payload = await req.json().catch(() => null);
  return ok({ resource: "interview_sessions", context, payload, status: "created" });
}
