import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServiceRoleClientMock } = vi.hoisted(() => ({
  getSupabaseServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

import {
  ATSProviderResolutionError,
  resolveATSProviderForOrg,
} from "@/lib/ats/provider-config";

describe("resolveATSProviderForOrg", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const envSnapshot = {
    GREENHOUSE_API_KEY: process.env.GREENHOUSE_API_KEY,
    LEVER_API_KEY: process.env.LEVER_API_KEY,
    BAMBOOHR_SUBDOMAIN: process.env.BAMBOOHR_SUBDOMAIN,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete mutableEnv.GREENHOUSE_API_KEY;
    delete mutableEnv.LEVER_API_KEY;
    delete mutableEnv.BAMBOOHR_SUBDOMAIN;
    mutableEnv.NODE_ENV = "test";
  });

  afterEach(() => {
    mutableEnv.GREENHOUSE_API_KEY = envSnapshot.GREENHOUSE_API_KEY;
    mutableEnv.LEVER_API_KEY = envSnapshot.LEVER_API_KEY;
    mutableEnv.BAMBOOHR_SUBDOMAIN = envSnapshot.BAMBOOHR_SUBDOMAIN;
    mutableEnv.NODE_ENV = envSnapshot.NODE_ENV;
  });

  it("returns DB provider config when one enabled provider exists", async () => {
    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  provider: "greenhouse",
                  api_key: "db-gh-key",
                  provider_settings: { base_url: "https://harvest.greenhouse.io/v1" },
                  enabled: true,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await resolveATSProviderForOrg("123e4567-e89b-12d3-a456-426614174000");
    expect(result.provider).toBe("greenhouse");
    expect(result.api_key).toBe("db-gh-key");
    expect(result.source).toBe("db");
  });

  it("throws provider_conflict for multiple enabled providers", async () => {
    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { provider: "greenhouse", api_key: "a", provider_settings: {}, enabled: true },
                { provider: "lever", api_key: "b", provider_settings: {}, enabled: true },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(
      resolveATSProviderForOrg("123e4567-e89b-12d3-a456-426614174000")
    ).rejects.toMatchObject({ code: "provider_conflict" } satisfies Partial<ATSProviderResolutionError>);
  });

  it("falls back to env config when DB has no enabled provider", async () => {
    process.env.GREENHOUSE_API_KEY = "env-gh-key";

    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await resolveATSProviderForOrg("123e4567-e89b-12d3-a456-426614174000");
    expect(result.provider).toBe("greenhouse");
    expect(result.source).toBe("env");
    expect(result.api_key).toBe("env-gh-key");
  });
});
