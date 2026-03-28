import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/artifacts/transcripts/route";

const { getAuthContextMock, hasPersonaMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

const buildSupabaseMock = () => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const artifactSingleMock = vi.fn().mockResolvedValue({
    data: {
      artifact_id: "artifact-1",
      artifact_data: { status: "uploaded" },
      file_refs: [],
      source_provenance: {},
      source_object_id: "student-artifacts-private:file.pdf",
      ingestion_run_id: "2026-03-28T00:00:00.000Z",
    },
    error: null,
  });
  const artifactSelectMock = vi.fn().mockReturnValue({ single: artifactSingleMock });
  const artifactInsertMock = vi.fn().mockReturnValue({ select: artifactSelectMock });

  const artifactUpdateEqProfileMock = vi.fn().mockResolvedValue({ error: null });
  const artifactUpdateEqIdMock = vi.fn().mockReturnValue({ eq: artifactUpdateEqProfileMock });
  const artifactUpdateMock = vi.fn().mockReturnValue({ eq: artifactUpdateEqIdMock });

  const artifactDeleteEqProfileMock = vi.fn().mockResolvedValue({ error: null });
  const artifactDeleteEqIdMock = vi.fn().mockReturnValue({ eq: artifactDeleteEqProfileMock });
  const artifactDeleteMock = vi.fn().mockReturnValue({ eq: artifactDeleteEqIdMock });

  const artifactVersionSelectMock = vi.fn().mockResolvedValue({ data: [{ version_id: "version-1" }], error: null });
  const artifactVersionInsertMock = vi.fn().mockReturnValue({ select: artifactVersionSelectMock });

  const transcriptSessionSingleMock = vi.fn().mockResolvedValue({
    data: {
      session_id: "session-1",
      status: "uploaded",
      parser_model: "gpt-5-mini",
      parse_summary: { course_count: 0 },
      parse_error: null,
      transcript_artifact_id: "artifact-1",
      created_at: "2026-03-28T00:00:00.000Z",
      updated_at: "2026-03-28T00:00:00.000Z",
    },
    error: null,
  });
  const transcriptSessionSelectMock = vi.fn().mockReturnValue({ single: transcriptSessionSingleMock });
  const transcriptSessionInsertMock = vi.fn().mockReturnValue({ select: transcriptSessionSelectMock });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "artifacts") {
      return {
        insert: artifactInsertMock,
        update: artifactUpdateMock,
        delete: artifactDeleteMock,
      };
    }
    if (table === "artifact_versions") {
      return {
        insert: artifactVersionInsertMock,
      };
    }
    if (table === "transcript_parse_sessions") {
      return {
        insert: transcriptSessionInsertMock,
      };
    }
    return {};
  });

  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: uploadMock,
      }),
    },
    from: fromMock,
  };
};

describe("student transcript upload route observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      org_id: "org-1",
      persona: "student",
      assignment_ids: [],
    });
    hasPersonaMock.mockReturnValue(true);
  });

  it("emits success metric when transcript upload intake completes", async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock());
    const form = new FormData();
    form.set("transcript", new File(["pdf-content"], "transcript.pdf", { type: "application/pdf" }));

    const response = await POST(
      new Request("http://localhost/api/student/artifacts/transcripts", {
        method: "POST",
        body: form,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("emits handled failure metric when transcript file is missing", async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock());
    const form = new FormData();

    const response = await POST(
      new Request("http://localhost/api/student/artifacts/transcripts", {
        method: "POST",
        body: form,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "transcript_file_required" });
  });
});
