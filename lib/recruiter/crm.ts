import type { ATSProvider, NormalizedATSCandidate } from "@/lib/ats/types";
import { fetchATSPipelineForOrg } from "@/lib/ats/provider-pipeline";
import type {
  CandidateCRMNote,
  CandidateCRMRecord,
  CandidateCRMReminder,
  RecruiterTimelineEvent,
} from "@/lib/recruiter/types";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type NoteRow = {
  note_id: string;
  candidate_key: string;
  student_profile_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
};

type ReminderRow = {
  reminder_id: string;
  candidate_key: string;
  student_profile_id: string | null;
  title: string;
  due_at: string | null;
  status: "open" | "completed" | "dismissed";
  created_at: string;
  completed_at: string | null;
};

type RecommendationEventRow = {
  event_id: string;
  candidate_key: string;
  event_type: "recommendation" | "recruiter_action";
  action_name: string | null;
  recommendation_state: string | null;
  reason_code: string | null;
  student_profile_id: string | null;
  candidate_email: string | null;
  created_at: string;
};

type CandidateMeta = {
  student_profile_id: string | null;
  candidate_email: string | null;
};

const normalizeEmail = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCandidateKey = (provider: ATSProvider, atsCandidateId: string): string => {
  return `${provider}:${atsCandidateId}`;
};

const toCandidateRecordId = (candidate: {
  candidate_key: string;
  student_profile_id: string | null;
  email: string | null;
}): string => {
  if (candidate.student_profile_id) return `profile:${candidate.student_profile_id}`;
  if (candidate.email) return `email:${candidate.email}`;
  return `candidate:${candidate.candidate_key}`;
};

const toNote = (row: NoteRow): CandidateCRMNote => ({
  note_id: row.note_id,
  candidate_key: row.candidate_key,
  student_profile_id: row.student_profile_id,
  note_text: row.note_text,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const toReminder = (row: ReminderRow): CandidateCRMReminder => ({
  reminder_id: row.reminder_id,
  candidate_key: row.candidate_key,
  student_profile_id: row.student_profile_id,
  title: row.title,
  due_at: row.due_at,
  status: row.status,
  created_at: row.created_at,
  completed_at: row.completed_at,
});

const toTimelineFromRecommendationEvent = (row: RecommendationEventRow): RecruiterTimelineEvent => {
  const title =
    row.event_type === "recruiter_action"
      ? `Recruiter action: ${row.action_name ?? "updated"}`
      : `Recommendation: ${row.recommendation_state ?? "manual_review"}`;

  return {
    id: row.event_id,
    candidate_key: row.candidate_key,
    event_type: row.event_type,
    title,
    detail: row.event_type === "recruiter_action" ? row.action_name : row.reason_code,
    created_at: row.created_at,
  };
};

type CandidateRecordAccumulator = CandidateCRMRecord & {
  _role_set: Set<string>;
  _job_id_set: Set<string>;
  _candidate_key_set: Set<string>;
};

export function buildCandidateCRMRecords(input: {
  provider: ATSProvider;
  candidates: NormalizedATSCandidate[];
  candidateMetaByKey?: Map<string, CandidateMeta>;
}): CandidateCRMRecord[] {
  const candidateMetaByKey = input.candidateMetaByKey ?? new Map<string, CandidateMeta>();
  const byRecordId = new Map<string, CandidateRecordAccumulator>();

  for (const candidate of input.candidates) {
    if (candidate.status !== "active") continue;

    const candidateKey = toCandidateKey(input.provider, candidate.ats_id);
    const meta = candidateMetaByKey.get(candidateKey);
    const email = normalizeEmail(meta?.candidate_email ?? candidate.email);
    const studentProfileId = meta?.student_profile_id ?? null;
    const recordId = toCandidateRecordId({
      candidate_key: candidateKey,
      student_profile_id: studentProfileId,
      email,
    });
    const appliedAt = candidate.applied_at ?? null;
    const appliedAtTimestamp = toTimestamp(appliedAt);

    let record = byRecordId.get(recordId);
    if (!record) {
      record = {
        record_id: recordId,
        primary_candidate_key: candidateKey,
        candidate_keys: [],
        display_name: candidate.full_name,
        email,
        student_profile_id: studentProfileId,
        applied_roles: [],
        applied_job_ids: [],
        active_application_count: 0,
        latest_stage: candidate.current_stage,
        latest_applied_at: appliedAt,
        latest_activity_at: null,
        open_reminder_count: 0,
        note_count: 0,
        _role_set: new Set<string>(),
        _job_id_set: new Set<string>(),
        _candidate_key_set: new Set<string>(),
      };
      byRecordId.set(recordId, record);
    }

    record._candidate_key_set.add(candidateKey);
    if (candidate.job_title) record._role_set.add(candidate.job_title);
    if (candidate.job_id) record._job_id_set.add(candidate.job_id);

    const currentLatestAppliedAtTimestamp = toTimestamp(record.latest_applied_at);
    if (appliedAtTimestamp >= currentLatestAppliedAtTimestamp) {
      record.primary_candidate_key = candidateKey;
      record.latest_applied_at = appliedAt;
      record.latest_stage = candidate.current_stage;
      record.display_name = candidate.full_name || record.display_name;
      if (email) record.email = email;
      if (studentProfileId && !record.student_profile_id) record.student_profile_id = studentProfileId;
    }
  }

  return [...byRecordId.values()]
    .map((record) => ({
      record_id: record.record_id,
      primary_candidate_key: record.primary_candidate_key,
      candidate_keys: [...record._candidate_key_set].sort(),
      display_name: record.display_name,
      email: record.email,
      student_profile_id: record.student_profile_id,
      applied_roles: [...record._role_set].sort(),
      applied_job_ids: [...record._job_id_set].sort(),
      active_application_count: record._candidate_key_set.size,
      latest_stage: record.latest_stage,
      latest_applied_at: record.latest_applied_at,
      latest_activity_at: record.latest_activity_at,
      open_reminder_count: record.open_reminder_count,
      note_count: record.note_count,
    }))
    .sort((first, second) => {
      const byAppliedAt = toTimestamp(second.latest_applied_at) - toTimestamp(first.latest_applied_at);
      if (byAppliedAt !== 0) return byAppliedAt;
      return first.display_name.localeCompare(second.display_name);
    });
}

const withLatestActivity = (record: CandidateCRMRecord, timestamp: string) => {
  const current = toTimestamp(record.latest_activity_at);
  const next = toTimestamp(timestamp);
  if (next > current) record.latest_activity_at = timestamp;
};

export async function getCandidateRelationshipManagerData(input: {
  orgId: string;
  candidateKey?: string;
}): Promise<{
  candidate_records: CandidateCRMRecord[];
  timeline: RecruiterTimelineEvent[];
  notes: CandidateCRMNote[];
  reminders: CandidateCRMReminder[];
}> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { candidate_records: [], timeline: [], notes: [], reminders: [] };

  const notesQuery = supabase
    .from("recruiter_candidate_notes")
    .select("note_id, candidate_key, student_profile_id, note_text, created_at, updated_at")
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .limit(300);

  const remindersQuery = supabase
    .from("recruiter_candidate_reminders")
    .select("reminder_id, candidate_key, student_profile_id, title, due_at, status, created_at, completed_at")
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .limit(300);

  const eventsQuery = supabase
    .from("recruiter_recommendation_events")
    .select(
      "event_id, candidate_key, event_type, action_name, recommendation_state, reason_code, student_profile_id, candidate_email, created_at"
    )
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .limit(600);

  if (input.candidateKey) {
    notesQuery.eq("candidate_key", input.candidateKey);
    remindersQuery.eq("candidate_key", input.candidateKey);
    eventsQuery.eq("candidate_key", input.candidateKey);
  }

  const [{ data: noteRows }, { data: reminderRows }, { data: eventRows }] = (await Promise.all([
    notesQuery,
    remindersQuery,
    eventsQuery,
  ])) as [
    { data: NoteRow[] | null },
    { data: ReminderRow[] | null },
    { data: RecommendationEventRow[] | null },
  ];

  const notes = (noteRows ?? []).map(toNote);
  const reminders = (reminderRows ?? []).map(toReminder);
  const eventTimeline = (eventRows ?? []).map(toTimelineFromRecommendationEvent);

  const noteTimeline = notes.map<RecruiterTimelineEvent>((note) => ({
    id: note.note_id,
    candidate_key: note.candidate_key,
    event_type: "crm_note",
    title: "Recruiter note added",
    detail: note.note_text,
    created_at: note.created_at,
  }));

  const reminderTimeline = reminders.map<RecruiterTimelineEvent>((reminder) => ({
    id: reminder.reminder_id,
    candidate_key: reminder.candidate_key,
    event_type: "crm_reminder",
    title: `Reminder ${reminder.status}`,
    detail: reminder.title,
    created_at: reminder.created_at,
  }));

  const timeline = [...eventTimeline, ...noteTimeline, ...reminderTimeline].sort((a, b) => {
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  const candidateMetaByKey = new Map<string, CandidateMeta>();
  for (const row of eventRows ?? []) {
    if (candidateMetaByKey.has(row.candidate_key)) continue;
    candidateMetaByKey.set(row.candidate_key, {
      student_profile_id: row.student_profile_id,
      candidate_email: row.candidate_email,
    });
  }

  let candidateRecords: CandidateCRMRecord[] = [];
  try {
    const first = await fetchATSPipelineForOrg(input.orgId, { page: 1 });
    const allCandidates: NormalizedATSCandidate[] = [...first.result.candidates];
    let hasMore = first.result.has_more;
    let page = 2;
    while (hasMore && first.provider !== "lever" && page <= 5) {
      const next = await fetchATSPipelineForOrg(input.orgId, { page });
      allCandidates.push(...next.result.candidates);
      hasMore = next.result.has_more;
      page += 1;
    }

    candidateRecords = buildCandidateCRMRecords({
      provider: first.provider,
      candidates: allCandidates,
      candidateMetaByKey,
    });
  } catch {
    candidateRecords = [];
  }

  const recordByCandidateKey = new Map<string, CandidateCRMRecord>();
  for (const record of candidateRecords) {
    for (const candidateKey of record.candidate_keys) {
      recordByCandidateKey.set(candidateKey, record);
    }
  }

  for (const note of notes) {
    const record = recordByCandidateKey.get(note.candidate_key);
    if (!record) continue;
    record.note_count += 1;
    withLatestActivity(record, note.created_at);
  }

  for (const reminder of reminders) {
    const record = recordByCandidateKey.get(reminder.candidate_key);
    if (!record) continue;
    if (reminder.status === "open") record.open_reminder_count += 1;
    withLatestActivity(record, reminder.created_at);
  }

  for (const event of eventTimeline) {
    const record = recordByCandidateKey.get(event.candidate_key);
    if (!record) continue;
    withLatestActivity(record, event.created_at);
  }

  if (input.candidateKey) {
    candidateRecords = candidateRecords.filter((record) => record.candidate_keys.includes(input.candidateKey!));
  }

  candidateRecords = candidateRecords.sort((first, second) => {
    const byActivity = toTimestamp(second.latest_activity_at) - toTimestamp(first.latest_activity_at);
    if (byActivity !== 0) return byActivity;
    return toTimestamp(second.latest_applied_at) - toTimestamp(first.latest_applied_at);
  });

  return {
    candidate_records: candidateRecords,
    timeline,
    notes,
    reminders,
  };
}

export async function addCandidateCRMNote(input: {
  orgId: string;
  userId: string;
  candidateKey: string;
  noteText: string;
  studentProfileId?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data, error } = (await supabase
    .from("recruiter_candidate_notes")
    .insert({
      org_id: input.orgId,
      candidate_key: input.candidateKey,
      student_profile_id: input.studentProfileId ?? null,
      note_text: input.noteText,
      created_by: input.userId,
    })
    .select("note_id, candidate_key, student_profile_id, note_text, created_at, updated_at")
    .limit(1)) as { data: NoteRow[] | null; error: unknown };

  if (error || !data?.[0]) throw new Error("crm_note_create_failed");
  return toNote(data[0]);
}

export async function addCandidateCRMReminder(input: {
  orgId: string;
  userId: string;
  candidateKey: string;
  title: string;
  dueAt?: string | null;
  studentProfileId?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data, error } = (await supabase
    .from("recruiter_candidate_reminders")
    .insert({
      org_id: input.orgId,
      candidate_key: input.candidateKey,
      student_profile_id: input.studentProfileId ?? null,
      title: input.title,
      due_at: input.dueAt ?? null,
      created_by: input.userId,
    })
    .select("reminder_id, candidate_key, student_profile_id, title, due_at, status, created_at, completed_at")
    .limit(1)) as { data: ReminderRow[] | null; error: unknown };

  if (error || !data?.[0]) throw new Error("crm_reminder_create_failed");
  return toReminder(data[0]);
}

export async function updateCandidateCRMReminderStatus(input: {
  orgId: string;
  reminderId: string;
  status: "open" | "completed" | "dismissed";
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const completedAt = input.status === "completed" ? new Date().toISOString() : null;

  const { data, error } = (await supabase
    .from("recruiter_candidate_reminders")
    .update({
      status: input.status,
      completed_at: completedAt,
    })
    .eq("org_id", input.orgId)
    .eq("reminder_id", input.reminderId)
    .select("reminder_id, candidate_key, student_profile_id, title, due_at, status, created_at, completed_at")
    .limit(1)) as { data: ReminderRow[] | null; error: unknown };

  if (error || !data?.[0]) throw new Error("crm_reminder_update_failed");
  return toReminder(data[0]);
}
