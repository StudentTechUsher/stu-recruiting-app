import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listModelsGET, POST as createModelPOST } from "@/app/api/recruiter/capability-models/route";
import { GET as getModelGET } from "@/app/api/recruiter/capability-models/[modelId]/route";
import {
  GET as listVersionsGET,
  POST as createVersionPOST,
} from "@/app/api/recruiter/capability-models/[modelId]/versions/route";
import { POST as publishVersionPOST } from "@/app/api/recruiter/capability-models/[modelId]/versions/[versionId]/publish/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  listCapabilityModelsMock,
  createCapabilityModelMock,
  getCapabilityModelMock,
  createCapabilityModelVersionMock,
  publishCapabilityModelVersionMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  listCapabilityModelsMock: vi.fn(),
  createCapabilityModelMock: vi.fn(),
  getCapabilityModelMock: vi.fn(),
  createCapabilityModelVersionMock: vi.fn(),
  publishCapabilityModelVersionMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/recruiter/capability-models", () => ({
  listCapabilityModels: listCapabilityModelsMock,
  createCapabilityModel: createCapabilityModelMock,
  getCapabilityModel: getCapabilityModelMock,
  createCapabilityModelVersion: createCapabilityModelVersionMock,
  publishCapabilityModelVersion: publishCapabilityModelVersionMock,
}));

describe("recruiter capability model routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "recruiter-1",
      org_id: "org-1",
      persona: "recruiter",
      assignment_ids: [],
    });
    hasPersonaMock.mockReturnValue(true);
  });

  it("lists models", async () => {
    listCapabilityModelsMock.mockResolvedValue([
      {
        capability_model_id: "model-1",
        org_id: "org-1",
        model_name: "Core SWE",
        description: null,
        active_version_id: null,
        created_at: "2026-03-19T00:00:00.000Z",
        updated_at: "2026-03-19T00:00:00.000Z",
      },
    ]);

    const response = await listModelsGET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.models).toHaveLength(1);
    expect(listCapabilityModelsMock).toHaveBeenCalledWith("org-1");
  });

  it("validates model payload", async () => {
    const response = await createModelPOST(
      new Request("http://localhost/api/recruiter/capability-models", {
        method: "POST",
        body: JSON.stringify({ model_name: "Bad model" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "invalid_capability_model_payload" });
  });

  it("returns not found for model detail when missing", async () => {
    getCapabilityModelMock.mockResolvedValue({ model: null, versions: [] });

    const response = await getModelGET(new Request("http://localhost"), {
      params: Promise.resolve({ modelId: "model-missing" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "capability_model_not_found" });
  });

  it("creates and publishes versions", async () => {
    getCapabilityModelMock.mockResolvedValue({
      model: {
        capability_model_id: "model-1",
        org_id: "org-1",
        model_name: "Core SWE",
        description: null,
        active_version_id: null,
        created_at: "2026-03-19T00:00:00.000Z",
        updated_at: "2026-03-19T00:00:00.000Z",
      },
      versions: [],
    });
    createCapabilityModelVersionMock.mockResolvedValue({
      capability_model_version_id: "version-2",
      capability_model_id: "model-1",
      org_id: "org-1",
      version_number: 2,
      status: "draft",
      weights: { communication: 0.4 },
      thresholds: { recommended: 0.8 },
      required_evidence: [],
      notes: null,
      created_at: "2026-03-19T00:00:00.000Z",
      published_at: null,
    });
    publishCapabilityModelVersionMock.mockResolvedValue({
      capability_model_version_id: "version-2",
      capability_model_id: "model-1",
      org_id: "org-1",
      version_number: 2,
      status: "published",
      weights: { communication: 0.4 },
      thresholds: { recommended: 0.8 },
      required_evidence: [],
      notes: null,
      created_at: "2026-03-19T00:00:00.000Z",
      published_at: "2026-03-19T00:05:00.000Z",
    });

    const versionsResponse = await listVersionsGET(new Request("http://localhost"), {
      params: Promise.resolve({ modelId: "model-1" }),
    });
    const versionsPayload = await versionsResponse.json();
    expect(versionsResponse.status).toBe(200);
    expect(versionsPayload.ok).toBe(true);

    const createVersionResponse = await createVersionPOST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          weights: { communication: 0.4 },
          thresholds: { recommended: 0.8 },
          required_evidence: [],
        }),
      }),
      {
        params: Promise.resolve({ modelId: "model-1" }),
      }
    );
    const createVersionPayload = await createVersionResponse.json();

    expect(createVersionResponse.status).toBe(200);
    expect(createVersionPayload.ok).toBe(true);
    expect(createCapabilityModelVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", userId: "recruiter-1", modelId: "model-1" })
    );

    const publishResponse = await publishVersionPOST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ modelId: "model-1", versionId: "version-2" }),
    });
    const publishPayload = await publishResponse.json();

    expect(publishResponse.status).toBe(200);
    expect(publishPayload.ok).toBe(true);
    expect(publishCapabilityModelVersionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      modelId: "model-1",
      versionId: "version-2",
    });
  });
});
