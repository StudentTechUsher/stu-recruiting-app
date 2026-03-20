import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { recordRecruiterCandidateAction } from "@/lib/recruiter/candidate-discovery";

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

  const result = await recordRecruiterCandidateAction({
    orgId: context.org_id,
    userId: context.user_id,
    candidateKey: parsed.data.candidate_key,
    actionName: parsed.data.action_name,
    details: parsed.data.details,
  });

  return ok({
    status: result.recorded ? "recorded" : "not_recorded",
  });
}
