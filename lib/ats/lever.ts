import type { ATSPipelineResult, NormalizedATSCandidate } from "./types";
import { ATSProviderResolutionError, resolveATSProviderForOrg } from "./provider-config";

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

type LeverConfig = { apiKey: string; baseUrl: string };

function getLeverEnvConfig(): LeverConfig | null {
  const apiKey = normalizeEnvValue(process.env.LEVER_API_KEY);
  if (!apiKey) return null;
  return { apiKey, baseUrl: "https://api.lever.co/v1" };
}

export function getLeverConfig(): LeverConfig | null {
  return getLeverEnvConfig();
}

async function resolveLeverConfig(orgId: string): Promise<LeverConfig | null> {
  const normalizedOrgId = orgId.trim();
  if (normalizedOrgId.length > 0) {
    try {
      const resolved = await resolveATSProviderForOrg(normalizedOrgId);
      if (resolved.provider !== "lever") return null;

      const keyFromSettings =
        typeof resolved.provider_settings.api_key === "string"
          ? normalizeEnvValue(resolved.provider_settings.api_key)
          : null;
      const apiKey = normalizeEnvValue(resolved.api_key ?? undefined) ?? keyFromSettings;
      if (!apiKey) return null;

      const configuredBaseUrl =
        typeof resolved.provider_settings.base_url === "string"
          ? normalizeEnvValue(resolved.provider_settings.base_url)
          : null;

      return {
        apiKey,
        baseUrl: configuredBaseUrl ?? "https://api.lever.co/v1",
      };
    } catch (error) {
      if (error instanceof ATSProviderResolutionError && error.code === "provider_conflict") throw error;
    }
  }

  return getLeverEnvConfig();
}

type LeverContact = {
  emails: string[];
};

type LeverPosting = {
  id: string;
  text: string;
};

type LeverApplication = {
  posting: LeverPosting;
};

type LeverStage = {
  text: string;
};

type LeverOpportunity = {
  id: string;
  name: string;
  contact: LeverContact | null;
  stage: LeverStage | null;
  createdAt: number;
  applications: LeverApplication[];
  state: string;
  tags: string[];
};

type LeverListResponse = {
  data: LeverOpportunity[];
  next?: string;
  hasNext?: boolean;
};

function normalizeOpportunity(opp: LeverOpportunity): NormalizedATSCandidate {
  const posting = opp.applications?.[0]?.posting ?? null;
  const stateMap: Record<string, NormalizedATSCandidate["status"]> = {
    lead: "active",
    hired: "hired",
    archived: "rejected",
  };
  return {
    ats_id: opp.id,
    ats_source: "lever",
    full_name: opp.name,
    email: opp.contact?.emails?.[0] ?? null,
    current_stage: opp.stage?.text ?? null,
    applied_at: new Date(opp.createdAt).toISOString(),
    job_title: posting?.text ?? null,
    job_id: posting?.id ?? null,
    status: stateMap[opp.state] ?? "other",
    profile_url: `https://hire.lever.co/candidates/${opp.id}`,
    tags: opp.tags ?? [],
    raw: opp as unknown as Record<string, unknown>,
  };
}

type FetchLeverPipelineArgs = {
  postingId?: string;
  cursor?: string;
};

export async function fetchLeverPipeline(
  orgIdOrOpts: string | FetchLeverPipelineArgs,
  maybeOpts?: FetchLeverPipelineArgs
): Promise<ATSPipelineResult> {
  const orgId = typeof orgIdOrOpts === "string" ? orgIdOrOpts : "";
  const opts = typeof orgIdOrOpts === "string" ? maybeOpts ?? {} : orgIdOrOpts;

  const config = await resolveLeverConfig(orgId);
  if (!config) throw new Error("lever_not_configured");

  const params = new URLSearchParams({ state: "active", limit: "100" });
  if (opts.postingId) params.set("posting_id", opts.postingId);
  if (opts.cursor) params.set("offset", opts.cursor);

  const url = `${config.baseUrl}/opportunities?${params}`;
  const auth = Buffer.from(`${config.apiKey}:`).toString("base64");

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`lever_api_error: ${response.status}`);
  }

  const body = (await response.json()) as LeverListResponse;
  const opportunities = body.data ?? [];
  const candidates = opportunities.map(normalizeOpportunity);

  return {
    source: "lever",
    candidates,
    total: candidates.length,
    page: 1,
    has_more: Boolean(body.hasNext ?? body.next),
  };
}
