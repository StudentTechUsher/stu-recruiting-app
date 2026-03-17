import type {
  ATSPipelineResult,
  GreenhouseJobResult,
  GreenhouseCandidateResult,
  GreenhouseScorecardResult,
  GreenhouseOfferResult,
  GreenhouseDepartmentResult,
  GreenhouseJobStageResult,
  NormalizedATSCandidate,
} from "./types";

type GreenhouseConfig = { apiKey: string; baseUrl: string };

function authHeader(config: GreenhouseConfig): string {
  return `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`;
}

async function ghFetch<T>(config: GreenhouseConfig, path: string): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: authHeader(config), Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`greenhouse_api_error: ${response.status}`);
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Raw Greenhouse API types
// ---------------------------------------------------------------------------

type GHEmailAddress = { value: string; type: string };
type GHCandidate = { id: number; first_name: string; last_name: string; email_addresses: GHEmailAddress[]; tags: string[] };
type GHJob = { id: number; name: string };
type GHStage = { name: string };
type GHApplication = { id: number; candidate: GHCandidate; current_stage: GHStage | null; applied_at: string | null; jobs: GHJob[]; status: string };
type GHJobFull = { id: number; name: string; status: string; departments: { name: string }[]; stages: { id: number; name: string }[] };
type GHCandidateFull = { id: number; first_name: string; last_name: string; email_addresses: GHEmailAddress[]; tags: string[]; applications: { id: number }[] };
type GHScorecard = { id: number; application_id: number; interviewer: { name: string }; submitted_at: string | null; overall_recommendation: string | null; attributes: { name: string; overall_rating: string | null }[] };
type GHOffer = { id: number; application_id: number; status: string; created_at: string; offer_letter: { filename: string } | null };
type GHDepartment = { id: number; name: string; parent_id: number | null };
type GHJobStage = { id: number; name: string };

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeApplication(app: GHApplication): NormalizedATSCandidate {
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

// ---------------------------------------------------------------------------
// Exported fetch functions
// ---------------------------------------------------------------------------

export async function fetchGreenhousePipelineFromApi(
  config: GreenhouseConfig,
  opts: { jobId?: string; page?: number }
): Promise<ATSPipelineResult> {
  const page = opts.page ?? 1;
  const params = new URLSearchParams({ status: "active", per_page: "100", page: String(page) });
  if (opts.jobId) params.set("job_id", opts.jobId);

  const applications = await ghFetch<GHApplication[]>(config, `/applications?${params}`);
  const candidates = applications.map(normalizeApplication);

  return {
    source: "greenhouse",
    candidates,
    total: candidates.length,
    page,
    has_more: applications.length === 100,
  };
}

export async function fetchGreenhouseJobsFromApi(
  config: GreenhouseConfig,
  opts: { page?: number }
): Promise<{ jobs: GreenhouseJobResult[]; total: number; page: number; has_more: boolean }> {
  const page = opts.page ?? 1;
  const params = new URLSearchParams({ per_page: "100", page: String(page) });
  const jobs = await ghFetch<GHJobFull[]>(config, `/jobs?${params}`);

  return {
    jobs: jobs.map((j) => ({
      id: String(j.id),
      name: j.name,
      status: (j.status ?? "open") as "open" | "closed" | "draft",
      departments: (j.departments ?? []).map((d) => d.name),
      stage_count: (j.stages ?? []).length,
    })),
    total: jobs.length,
    page,
    has_more: jobs.length === 100,
  };
}

export async function fetchGreenhouseJobFromApi(
  config: GreenhouseConfig,
  id: string
): Promise<GreenhouseJobResult | null> {
  const j = await ghFetch<GHJobFull>(config, `/jobs/${id}`);
  return {
    id: String(j.id),
    name: j.name,
    status: (j.status ?? "open") as "open" | "closed" | "draft",
    departments: (j.departments ?? []).map((d) => d.name),
    stage_count: (j.stages ?? []).length,
  };
}

export async function fetchGreenhouseJobStagesFromApi(
  config: GreenhouseConfig,
  jobId: string
): Promise<GreenhouseJobStageResult[]> {
  const stages = await ghFetch<GHJobStage[]>(config, `/jobs/${jobId}/stages`);
  return stages.map((s, i) => ({
    id: String(s.id),
    job_id: jobId,
    name: s.name,
    order: i + 1,
  }));
}

export async function fetchGreenhouseCandidatesFromApi(
  config: GreenhouseConfig,
  opts: { page?: number }
): Promise<{ candidates: GreenhouseCandidateResult[]; total: number; page: number; has_more: boolean }> {
  const page = opts.page ?? 1;
  const params = new URLSearchParams({ per_page: "100", page: String(page) });
  const candidates = await ghFetch<GHCandidateFull[]>(config, `/candidates?${params}`);

  return {
    candidates: candidates.map((c) => ({
      id: String(c.id),
      full_name: `${c.first_name} ${c.last_name}`.trim(),
      email: c.email_addresses?.[0]?.value ?? null,
      application_count: (c.applications ?? []).length,
      tags: c.tags ?? [],
    })),
    total: candidates.length,
    page,
    has_more: candidates.length === 100,
  };
}

export async function fetchGreenhouseCandidateFromApi(
  config: GreenhouseConfig,
  id: string
): Promise<GreenhouseCandidateResult | null> {
  const c = await ghFetch<GHCandidateFull>(config, `/candidates/${id}`);
  return {
    id: String(c.id),
    full_name: `${c.first_name} ${c.last_name}`.trim(),
    email: c.email_addresses?.[0]?.value ?? null,
    application_count: (c.applications ?? []).length,
    tags: c.tags ?? [],
  };
}

export async function fetchGreenhouseApplicationFromApi(
  config: GreenhouseConfig,
  id: string
): Promise<NormalizedATSCandidate | null> {
  const app = await ghFetch<GHApplication>(config, `/applications/${id}`);
  return normalizeApplication(app);
}

export async function fetchGreenhouseScorecardsFromApi(
  config: GreenhouseConfig,
  applicationId: string
): Promise<GreenhouseScorecardResult[]> {
  const scorecards = await ghFetch<GHScorecard[]>(config, `/applications/${applicationId}/scorecards`);
  return scorecards.map((s) => ({
    id: String(s.id),
    application_id: String(s.application_id),
    interviewer_name: s.interviewer?.name ?? "Unknown",
    submitted_at: s.submitted_at,
    recommendation: s.overall_recommendation,
    attributes: (s.attributes ?? []).map((a) => ({ name: a.name, rating: a.overall_rating })),
  }));
}

export async function fetchGreenhouseCurrentOfferFromApi(
  config: GreenhouseConfig,
  applicationId: string
): Promise<GreenhouseOfferResult | null> {
  const offers = await ghFetch<GHOffer[]>(config, `/applications/${applicationId}/offers`);
  if (!offers || offers.length === 0) return null;
  const current = offers[offers.length - 1];
  return {
    id: String(current.id),
    application_id: String(current.application_id),
    status: current.status,
    created_at: current.created_at,
    offer_letter_name: current.offer_letter?.filename ?? null,
  };
}

export async function fetchGreenhouseDepartmentsFromApi(
  config: GreenhouseConfig
): Promise<GreenhouseDepartmentResult[]> {
  const depts = await ghFetch<GHDepartment[]>(config, `/departments`);
  return depts.map((d) => ({
    id: String(d.id),
    name: d.name,
    parent_id: d.parent_id !== null ? String(d.parent_id) : null,
  }));
}
