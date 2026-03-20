import type { ATSProvider } from "@/lib/ats/types";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrgATSConfigRow = {
  provider: ATSProvider;
  api_key: string | null;
  provider_settings: Record<string, unknown> | null;
  enabled: boolean;
};

export type ResolvedATSProviderConfig = {
  provider: ATSProvider;
  org_id: string;
  api_key: string | null;
  provider_settings: Record<string, unknown>;
  source: "db" | "env" | "dev_default";
};

export class ATSProviderResolutionError extends Error {
  code: "provider_not_configured" | "provider_conflict";

  constructor(code: "provider_not_configured" | "provider_conflict", message: string) {
    super(message);
    this.code = code;
  }
}

const isUuid = (value: string): boolean => UUID_PATTERN.test(value.trim());

const normalizeEnvValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const resolveFallbackProviderFromEnv = (orgId: string): ResolvedATSProviderConfig | null => {
  const greenhouseApiKey = normalizeEnvValue(process.env.GREENHOUSE_API_KEY);
  if (greenhouseApiKey) {
    return {
      provider: "greenhouse",
      org_id: orgId,
      api_key: greenhouseApiKey,
      provider_settings: {},
      source: "env",
    };
  }

  const leverApiKey = normalizeEnvValue(process.env.LEVER_API_KEY);
  if (leverApiKey) {
    return {
      provider: "lever",
      org_id: orgId,
      api_key: leverApiKey,
      provider_settings: {},
      source: "env",
    };
  }

  const bamboohrSubdomain = normalizeEnvValue(process.env.BAMBOOHR_SUBDOMAIN);
  if (bamboohrSubdomain) {
    return {
      provider: "bamboohr",
      org_id: orgId,
      api_key: null,
      provider_settings: { subdomain: bamboohrSubdomain },
      source: "env",
    };
  }

  if (process.env.NODE_ENV === "development") {
    return {
      provider: "greenhouse",
      org_id: orgId,
      api_key: null,
      provider_settings: {},
      source: "dev_default",
    };
  }

  return null;
};

export async function resolveATSProviderForOrg(orgId: string): Promise<ResolvedATSProviderConfig> {
  const normalizedOrgId = orgId.trim();

  if (isUuid(normalizedOrgId)) {
    const supabase = getSupabaseServiceRoleClient();
    if (supabase) {
      const { data, error } = (await supabase
        .from("org_ats_configs")
        .select("provider, api_key, provider_settings, enabled")
        .eq("org_id", normalizedOrgId)
        .eq("enabled", true)) as { data: OrgATSConfigRow[] | null; error: unknown };

      if (!error && data && data.length > 0) {
        if (data.length > 1) {
          throw new ATSProviderResolutionError(
            "provider_conflict",
            "Multiple ATS providers are enabled for this org"
          );
        }

        const row = data[0];
        return {
          provider: row.provider,
          org_id: normalizedOrgId,
          api_key: row.api_key,
          provider_settings: toRecord(row.provider_settings),
          source: "db",
        };
      }
    }
  }

  const fallback = resolveFallbackProviderFromEnv(normalizedOrgId);
  if (fallback) return fallback;

  throw new ATSProviderResolutionError("provider_not_configured", "No ATS provider configured");
}
