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
import {
  fetchGreenhousePipelineFromApi,
  fetchGreenhouseJobsFromApi,
  fetchGreenhouseJobFromApi,
  fetchGreenhouseJobStagesFromApi,
  fetchGreenhouseCandidatesFromApi,
  fetchGreenhouseCandidateFromApi,
  fetchGreenhouseApplicationFromApi,
  fetchGreenhouseScorecardsFromApi,
  fetchGreenhouseCurrentOfferFromApi,
  fetchGreenhouseDepartmentsFromApi,
} from "./greenhouse-client";

// ---------------------------------------------------------------------------
// Config lookup
// ---------------------------------------------------------------------------

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

type GreenhouseConfig = { apiKey: string; baseUrl: string };

export async function getGreenhouseConfig(orgId: string): Promise<GreenhouseConfig | null> {
  // Try DB first (org-specific key)
  if (orgId) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (url && serviceKey) {
        const supabase = createClient(url, serviceKey);
        const { data } = await supabase
          .from("org_ats_configs")
          .select("api_key")
          .eq("org_id", orgId)
          .eq("provider", "greenhouse")
          .eq("enabled", true)
          .maybeSingle();

        if (data?.api_key) {
          return { apiKey: data.api_key, baseUrl: "https://harvest.greenhouse.io/v1" };
        }
      }
    } catch {
      // Fall through to env var check
    }
  }

  // Fallback: env var (dev convenience)
  const apiKey = normalizeEnvValue(process.env.GREENHOUSE_API_KEY);
  if (apiKey) return { apiKey, baseUrl: "https://harvest.greenhouse.io/v1" };

  return null;
}

// ---------------------------------------------------------------------------
// Fallback helper
// ---------------------------------------------------------------------------

function isSqliteFallbackAllowed(): boolean {
  return process.env.NODE_ENV === "development";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchGreenhousePipeline(
  orgId: string,
  opts: { jobId?: string; page?: number }
): Promise<ATSPipelineResult> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhousePipelineFromApi(config, opts);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhousePipelineFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhousePipelineFromSqlite(opts);
}

export async function fetchGreenhouseJobs(
  orgId: string,
  opts: { page?: number }
): Promise<{ jobs: GreenhouseJobResult[]; total: number; page: number; has_more: boolean }> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobsFromApi(config, opts);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseJobsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobsFromSqlite(opts);
}

export async function fetchGreenhouseJob(
  orgId: string,
  id: string
): Promise<GreenhouseJobResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseJobFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobFromSqlite(id);
}

export async function fetchGreenhouseJobStages(
  orgId: string,
  jobId: string
): Promise<GreenhouseJobStageResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobStagesFromApi(config, jobId);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseJobStagesFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobStagesFromSqlite(jobId);
}

export async function fetchGreenhouseCandidates(
  orgId: string,
  opts: { page?: number }
): Promise<{ candidates: GreenhouseCandidateResult[]; total: number; page: number; has_more: boolean }> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCandidatesFromApi(config, opts);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseCandidatesFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCandidatesFromSqlite(opts);
}

export async function fetchGreenhouseCandidate(
  orgId: string,
  id: string
): Promise<GreenhouseCandidateResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCandidateFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseCandidateFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCandidateFromSqlite(id);
}

export async function fetchGreenhouseApplication(
  orgId: string,
  id: string
): Promise<NormalizedATSCandidate | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseApplicationFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseApplicationFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseApplicationFromSqlite(id);
}

export async function fetchGreenhouseScorecards(
  orgId: string,
  applicationId: string
): Promise<GreenhouseScorecardResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseScorecardsFromApi(config, applicationId);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseScorecardsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseScorecardsFromSqlite(applicationId);
}

export async function fetchGreenhouseCurrentOffer(
  orgId: string,
  applicationId: string
): Promise<GreenhouseOfferResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCurrentOfferFromApi(config, applicationId);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseCurrentOfferFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCurrentOfferFromSqlite(applicationId);
}

export async function fetchGreenhouseDepartments(
  orgId: string
): Promise<GreenhouseDepartmentResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseDepartmentsFromApi(config);
  if (!isSqliteFallbackAllowed()) throw new Error("greenhouse_not_configured");
  const { fetchGreenhouseDepartmentsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseDepartmentsFromSqlite();
}
