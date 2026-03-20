"use client";

import { useEffect, useMemo, useState } from "react";

type CRMRecord = {
  record_id: string;
  primary_candidate_key: string;
  candidate_keys: string[];
  display_name: string;
  email: string | null;
  student_profile_id: string | null;
  applied_roles: string[];
  applied_job_ids: string[];
  active_application_count: number;
  latest_stage: string | null;
  latest_applied_at: string | null;
  latest_activity_at: string | null;
  open_reminder_count: number;
  note_count: number;
};

type CRMNote = {
  note_id: string;
  candidate_key: string;
  note_text: string;
  created_at: string;
};

type CRMReminder = {
  reminder_id: string;
  candidate_key: string;
  title: string;
  due_at: string | null;
  status: "open" | "completed" | "dismissed";
  created_at: string;
};

type TimelineEvent = {
  id: string;
  candidate_key: string;
  event_type: "recommendation" | "recruiter_action" | "crm_note" | "crm_reminder";
  title: string;
  detail: string | null;
  created_at: string;
};

type CRMPayload = {
  candidate_records: CRMRecord[];
  timeline: TimelineEvent[];
  notes: CRMNote[];
  reminders: CRMReminder[];
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#dbe8e2] dark:bg-slate-700/70";

export function RecruiterCandidateRelationshipManager() {
  const [data, setData] = useState<CRMPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [reminderDraft, setReminderDraft] = useState("");
  const [dueAtDraft, setDueAtDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const load = async (keepSelectedRecordId?: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recruiter/candidate-relationship-manager", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: CRMPayload }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("crm_load_failed");
      }

      setData(payload.data);

      const preferredRecordId = keepSelectedRecordId ?? selectedRecordId;
      const hasPreferredRecord = Boolean(
        preferredRecordId &&
          payload.data.candidate_records.some((record) => record.record_id === preferredRecordId)
      );
      if (hasPreferredRecord) {
        setSelectedRecordId(preferredRecordId);
      } else {
        setSelectedRecordId(payload.data.candidate_records[0]?.record_id ?? null);
      }
    } catch {
      setError("Unable to load CRM data right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRecords = useMemo(() => {
    const source = data?.candidate_records ?? [];
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) return source;

    return source.filter((record) => {
      return (
        record.display_name.toLowerCase().includes(query) ||
        (record.email ?? "").toLowerCase().includes(query) ||
        record.applied_roles.some((role) => role.toLowerCase().includes(query))
      );
    });
  }, [data, searchTerm]);

  const selectedRecord = useMemo(() => {
    if (!data?.candidate_records?.length) return null;
    return (
      data.candidate_records.find((record) => record.record_id === selectedRecordId) ??
      data.candidate_records[0] ??
      null
    );
  }, [data, selectedRecordId]);

  const selectedCandidateKeys = useMemo(() => {
    return new Set(selectedRecord?.candidate_keys ?? []);
  }, [selectedRecord]);

  const selectedTimeline = useMemo(() => {
    return (data?.timeline ?? [])
      .filter((event) => selectedCandidateKeys.has(event.candidate_key))
      .slice(0, 30);
  }, [data, selectedCandidateKeys]);

  const selectedNotes = useMemo(() => {
    return (data?.notes ?? [])
      .filter((note) => selectedCandidateKeys.has(note.candidate_key))
      .slice(0, 20);
  }, [data, selectedCandidateKeys]);

  const selectedOpenReminders = useMemo(() => {
    return (data?.reminders ?? [])
      .filter((reminder) => selectedCandidateKeys.has(reminder.candidate_key) && reminder.status === "open")
      .slice(0, 20);
  }, [data, selectedCandidateKeys]);

  const submitNote = async () => {
    if (!selectedRecord || noteDraft.trim().length === 0) {
      setStatusMessage("Choose a candidate record and enter note text.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/recruiter/candidate-relationship-manager", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "note",
          candidate_key: selectedRecord.primary_candidate_key,
          note_text: noteDraft.trim(),
          student_profile_id: selectedRecord.student_profile_id ?? undefined,
        }),
      });

      if (!response.ok) throw new Error("crm_note_save_failed");
      setNoteDraft("");
      setStatusMessage("Saved recruiter note.");
      await load(selectedRecord.record_id);
    } catch {
      setStatusMessage("Unable to save note.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitReminder = async () => {
    if (!selectedRecord || reminderDraft.trim().length === 0) {
      setStatusMessage("Choose a candidate record and enter a reminder title.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/recruiter/candidate-relationship-manager", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          candidate_key: selectedRecord.primary_candidate_key,
          title: reminderDraft.trim(),
          due_at: dueAtDraft.trim().length > 0 ? dueAtDraft.trim() : undefined,
          student_profile_id: selectedRecord.student_profile_id ?? undefined,
        }),
      });

      if (!response.ok) throw new Error("crm_reminder_save_failed");

      setReminderDraft("");
      setDueAtDraft("");
      setStatusMessage("Saved reminder.");
      await load(selectedRecord.record_id);
    } catch {
      setStatusMessage("Unable to save reminder.");
    } finally {
      setIsSaving(false);
    }
  };

  const completeReminder = async (reminder: CRMReminder) => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/recruiter/candidate-relationship-manager", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "reminder_status",
          reminder_id: reminder.reminder_id,
          status: "completed",
        }),
      });

      if (!response.ok) throw new Error("crm_reminder_update_failed");
      setStatusMessage("Reminder marked complete.");
      await load(selectedRecord?.record_id ?? null);
    } catch {
      setStatusMessage("Unable to update reminder status.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="w-full px-6 py-8 lg:px-8">
      <div className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4d675f] dark:text-slate-400">
            Candidate CRM v1
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
            Active Candidate Records
          </h2>
          <p className="mt-2 text-sm text-[#4e6a61] dark:text-slate-300">
            Records are deduped by student identity and email. Multiple applications are grouped into one record with
            role badges.
          </p>
        </header>

        {isLoading ? (
          <CRMSkeleton />
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1.85fr]">
            <aside className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                  Candidate records
                </h3>
                <span className="text-xs text-[#557068] dark:text-slate-400">{visibleRecords.length}</span>
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, email, or role"
                className="mb-3 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />

              <div className="max-h-[36rem] space-y-2 overflow-auto pr-1">
                {visibleRecords.map((record) => {
                  const isSelected = record.record_id === selectedRecord?.record_id;
                  return (
                    <button
                      key={record.record_id}
                      type="button"
                      onClick={() => setSelectedRecordId(record.record_id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-[#9cc4b2] bg-[#eff8f3] dark:border-emerald-700/70 dark:bg-emerald-950/30"
                          : "border-[#dbe8e2] bg-white hover:bg-[#f6fbf8] dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#163d32] dark:text-slate-100">{record.display_name}</p>
                      <p className="mt-0.5 text-xs text-[#527067] dark:text-slate-400">{record.email ?? "No email"}</p>
                      <p className="mt-1 text-[11px] text-[#5b786f] dark:text-slate-400">
                        {record.active_application_count} active application
                        {record.active_application_count === 1 ? "" : "s"} · {record.latest_stage ?? "No stage"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {record.applied_roles.slice(0, 3).map((role) => (
                          <span
                            key={`${record.record_id}-${role}`}
                            className="rounded-md bg-[#e9f4ef] px-2 py-0.5 text-[10px] font-semibold text-[#2f5a4d] dark:bg-slate-800 dark:text-slate-300"
                          >
                            {role}
                          </span>
                        ))}
                        {record.applied_roles.length > 3 ? (
                          <span className="rounded-md bg-[#edf3f9] px-2 py-0.5 text-[10px] font-semibold text-[#3b5877] dark:bg-slate-800 dark:text-slate-300">
                            +{record.applied_roles.length - 3} roles
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {visibleRecords.length === 0 ? (
                  <p className="text-sm text-[#4c6860] dark:text-slate-300">No active candidate records found.</p>
                ) : null}
              </div>
            </aside>

            <section className="space-y-4">
              {!selectedRecord ? (
                <div className="rounded-2xl border border-[#d7e4dd] bg-white p-5 text-sm text-[#4c6860] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                  Select a candidate record to view timeline, notes, and reminders.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-[#123a30] dark:text-slate-100">
                          {selectedRecord.display_name}
                        </h3>
                        <p className="mt-1 text-sm text-[#4f6960] dark:text-slate-300">
                          {selectedRecord.email ?? "No email"} · {selectedRecord.active_application_count} active
                          application{selectedRecord.active_application_count === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 text-xs text-[#5c786f] dark:text-slate-400">
                          Primary candidate key: {selectedRecord.primary_candidate_key}
                        </p>
                      </div>
                      <div className="text-right text-xs text-[#557068] dark:text-slate-400">
                        <p>Open reminders: {selectedRecord.open_reminder_count}</p>
                        <p>Notes: {selectedRecord.note_count}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRecord.applied_roles.map((role) => (
                        <span
                          key={`${selectedRecord.record_id}-${role}`}
                          className="rounded-md bg-[#e8f3ed] px-2 py-1 text-xs font-semibold text-[#2f5a4d] dark:bg-slate-800 dark:text-slate-300"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                        Add note
                      </h4>
                      <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        placeholder="Capture interview feedback, context, or next steps"
                      />
                      <button
                        type="button"
                        onClick={submitNote}
                        disabled={isSaving}
                        className="mt-2 rounded-lg border border-[#b8cdc3] bg-white px-3 py-1.5 text-xs font-semibold text-[#244a3d] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Save note
                      </button>
                    </div>

                    <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                        Add reminder
                      </h4>
                      <input
                        value={reminderDraft}
                        onChange={(event) => setReminderDraft(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        placeholder="Schedule follow-up call"
                      />
                      <input
                        value={dueAtDraft}
                        onChange={(event) => setDueAtDraft(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        placeholder="2026-04-01T16:00:00Z (optional)"
                      />
                      <button
                        type="button"
                        onClick={submitReminder}
                        disabled={isSaving}
                        className="mt-2 rounded-lg border border-[#b8cdc3] bg-white px-3 py-1.5 text-xs font-semibold text-[#244a3d] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Save reminder
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                        Timeline
                      </h4>
                      <ul className="mt-3 space-y-2">
                        {selectedTimeline.map((event) => (
                          <li key={event.id} className="rounded-lg border border-[#dbe8e2] px-3 py-2 text-xs dark:border-slate-700">
                            <p className="font-semibold text-[#163d32] dark:text-slate-200">{event.title}</p>
                            {event.detail ? <p className="mt-1 text-[#4f6960] dark:text-slate-400">{event.detail}</p> : null}
                            <p className="mt-1 text-[#648078] dark:text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                          </li>
                        ))}
                        {selectedTimeline.length === 0 ? (
                          <li className="text-sm text-[#4c6860] dark:text-slate-300">No timeline events yet.</li>
                        ) : null}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                        Open reminders
                      </h4>
                      <ul className="mt-3 space-y-2">
                        {selectedOpenReminders.map((reminder) => (
                          <li key={reminder.reminder_id} className="rounded-lg border border-[#dbe8e2] px-3 py-2 text-xs dark:border-slate-700">
                            <p className="font-semibold text-[#163d32] dark:text-slate-200">{reminder.title}</p>
                            {reminder.due_at ? (
                              <p className="mt-1 text-[#648078] dark:text-slate-500">
                                Due: {new Date(reminder.due_at).toLocaleString()}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => completeReminder(reminder)}
                              disabled={isSaving}
                              className="mt-2 rounded-md border border-[#b8cdc3] bg-white px-2 py-1 text-[11px] font-semibold text-[#244a3d] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            >
                              Mark complete
                            </button>
                          </li>
                        ))}
                        {selectedOpenReminders.length === 0 ? (
                          <li className="text-sm text-[#4c6860] dark:text-slate-300">No open reminders.</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                      Recent notes
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {selectedNotes.map((note) => (
                        <li key={note.note_id} className="rounded-lg border border-[#dbe8e2] px-3 py-2 text-xs dark:border-slate-700">
                          <p className="text-[#304c43] dark:text-slate-200">{note.note_text}</p>
                          <p className="mt-1 text-[#648078] dark:text-slate-500">{new Date(note.created_at).toLocaleString()}</p>
                        </li>
                      ))}
                      {selectedNotes.length === 0 ? (
                        <li className="text-sm text-[#4c6860] dark:text-slate-300">No notes yet.</li>
                      ) : null}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CRMSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 xl:grid-cols-[1.15fr_1.85fr]">
      <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
        <div className={`${skeletonBlockClassName} h-8 w-full`} />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`crm-record-skeleton-${index}`} className={`${skeletonBlockClassName} h-20 w-full`} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className={`${skeletonBlockClassName} h-24 w-full`} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${skeletonBlockClassName} h-44 w-full`} />
          <div className={`${skeletonBlockClassName} h-44 w-full`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${skeletonBlockClassName} h-64 w-full`} />
          <div className={`${skeletonBlockClassName} h-64 w-full`} />
        </div>
      </div>
    </div>
  );
}
