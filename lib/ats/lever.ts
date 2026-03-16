import type { ATSPipelineResult, NormalizedATSCandidate } from "./types";

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

function getLeverConfig() {
  const apiKey = normalizeEnvValue(process.env.LEVER_API_KEY);
  if (!apiKey) return null;
  return { apiKey, baseUrl: "https://api.lever.co/v1" };
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

export async function fetchLeverPipeline(opts: {
  postingId?: string;
  cursor?: string;
}): Promise<ATSPipelineResult> {
  const config = getLeverConfig();
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

export { getLeverConfig };
