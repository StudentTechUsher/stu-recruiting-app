import type { ATSPipelineResult, NormalizedATSCandidate } from "./types";

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

function getGreenhouseConfig() {
  const apiKey = normalizeEnvValue(process.env.GREENHOUSE_API_KEY);
  if (!apiKey) return null;
  return { apiKey, baseUrl: "https://harvest.greenhouse.io/v1" };
}

type GreenhouseEmailAddress = {
  value: string;
  type: string;
};

type GreenhouseCandidate = {
  id: number;
  first_name: string;
  last_name: string;
  email_addresses: GreenhouseEmailAddress[];
  tags: string[];
};

type GreenhouseJob = {
  id: number;
  name: string;
};

type GreenhouseStage = {
  name: string;
};

type GreenhouseApplication = {
  id: number;
  candidate: GreenhouseCandidate;
  current_stage: GreenhouseStage | null;
  applied_at: string | null;
  jobs: GreenhouseJob[];
  status: string;
};

function normalizeApplication(app: GreenhouseApplication): NormalizedATSCandidate {
  const candidate = app.candidate;
  const job = app.jobs?.[0] ?? null;
  return {
    ats_id: String(app.id),
    ats_source: "greenhouse",
    full_name: `${candidate.first_name} ${candidate.last_name}`.trim(),
    email: candidate.email_addresses?.[0]?.value ?? null,
    current_stage: app.current_stage?.name ?? null,
    applied_at: app.applied_at ?? null,
    job_title: job?.name ?? null,
    job_id: job ? String(job.id) : null,
    status: app.status === "active" ? "active" : app.status === "rejected" ? "rejected" : app.status === "hired" ? "hired" : "other",
    profile_url: `https://app.greenhouse.io/people/${candidate.id}`,
    tags: candidate.tags ?? [],
    raw: app as unknown as Record<string, unknown>,
  };
}

export async function fetchGreenhousePipeline(opts: {
  jobId?: string;
  page?: number;
}): Promise<ATSPipelineResult> {
  const config = getGreenhouseConfig();
  if (!config) throw new Error("greenhouse_not_configured");

  const page = opts.page ?? 1;
  const params = new URLSearchParams({ status: "active", per_page: "100", page: String(page) });
  if (opts.jobId) params.set("job_id", opts.jobId);

  const url = `${config.baseUrl}/applications?${params}`;
  const auth = Buffer.from(`${config.apiKey}:`).toString("base64");

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`greenhouse_api_error: ${response.status}`);
  }

  const applications = (await response.json()) as GreenhouseApplication[];
  const candidates = applications.map(normalizeApplication);

  return {
    source: "greenhouse",
    candidates,
    total: candidates.length,
    page,
    has_more: applications.length === 100,
  };
}

export { getGreenhouseConfig };
