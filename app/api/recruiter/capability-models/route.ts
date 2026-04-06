import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { normalizeRoleCapabilityAxes, validateRoleCapabilityAxes } from "@/lib/recruiter/capability-axes";
import {
  createCapabilityModel,
  ensureRecruiterIdByUserId,
  getRecruiterIdByUserId,
  listCapabilityModels,
} from "@/lib/recruiter/capability-models";

const numericRecordSchema = z.record(z.string(), z.number());
const roleCapabilityAxisSchema = z.object({
  axis_id: z.string().min(1),
  required_level: z.number(),
  weight: z.number(),
  required_level_source: z.enum(["authored", "legacy_default"]).optional(),
  required_evidence_types: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

const createModelSchema = z.object({
  model_name: z.string().min(2),
  description: z.string().optional(),
  role_id: z.string().uuid().nullable().optional(),
  axes: z.array(roleCapabilityAxisSchema).optional(),
  weights: numericRecordSchema.optional(),
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
  const axes = normalizeRoleCapabilityAxes({
    axes: parsed.data.axes ?? null,
    weights: parsed.data.weights ?? {},
  });
  const axisValidationError = validateRoleCapabilityAxes(axes);
  if (axisValidationError) return badRequest(axisValidationError);
  const recruiterId = await ensureRecruiterIdByUserId(context.user_id);
  if (!recruiterId) return badRequest("recruiter_profile_not_found");

  const created = await createCapabilityModel({
    orgId: context.org_id,
    userId: context.user_id,
    recruiterId,
    modelName: parsed.data.model_name,
    description: parsed.data.description,
    roleId: parsed.data.role_id ?? null,
    axes,
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
