import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  createCapabilityModel,
  ensureRecruiterIdByUserId,
  getRecruiterIdByUserId,
  listCapabilityModels,
} from "@/lib/recruiter/capability-models";

const numericRecordSchema = z.record(z.string(), z.number());

const createModelSchema = z.object({
  model_name: z.string().min(2),
  description: z.string().optional(),
  weights: numericRecordSchema,
  thresholds: numericRecordSchema,
  required_evidence: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  publish: z.boolean().optional(),
});

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const recruiterId = await getRecruiterIdByUserId(context.user_id);
  if (!recruiterId) return ok({ models: [] });

  const models = await listCapabilityModels(recruiterId);
  return ok({ models });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = createModelSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_capability_model_payload");
  const recruiterId = await ensureRecruiterIdByUserId(context.user_id);
  if (!recruiterId) return badRequest("recruiter_profile_not_found");

  const created = await createCapabilityModel({
    orgId: context.org_id,
    userId: context.user_id,
    recruiterId,
    modelName: parsed.data.model_name,
    description: parsed.data.description,
    weights: parsed.data.weights,
    thresholds: parsed.data.thresholds,
    requiredEvidence: parsed.data.required_evidence,
    notes: parsed.data.notes,
    publish: parsed.data.publish,
  });

  return ok({
    model: created.model,
    version: created.version,
  });
}
