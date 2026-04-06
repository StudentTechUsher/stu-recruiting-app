import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { normalizeRoleCapabilityAxes, validateRoleCapabilityAxes } from "@/lib/recruiter/capability-axes";
import {
  createCapabilityModelVersion,
  getCapabilityModel,
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

const createVersionSchema = z.object({
  axes: z.array(roleCapabilityAxisSchema).optional(),
  weights: numericRecordSchema.optional(),
  thresholds: numericRecordSchema,
  required_evidence: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { modelId } = await params;
  const result = await getCapabilityModel(context.org_id, modelId);
  if (!result.model) return badRequest("capability_model_not_found");

  return ok({ versions: result.versions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = createVersionSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_capability_model_version_payload");
  const axes = normalizeRoleCapabilityAxes({
    axes: parsed.data.axes ?? null,
    weights: parsed.data.weights ?? {},
  });
  const axisValidationError = validateRoleCapabilityAxes(axes);
  if (axisValidationError) return badRequest(axisValidationError);

  const { modelId } = await params;

  const version = await createCapabilityModelVersion({
    orgId: context.org_id,
    userId: context.user_id,
    modelId,
    axes,
    thresholds: parsed.data.thresholds,
    requiredEvidence: parsed.data.required_evidence,
    notes: parsed.data.notes,
  });

  return ok({ version });
}
