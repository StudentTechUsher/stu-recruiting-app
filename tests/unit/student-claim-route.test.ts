import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/student/claim/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getSupabaseServiceRoleClientMock,
  createSupabaseCandidateIdentityStoreMock,
  claimCandidateProfileMock,
  claimCandidateByEmailMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServiceRoleClientMock: vi.fn(),
  createSupabaseCandidateIdentityStoreMock: vi.fn(),
  claimCandidateProfileMock: vi.fn(),
  claimCandidateByEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

vi.mock("@/lib/candidates/identity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/candidates/identity")>("@/lib/candidates/identity");
  return {
    ...actual,
    createSupabaseCandidateIdentityStore: createSupabaseCandidateIdentityStoreMock,
    claimCandidateProfile: claimCandidateProfileMock,
    claimCandidateByEmail: claimCandidateByEmailMock,
  };
});

const claimedResult = {
  candidate: {
    candidate_id: "cand-1",
    claimed: true,
    claimed_at: "2026-03-24T00:00:00.000Z",
    canonical_profile_id: "profile-1",
  },
  canonicalVariant: {
    variant_id: "var-1",
    ownership: "candidate",
    state: "active",
  },
};

describe("student claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "profile-1",
      org_id: "org-1",
      persona: "student",
      assignment_ids: [],
      profile: {
        personal_info: {
          email: "student@school.edu",
        },
      },
    });
    hasPersonaMock.mockReturnValue(true);
    getSupabaseServiceRoleClientMock.mockReturnValue({});
    createSupabaseCandidateIdentityStoreMock.mockReturnValue({});
    claimCandidateProfileMock.mockResolvedValue(claimedResult);
    claimCandidateByEmailMock.mockResolvedValue(claimedResult);
  });

  it("returns forbidden when persona is not student", async () => {
    hasPersonaMock.mockReturnValue(false);

    const response = await POST(new Request("http://localhost/api/student/claim", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ ok: false, error: "forbidden" });
  });

  it("claims by candidate_id when provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/student/claim", {
        method: "POST",
        body: JSON.stringify({ candidate_id: "cand-1" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(claimCandidateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: "cand-1",
        canonicalProfileId: "profile-1",
      })
    );
  });

  it("claims by email fallback when candidate_id is not provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/student/claim", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(claimCandidateByEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "student@school.edu",
        canonicalProfileId: "profile-1",
      })
    );
  });

  it("returns bad request when neither candidate_id nor email is available", async () => {
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "profile-1",
      org_id: "org-1",
      persona: "student",
      assignment_ids: [],
      profile: {
        personal_info: {},
      },
    });

    const response = await POST(
      new Request("http://localhost/api/student/claim", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "candidate_id_or_email_required" });
  });
});
