import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthContextMock,
  hasPersonaMock,
  consumeAIFeatureQuotaMock,
  getSupabaseServerClientMock,
  getConnectionsBaselineMock,
  callOpenAINetworkingSuggestionMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  consumeAIFeatureQuotaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  getConnectionsBaselineMock: vi.fn(),
  callOpenAINetworkingSuggestionMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/ai/feature-quota", () => ({
  consumeAIFeatureQuota: consumeAIFeatureQuotaMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("@/lib/networking/connections", () => ({
  getConnectionsBaseline: getConnectionsBaselineMock,
}));

vi.mock("@/lib/networking/openai", async () => {
  const actual = await vi.importActual("@/lib/networking/openai");
  return {
    ...actual,
    callOpenAINetworkingSuggestion: callOpenAINetworkingSuggestionMock,
  };
});

vi.mock("@/lib/observability/api", () => ({
  createApiObsContext: vi.fn(() => ({
    requestId: "req-1",
    routeTemplate: "/api/student/networking-coach/suggestion",
    method: "POST",
    component: "student_networking_coach",
    operation: "generate_suggestion",
    startedAtMs: Date.now(),
    recordStart: vi.fn(),
    recordResult: vi.fn(),
    recordUnexpected: vi.fn(() => undefined),
  })),
  attachRequestIdHeader: vi.fn((response: Response, requestId: string) => {
    response.headers.set("x-request-id", requestId);
  }),
  toActorSurrogate: vi.fn(() => "actor-1"),
}));

import { POST } from "@/app/api/student/networking-coach/suggestion/route";
import { OpenAINetworkingError } from "@/lib/networking/openai";

const buildSupabaseMock = ({
  studentData,
  shareSlug = "jane-doe",
  artifacts = [],
}: {
  studentData: Record<string, unknown>;
  shareSlug?: string;
  artifacts?: Array<{
    artifact_id: string;
    artifact_type: string;
    artifact_data: unknown;
    updated_at: string | null;
    is_active: boolean | null;
  }>;
}) => {
  const shareLimitMock = vi.fn().mockResolvedValue({ data: shareSlug ? [{ share_slug: shareSlug }] : [] });
  const shareEqMock = vi.fn().mockReturnValue({ limit: shareLimitMock });
  const shareSelectMock = vi.fn().mockReturnValue({ eq: shareEqMock });
  const shareUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const studentsLimitMock = vi.fn().mockResolvedValue({ data: [{ student_data: studentData }] });
  const studentsEqMock = vi.fn().mockReturnValue({ limit: studentsLimitMock });
  const studentsSelectMock = vi.fn().mockReturnValue({ eq: studentsEqMock });

  const artifactsOrderMock = vi.fn().mockResolvedValue({ data: artifacts });
  const artifactsEqMock = vi.fn().mockReturnValue({ order: artifactsOrderMock });
  const artifactsSelectMock = vi.fn().mockReturnValue({ eq: artifactsEqMock });

  const fromMock = vi.fn((table: string) => {
    if (table === "students") return { select: studentsSelectMock };
    if (table === "artifacts") return { select: artifactsSelectMock };
    if (table === "student_share_links") return { select: shareSelectMock, upsert: shareUpsertMock };
    throw new Error(`unexpected_table_${table}`);
  });

  return { from: fromMock };
};

describe("student networking coach suggestion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      org_id: "org-1",
      persona: "student",
      profile: { personal_info: {} },
    });
    hasPersonaMock.mockReturnValue(true);
    consumeAIFeatureQuotaMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      maxUses: 5,
    });
    getConnectionsBaselineMock.mockResolvedValue([
      {
        name: "Avery Mentor",
        headline: "Software Engineer at Adobe",
        url: "https://www.linkedin.com/in/avery-mentor",
      },
      {
        name: "Blair Mentor",
        headline: "Data Analyst at Example",
        url: "https://www.linkedin.com/in/blair-mentor",
      },
    ]);
    getSupabaseServerClientMock.mockResolvedValue(
      buildSupabaseMock({
        studentData: {
          active_capability_profiles: [
            {
              capability_profile_id: "cp-1",
              company_id: "company-1",
              company_label: "Adobe",
              role_id: "role-1",
              role_label: "Software Engineer",
              selected_at: "2026-04-01T00:00:00.000Z",
              selection_source: "manual",
              status: "active",
            },
          ],
        },
        artifacts: [
          {
            artifact_id: "a-1",
            artifact_type: "project",
            artifact_data: {
              title: "Adobe systems project",
              source: "GitHub",
              description: "Software engineer delivery",
              verification_status: "verified",
            },
            updated_at: "2026-04-01T00:00:00.000Z",
            is_active: true,
          },
        ],
      })
    );
  });

  it("returns openai result with canonical /u path", async () => {
    callOpenAINetworkingSuggestionMock.mockResolvedValue({
      model: "gpt-5-mini",
      payload: {
        selected_url: "https://www.linkedin.com/in/avery-mentor",
        rationale: "Strong role/company alignment.",
        invite_message: "Hi Avery, would love to connect.",
        follow_up_message: "Thanks for connecting. Profile: https://app.example.com/u/jane-doe",
      },
    });

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh: false }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.generation.source).toBe("openai");
    expect(payload.data.messages.public_profile_path).toBe("/u/jane-doe");
    expect(payload.data.messages.public_profile_url).toBe("https://app.example.com/u/jane-doe");
  });

  it("returns fallback result when openai times out", async () => {
    callOpenAINetworkingSuggestionMock.mockRejectedValue(
      new OpenAINetworkingError("openai_timeout", "OpenAI request timed out.")
    );

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh: false }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.generation.source).toBe("fallback");
    expect(payload.data.generation.fallback_reason).toBe("openai_timeout");
  });

  it("returns fallback when selected url is outside pool", async () => {
    callOpenAINetworkingSuggestionMock.mockResolvedValue({
      model: "gpt-5-mini",
      payload: {
        selected_url: "https://www.linkedin.com/in/not-in-pool",
        rationale: "bad",
        invite_message: "Invite",
        follow_up_message: "Follow up",
      },
    });

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh: false }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.generation.source).toBe("fallback");
    expect(payload.data.generation.fallback_reason).toBe("openai_selected_url_not_in_pool");
  });

  it("returns quota error when ai quota is exceeded", async () => {
    consumeAIFeatureQuotaMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      maxUses: 5,
    });

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
      })
    );

    expect(response.status).toBe(429);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("ai_feature_quota_exceeded");
  });

  it("returns bad request for missing active targets", async () => {
    getSupabaseServerClientMock.mockResolvedValue(
      buildSupabaseMock({
        studentData: { active_capability_profiles: [] },
      })
    );

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("no_active_targets");
  });

  it("returns 503 when connections baseline is unavailable", async () => {
    getConnectionsBaselineMock.mockResolvedValue(null);

    const response = await POST(
      new Request("https://app.example.com/api/student/networking-coach/suggestion", {
        method: "POST",
      })
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toBe("connections_baseline_unavailable");
  });
});

