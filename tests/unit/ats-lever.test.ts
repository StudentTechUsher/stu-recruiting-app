import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchLeverPipeline, getLeverConfig } from "@/lib/ats/lever";

const makeOpportunity = (overrides: Record<string, unknown> = {}) => ({
  id: "opp-abc-123",
  name: "John Smith",
  contact: { emails: ["john@example.com"] },
  stage: { text: "Initial Screen" },
  createdAt: 1736934000000, // 2026-01-15T09:00:00.000Z
  applications: [{ posting: { id: "post-1", text: "Backend Engineer" } }],
  state: "lead",
  tags: ["priority", "referral"],
  ...overrides,
});

describe("getLeverConfig", () => {
  afterEach(() => {
    delete process.env.LEVER_API_KEY;
  });

  it("returns null when env var is missing", () => {
    delete process.env.LEVER_API_KEY;
    expect(getLeverConfig()).toBeNull();
  });

  it("returns null when env var is blank", () => {
    process.env.LEVER_API_KEY = "  ";
    expect(getLeverConfig()).toBeNull();
  });

  it("returns config when env var is set", () => {
    process.env.LEVER_API_KEY = "lever-key";
    const config = getLeverConfig();
    expect(config).not.toBeNull();
    expect(config?.apiKey).toBe("lever-key");
    expect(config?.baseUrl).toBe("https://api.lever.co/v1");
  });
});

describe("fetchLeverPipeline", () => {
  beforeEach(() => {
    process.env.LEVER_API_KEY = "lever-key";
  });

  afterEach(() => {
    delete process.env.LEVER_API_KEY;
    vi.restoreAllMocks();
  });

  it("throws when not configured", async () => {
    delete process.env.LEVER_API_KEY;
    await expect(fetchLeverPipeline({})).rejects.toThrow("lever_not_configured");
  });

  it("normalizes a Lever opportunity into NormalizedATSCandidate", async () => {
    const opp = makeOpportunity();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [opp], hasNext: false }),
    }));

    const result = await fetchLeverPipeline({});

    expect(result.source).toBe("lever");
    expect(result.page).toBe(1);
    expect(result.has_more).toBe(false);
    expect(result.candidates).toHaveLength(1);

    const candidate = result.candidates[0];
    expect(candidate.ats_id).toBe("opp-abc-123");
    expect(candidate.ats_source).toBe("lever");
    expect(candidate.full_name).toBe("John Smith");
    expect(candidate.email).toBe("john@example.com");
    expect(candidate.current_stage).toBe("Initial Screen");
    expect(candidate.applied_at).toBe(new Date(1736934000000).toISOString());
    expect(candidate.job_title).toBe("Backend Engineer");
    expect(candidate.job_id).toBe("post-1");
    expect(candidate.status).toBe("active");
    expect(candidate.profile_url).toBe("https://hire.lever.co/candidates/opp-abc-123");
    expect(candidate.tags).toEqual(["priority", "referral"]);
  });

  it("maps 'hired' state to 'hired' status", async () => {
    const opp = makeOpportunity({ state: "hired" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [opp] }),
    }));

    const result = await fetchLeverPipeline({});
    expect(result.candidates[0].status).toBe("hired");
  });

  it("maps 'archived' state to 'rejected' status", async () => {
    const opp = makeOpportunity({ state: "archived" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [opp] }),
    }));

    const result = await fetchLeverPipeline({});
    expect(result.candidates[0].status).toBe("rejected");
  });

  it("maps unknown state to 'other' status", async () => {
    const opp = makeOpportunity({ state: "interview" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [opp] }),
    }));

    const result = await fetchLeverPipeline({});
    expect(result.candidates[0].status).toBe("other");
  });

  it("sets has_more=true when next cursor present", async () => {
    const opp = makeOpportunity();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [opp], next: "cursor-xyz", hasNext: true }),
    }));

    const result = await fetchLeverPipeline({});
    expect(result.has_more).toBe(true);
  });

  it("passes posting_id query param when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchLeverPipeline({ postingId: "post-1" });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("posting_id=post-1");
  });

  it("passes cursor as offset param when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchLeverPipeline({ cursor: "cursor-abc" });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("offset=cursor-abc");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchLeverPipeline({})).rejects.toThrow("lever_api_error");
  });
});
