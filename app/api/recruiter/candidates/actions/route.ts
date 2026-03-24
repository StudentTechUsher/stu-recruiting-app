import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";

const payloadSchema = z.object({
  candidate_key: z.string().min(3),
  action_name: z.string().min(2),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_candidate_action_payload");

  return ok({
    status: "disabled_in_phase1",
  });
}
