import { z } from "zod";
import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  addCandidateCRMNote,
  addCandidateCRMReminder,
  getCandidateRelationshipManagerData,
  updateCandidateCRMReminderStatus,
} from "@/lib/recruiter/crm";

const createNoteSchema = z.object({
  type: z.literal("note"),
  candidate_key: z.string().min(3),
  note_text: z.string().min(1).max(4000),
  student_profile_id: z.string().optional(),
});

const createReminderSchema = z.object({
  type: z.literal("reminder"),
  candidate_key: z.string().min(3),
  title: z.string().min(1).max(512),
  due_at: z.string().optional(),
  student_profile_id: z.string().optional(),
});

const updateReminderSchema = z.object({
  type: z.literal("reminder_status"),
  reminder_id: z.string().min(3),
  status: z.enum(["open", "completed", "dismissed"]),
});

const postSchema = z.discriminatedUnion("type", [
  createNoteSchema,
  createReminderSchema,
  updateReminderSchema,
]);

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const { searchParams } = new URL(request.url);
  const candidateKey = searchParams.get("candidate_key") ?? undefined;

  const data = await getCandidateRelationshipManagerData({
    orgId: context.org_id,
    candidateKey,
  });

  return ok(data);
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  const payload = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid_crm_payload");

  if (parsed.data.type === "note") {
    const note = await addCandidateCRMNote({
      orgId: context.org_id,
      userId: context.user_id,
      candidateKey: parsed.data.candidate_key,
      noteText: parsed.data.note_text,
      studentProfileId: parsed.data.student_profile_id,
    });

    return ok({ note });
  }

  if (parsed.data.type === "reminder") {
    const reminder = await addCandidateCRMReminder({
      orgId: context.org_id,
      userId: context.user_id,
      candidateKey: parsed.data.candidate_key,
      title: parsed.data.title,
      dueAt: parsed.data.due_at,
      studentProfileId: parsed.data.student_profile_id,
    });

    return ok({ reminder });
  }

  const reminder = await updateCandidateCRMReminderStatus({
    orgId: context.org_id,
    reminderId: parsed.data.reminder_id,
    status: parsed.data.status,
  });

  return ok({ reminder });
}
