import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchGreenhousePipeline, getGreenhouseConfig } from "@/lib/ats/greenhouse";

const makeApplication = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  candidate: {
    id: 999,
    first_name: "Jane",
    last_name: "Doe",
    email_addresses: [{ value: "jane@example.com", type: "personal" }],
    tags: ["campus", "2026"],
  },
  current_stage: { name: "Phone Screen" },
  applied_at: "2026-01-15T10:00:00Z",
  jobs: [{ id: 42, name: "Software Engineer" }],
  status: "active",
  ...overrides,
});

describe("getGreenhouseConfig", () => {
  afterEach(() => {
    delete process.env.GREENHOUSE_API_KEY;
  });

  it("returns null when env var is missing", () => {
    delete process.env.GREENHOUSE_API_KEY;
    expect(getGreenhouseConfig()).toBeNull();
  });

  it("returns null when env var is blank", () => {
    process.env.GREENHOUSE_API_KEY = "   ";
    expect(getGreenhouseConfig()).toBeNull();
  });

  it("returns config when env var is set", () => {
    process.env.GREENHOUSE_API_KEY = "test-key";
    const config = getGreenhouseConfig();
    expect(config).not.toBeNull();
    expect(config?.apiKey).toBe("test-key");
    expect(config?.baseUrl).toBe("https://harvest.greenhouse.io/v1");
  });
});

describe("fetchGreenhousePipeline", () => {
  beforeEach(() => {
    process.env.GREENHOUSE_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GREENHOUSE_API_KEY;
    vi.restoreAllMocks();
  });

  it("throws when not configured", async () => {
    delete process.env.GREENHOUSE_API_KEY;
    await expect(fetchGreenhousePipeline({})).rejects.toThrow("greenhouse_not_configured");
  });

  it("normalizes a Greenhouse application into NormalizedATSCandidate", async () => {
    const app = makeApplication();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [app],
    }));

    const result = await fetchGreenhousePipeline({ page: 1 });

    expect(result.source).toBe("greenhouse");
    expect(result.page).toBe(1);
    expect(result.has_more).toBe(false);
    expect(result.candidates).toHaveLength(1);

    const candidate = result.candidates[0];
    expect(candidate.ats_id).toBe("101");
    expect(candidate.ats_source).toBe("greenhouse");
    expect(candidate.full_name).toBe("Jane Doe");
    expect(candidate.email).toBe("jane@example.com");
    expect(candidate.current_stage).toBe("Phone Screen");
    expect(candidate.applied_at).toBe("2026-01-15T10:00:00Z");
    expect(candidate.job_title).toBe("Software Engineer");
    expect(candidate.job_id).toBe("42");
    expect(candidate.status).toBe("active");
    expect(candidate.profile_url).toBe("https://app.greenhouse.io/people/999");
    expect(candidate.tags).toEqual(["campus", "2026"]);
  });

  it("maps rejected status correctly", async () => {
    const app = makeApplication({ status: "rejected" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [app],
    }));

    const result = await fetchGreenhousePipeline({});
    expect(result.candidates[0].status).toBe("rejected");
  });

  it("maps hired status correctly", async () => {
    const app = makeApplication({ status: "hired" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [app],
    }));

    const result = await fetchGreenhousePipeline({});
    expect(result.candidates[0].status).toBe("hired");
  });

  it("maps unknown status to 'other'", async () => {
    const app = makeApplication({ status: "converted" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [app],
    }));

    const result = await fetchGreenhousePipeline({});
    expect(result.candidates[0].status).toBe("other");
  });

  it("sets has_more=true when 100 results returned", async () => {
    const apps = Array.from({ length: 100 }, (_, i) => makeApplication({ id: i + 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => apps,
    }));

    const result = await fetchGreenhousePipeline({});
    expect(result.has_more).toBe(true);
  });

  it("passes job_id query param when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGreenhousePipeline({ jobId: "42" });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("job_id=42");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchGreenhousePipeline({})).rejects.toThrow("greenhouse_api_error");
  });
});
