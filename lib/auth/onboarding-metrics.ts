const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toIsoDateString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const toDurationMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return null;
};

export function parseOnboardingClientMetrics(input: unknown): Record<string, unknown> | null {
  const record = toRecord(input);
  const startedAt = toIsoDateString(record.onboarding_started_at ?? record.started_at);
  const submittedAt = toIsoDateString(record.onboarding_submitted_at ?? record.submitted_at);
  const explicitDurationMs = toDurationMs(record.onboarding_duration_ms ?? record.duration_ms);

  const derivedDurationMs =
    startedAt && submittedAt
      ? Math.max(0, Math.round(new Date(submittedAt).getTime() - new Date(startedAt).getTime()))
      : null;
  const durationMs = explicitDurationMs ?? derivedDurationMs;

  if (!startedAt && !submittedAt && durationMs === null) return null;

  const result: Record<string, unknown> = {};
  if (startedAt) result.started_at = startedAt;
  if (submittedAt) result.submitted_at = submittedAt;
  if (durationMs !== null) result.duration_ms = durationMs;
  return result;
}
