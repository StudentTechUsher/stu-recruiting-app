import "server-only";
import { getDevDb } from "./greenhouse-db";
import type {
  ATSPipelineResult,
  GreenhouseJobResult,
  GreenhouseCandidateResult,
  GreenhouseScorecardResult,
  GreenhouseOfferResult,
  GreenhouseDepartmentResult,
  GreenhouseJobStageResult,
} from "./types";
import type { NormalizedATSCandidate } from "./types";

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function fetchGreenhouseJobsFromSqlite(opts: { page?: number }): {
  jobs: GreenhouseJobResult[];
  total: number;
  page: number;
  has_more: boolean;
} {
  const db = getDevDb();
  const page = opts.page ?? 1;
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const rows = db
    .prepare(
      `SELECT j.id, j.name, j.status, j.department_id,
              d.name as dept_name,
              (SELECT COUNT(*) FROM gh_job_stages s WHERE s.job_id = j.id) as stage_count
       FROM gh_jobs j
       LEFT JOIN gh_departments d ON d.id = j.department_id
       ORDER BY j.id
       LIMIT ? OFFSET ?`
    )
    .all(perPage + 1, offset) as {
    id: number;
    name: string;
    status: string;
    dept_name: string | null;
    stage_count: number;
  }[];

  const has_more = rows.length > perPage;
  const slice = rows.slice(0, perPage);

  const jobs: GreenhouseJobResult[] = slice.map((r) => ({
    id: String(r.id),
    name: r.name,
    status: r.status as "open" | "closed" | "draft",
    departments: r.dept_name ? [r.dept_name] : [],
    stage_count: r.stage_count,
  }));

  const total = (db.prepare("SELECT COUNT(*) as c FROM gh_jobs").get() as { c: number }).c;

  return { jobs, total, page, has_more };
}

export function fetchGreenhouseJobFromSqlite(id: string): GreenhouseJobResult | null {
  const db = getDevDb();
  const row = db
    .prepare(
      `SELECT j.id, j.name, j.status,
              d.name as dept_name,
              (SELECT COUNT(*) FROM gh_job_stages s WHERE s.job_id = j.id) as stage_count
       FROM gh_jobs j
       LEFT JOIN gh_departments d ON d.id = j.department_id
       WHERE j.id = ?`
    )
    .get(Number(id)) as { id: number; name: string; status: string; dept_name: string | null; stage_count: number } | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    status: row.status as "open" | "closed" | "draft",
    departments: row.dept_name ? [row.dept_name] : [],
    stage_count: row.stage_count,
  };
}

export function fetchGreenhouseJobStagesFromSqlite(jobId: string): GreenhouseJobStageResult[] {
  const db = getDevDb();
  const rows = db
    .prepare('SELECT id, job_id, name, "order" FROM gh_job_stages WHERE job_id = ? ORDER BY "order"')
    .all(Number(jobId)) as { id: number; job_id: number; name: string; order: number }[];

  return rows.map((r) => ({
    id: String(r.id),
    job_id: String(r.job_id),
    name: r.name,
    order: r.order,
  }));
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export function fetchGreenhouseCandidatesFromSqlite(opts: { page?: number }): {
  candidates: GreenhouseCandidateResult[];
  total: number;
  page: number;
  has_more: boolean;
} {
  const db = getDevDb();
  const page = opts.page ?? 1;
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const rows = db
    .prepare(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.tags,
              COUNT(a.id) as application_count
       FROM gh_candidates c
       LEFT JOIN gh_applications a ON a.candidate_id = c.id
       GROUP BY c.id
       ORDER BY c.id
       LIMIT ? OFFSET ?`
    )
    .all(perPage + 1, offset) as {
    id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    tags: string;
    application_count: number;
  }[];

  const has_more = rows.length > perPage;
  const slice = rows.slice(0, perPage);
  const total = (db.prepare("SELECT COUNT(*) as c FROM gh_candidates").get() as { c: number }).c;

  const candidates: GreenhouseCandidateResult[] = slice.map((r) => ({
    id: String(r.id),
    full_name: `${r.first_name} ${r.last_name}`.trim(),
    email: r.email,
    application_count: r.application_count,
    tags: JSON.parse(r.tags) as string[],
  }));

  return { candidates, total, page, has_more };
}

export function fetchGreenhouseCandidateFromSqlite(id: string): GreenhouseCandidateResult | null {
  const db = getDevDb();
  const row = db
    .prepare(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.tags,
              COUNT(a.id) as application_count
       FROM gh_candidates c
       LEFT JOIN gh_applications a ON a.candidate_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`
    )
    .get(Number(id)) as { id: number; first_name: string; last_name: string; email: string | null; tags: string; application_count: number } | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    full_name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    application_count: row.application_count,
    tags: JSON.parse(row.tags) as string[],
  };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

type AppRow = {
  id: number;
  candidate_id: number;
  job_id: number;
  stage_id: number | null;
  status: string;
  applied_at: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  tags: string;
  job_name: string | null;
  stage_name: string | null;
};

function normalizeAppRow(r: AppRow): NormalizedATSCandidate {
  return {
    ats_id: String(r.id),
    ats_source: "greenhouse",
    full_name: `${r.first_name} ${r.last_name}`.trim(),
    email: r.email,
    current_stage: r.stage_name,
    applied_at: r.applied_at,
    job_title: r.job_name,
    job_id: String(r.job_id),
    status: r.status === "active" ? "active" : r.status === "rejected" ? "rejected" : r.status === "hired" ? "hired" : "other",
    profile_url: `https://app.greenhouse.io/people/${r.candidate_id}`,
    tags: JSON.parse(r.tags) as string[],
    raw: {
      ...r,
      source: "greenhouse_sqlite_dev",
    } as unknown as Record<string, unknown>,
  };
}

const APP_JOIN_SELECT = `
  SELECT a.id, a.candidate_id, a.job_id, a.stage_id, a.status, a.applied_at,
         c.first_name, c.last_name, c.email, c.tags,
         j.name as job_name,
         s.name as stage_name
  FROM gh_applications a
  JOIN gh_candidates c ON c.id = a.candidate_id
  JOIN gh_jobs j ON j.id = a.job_id
  LEFT JOIN gh_job_stages s ON s.id = a.stage_id
`;

export function fetchGreenhousePipelineFromSqlite(opts: { jobId?: string; page?: number }): ATSPipelineResult {
  const db = getDevDb();
  const page = opts.page ?? 1;
  const perPage = 100;
  const offset = (page - 1) * perPage;

  let query = APP_JOIN_SELECT + " WHERE a.status = 'active'";
  const params: (string | number)[] = [];

  if (opts.jobId) {
    query += " AND a.job_id = ?";
    params.push(Number(opts.jobId));
  }

  query += " ORDER BY a.applied_at DESC LIMIT ? OFFSET ?";
  params.push(perPage + 1, offset);

  const rows = db.prepare(query).all(...params) as AppRow[];
  const has_more = rows.length > perPage;
  const slice = rows.slice(0, perPage);

  return {
    source: "greenhouse",
    candidates: slice.map(normalizeAppRow),
    total: slice.length,
    page,
    has_more,
  };
}

export function fetchGreenhouseApplicationFromSqlite(id: string): NormalizedATSCandidate | null {
  const db = getDevDb();
  const row = db.prepare(APP_JOIN_SELECT + " WHERE a.id = ?").get(Number(id)) as AppRow | undefined;
  if (!row) return null;
  return normalizeAppRow(row);
}

// ---------------------------------------------------------------------------
// Scorecards
// ---------------------------------------------------------------------------

export function fetchGreenhouseScorecardsFromSqlite(applicationId: string): GreenhouseScorecardResult[] {
  const db = getDevDb();
  const rows = db
    .prepare(
      `SELECT id, application_id, interviewer_name, submitted_at, recommendation, attributes
       FROM gh_scorecards WHERE application_id = ?`
    )
    .all(Number(applicationId)) as {
    id: number;
    application_id: number;
    interviewer_name: string;
    submitted_at: string | null;
    recommendation: string | null;
    attributes: string;
  }[];

  return rows.map((r) => ({
    id: String(r.id),
    application_id: String(r.application_id),
    interviewer_name: r.interviewer_name,
    submitted_at: r.submitted_at,
    recommendation: r.recommendation,
    attributes: JSON.parse(r.attributes) as { name: string; rating: string | null }[],
  }));
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export function fetchGreenhouseCurrentOfferFromSqlite(applicationId: string): GreenhouseOfferResult | null {
  const db = getDevDb();
  const row = db
    .prepare(
      `SELECT id, application_id, status, created_at, offer_letter_name
       FROM gh_offers WHERE application_id = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(Number(applicationId)) as {
    id: number;
    application_id: number;
    status: string;
    created_at: string;
    offer_letter_name: string | null;
  } | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    status: row.status,
    created_at: row.created_at,
    offer_letter_name: row.offer_letter_name,
  };
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export function fetchGreenhouseDepartmentsFromSqlite(): GreenhouseDepartmentResult[] {
  const db = getDevDb();
  const rows = db
    .prepare("SELECT id, name, parent_id FROM gh_departments ORDER BY id")
    .all() as { id: number; name: string; parent_id: number | null }[];

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    parent_id: r.parent_id !== null ? String(r.parent_id) : null,
  }));
}
