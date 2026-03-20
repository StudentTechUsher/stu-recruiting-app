import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  createCapabilityModelVersion,
  getCapabilityModel,
} from "@/lib/recruiter/capability-models";

const numericRecordSchema = z.record(z.string(), z.number());

const createVersionSchema = z.object({
  weights: numericRecordSchema,
  thresholds: numericRecordSchema,
  required_evidence: z.array(z.string()).default([]),
  notes: z.string().optional(),
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

  const { modelId } = await params;

  const version = await createCapabilityModelVersion({
    orgId: context.org_id,
    userId: context.user_id,
    modelId,
    weights: parsed.data.weights,
    thresholds: parsed.data.thresholds,
    requiredEvidence: parsed.data.required_evidence,
    notes: parsed.data.notes,
  });

  return ok({ version });
}
