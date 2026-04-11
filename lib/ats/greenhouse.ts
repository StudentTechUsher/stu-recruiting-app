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
import { ATSProviderResolutionError, resolveATSProviderForOrg } from "./provider-config";

// ---------------------------------------------------------------------------
// Config lookup
// ---------------------------------------------------------------------------

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

type GreenhouseConfig = { apiKey: string; baseUrl: string };

export class GreenhouseNotConfiguredError extends Error {
  code = "greenhouse_not_configured" as const;

  constructor() {
    super("greenhouse_not_configured");
  }
}

function getGreenhouseEnvConfig(): GreenhouseConfig | null {
  const apiKey = normalizeEnvValue(process.env.GREENHOUSE_API_KEY);
  if (!apiKey) return null;
  return { apiKey, baseUrl: "https://harvest.greenhouse.io/v1" };
}

export async function getGreenhouseConfig(orgId: string): Promise<GreenhouseConfig | null> {
  const normalizedOrgId = orgId.trim();
  if (normalizedOrgId.length > 0) {
    try {
      const resolved = await resolveATSProviderForOrg(normalizedOrgId);
      if (resolved.provider === "greenhouse") {
        const apiKeyFromSettings =
          typeof resolved.provider_settings.api_key === "string"
            ? normalizeEnvValue(resolved.provider_settings.api_key)
            : null;
        const apiKey = normalizeEnvValue(resolved.api_key ?? undefined) ?? apiKeyFromSettings;
        if (!apiKey) return null;

        const configuredBaseUrl =
          typeof resolved.provider_settings.base_url === "string"
            ? normalizeEnvValue(resolved.provider_settings.base_url)
            : null;

        return {
          apiKey,
          baseUrl: configuredBaseUrl ?? "https://harvest.greenhouse.io/v1",
        };
      }
    } catch (error) {
      if (error instanceof ATSProviderResolutionError && error.code === "provider_conflict") throw error;
    }
  }

  return getGreenhouseEnvConfig();
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
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhousePipelineFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhousePipelineFromSqlite(opts);
}

export async function fetchGreenhouseJobs(
  orgId: string,
  opts: { page?: number }
): Promise<{ jobs: GreenhouseJobResult[]; total: number; page: number; has_more: boolean }> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobsFromApi(config, opts);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseJobsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobsFromSqlite(opts);
}

export async function fetchGreenhouseJob(
  orgId: string,
  id: string
): Promise<GreenhouseJobResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseJobFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobFromSqlite(id);
}

export async function fetchGreenhouseJobStages(
  orgId: string,
  jobId: string
): Promise<GreenhouseJobStageResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseJobStagesFromApi(config, jobId);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseJobStagesFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseJobStagesFromSqlite(jobId);
}

export async function fetchGreenhouseCandidates(
  orgId: string,
  opts: { page?: number }
): Promise<{ candidates: GreenhouseCandidateResult[]; total: number; page: number; has_more: boolean }> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCandidatesFromApi(config, opts);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseCandidatesFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCandidatesFromSqlite(opts);
}

export async function fetchGreenhouseCandidate(
  orgId: string,
  id: string
): Promise<GreenhouseCandidateResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCandidateFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseCandidateFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCandidateFromSqlite(id);
}

export async function fetchGreenhouseApplication(
  orgId: string,
  id: string
): Promise<NormalizedATSCandidate | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseApplicationFromApi(config, id);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseApplicationFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseApplicationFromSqlite(id);
}

export async function fetchGreenhouseScorecards(
  orgId: string,
  applicationId: string
): Promise<GreenhouseScorecardResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseScorecardsFromApi(config, applicationId);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseScorecardsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseScorecardsFromSqlite(applicationId);
}

export async function fetchGreenhouseCurrentOffer(
  orgId: string,
  applicationId: string
): Promise<GreenhouseOfferResult | null> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseCurrentOfferFromApi(config, applicationId);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseCurrentOfferFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseCurrentOfferFromSqlite(applicationId);
}

export async function fetchGreenhouseDepartments(
  orgId: string
): Promise<GreenhouseDepartmentResult[]> {
  const config = await getGreenhouseConfig(orgId);
  if (config) return fetchGreenhouseDepartmentsFromApi(config);
  if (!isSqliteFallbackAllowed()) throw new GreenhouseNotConfiguredError();
  const { fetchGreenhouseDepartmentsFromSqlite } = await import("./greenhouse-sqlite");
  return fetchGreenhouseDepartmentsFromSqlite();
}
