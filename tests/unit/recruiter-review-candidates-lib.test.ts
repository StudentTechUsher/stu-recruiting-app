import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedATSCandidate } from "@/lib/ats/types";
import {
  getRecruiterReviewCandidateEvidence,
  listRecruiterReviewCandidates,
  resetReviewCandidateContextCacheForTests,
} from "@/lib/recruiter/review-candidates";

const {
  fetchATSPipelineForOrgMock,
  getSupabaseServiceRoleClientMock,
  createSupabaseCandidateIdentityStoreMock,
  resolveCandidateForIngestionMock,
  linkCandidateApplicationMock,
} = vi.hoisted(() => ({
  fetchATSPipelineForOrgMock: vi.fn(),
  getSupabaseServiceRoleClientMock: vi.fn(),
  createSupabaseCandidateIdentityStoreMock: vi.fn(),
  resolveCandidateForIngestionMock: vi.fn(),
  linkCandidateApplicationMock: vi.fn(),
}));

vi.mock("@/lib/ats/provider-pipeline", () => ({
  fetchATSPipelineForOrg: fetchATSPipelineForOrgMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRoleClient: getSupabaseServiceRoleClientMock,
}));

vi.mock("@/lib/candidates/identity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/candidates/identity")>(
    "@/lib/candidates/identity"
  );

  return {
    ...actual,
    createSupabaseCandidateIdentityStore: createSupabaseCandidateIdentityStoreMock,
    resolveCandidateForIngestion: resolveCandidateForIngestionMock,
    linkCandidateApplication: linkCandidateApplicationMock,
  };
});

const makeCandidate = (overrides: Partial<NormalizedATSCandidate>): NormalizedATSCandidate => ({
  ats_id: "app-1",
  ats_source: "greenhouse",
  full_name: "Mock Candidate",
  email: "mock.candidate@example.edu",
  current_stage: "Phone Screen",
  applied_at: "2026-03-01T10:00:00.000Z",
  job_title: "Data Analyst",
  job_id: "job-1",
  status: "active",
  profile_url: "https://app.greenhouse.io/people/1001",
  tags: ["mock"],
  raw: {},
  ...overrides,
});

describe("review candidates service mock evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReviewCandidateContextCacheForTests();
    getSupabaseServiceRoleClientMock.mockReturnValue(null);
    createSupabaseCandidateIdentityStoreMock.mockReturnValue({});
    resolveCandidateForIngestionMock.mockResolvedValue({
      candidate: {
        candidate_id: "candidate-default",
        canonical_profile_id: null,
      },
      variant: {
        source_profile_id: null,
      },
      scope: "employer",
    });
    linkCandidateApplicationMock.mockResolvedValue(undefined);

    fetchATSPipelineForOrgMock.mockResolvedValue({
      provider: "greenhouse",
      result: {
        source: "greenhouse",
        candidates: [
          makeCandidate({
            ats_id: "mock-app-1",
            full_name: "SQLite Mock Candidate",
            email: "sqlite.mock@example.edu",
            raw: {
              source: "greenhouse_sqlite_dev",
              candidate_id: 1001,
              first_name: "SQLite",
            },
          }),
          makeCandidate({
            ats_id: "real-app-2",
            full_name: "API Candidate",
            email: "api.candidate@example.edu",
            raw: {
              candidate: {
                id: 2002,
              },
            },
          }),
        ],
        total: 2,
        page: 1,
        has_more: false,
      },
    });
  });

  it("builds deterministic mock evidence profiles for fake ATS candidates", async () => {
    const first = await listRecruiterReviewCandidates({ orgId: "org-1" });
    const second = await listRecruiterReviewCandidates({ orgId: "org-1" });

    const sqliteCandidateA = first.candidates.find((row) => row.application_id === "mock-app-1");
    const sqliteCandidateB = second.candidates.find((row) => row.application_id === "mock-app-1");

    expect(sqliteCandidateA).toBeDefined();
    expect(sqliteCandidateB).toBeDefined();
    expect(sqliteCandidateA?.capability_summary.length ?? 0).toBeGreaterThan(0);
    expect(sqliteCandidateA?.capability_summary).toEqual(sqliteCandidateB?.capability_summary);
    expect(sqliteCandidateA?.identity_source).toBe("ats_derived");

    const totalEvidence =
      (sqliteCandidateA?.evidence_indicator.verified ?? 0) +
      (sqliteCandidateA?.evidence_indicator.pending ?? 0) +
      (sqliteCandidateA?.evidence_indicator.unverified ?? 0);

    expect(totalEvidence).toBeGreaterThan(1);
    expect(sqliteCandidateA?.identity_state).toBe("unresolved");
    expect(sqliteCandidateA?.candidate_id).toBeNull();
  });

  it("marks resolved non-canonical identity as ats_linked when student profile is present", async () => {
    getSupabaseServiceRoleClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "students") {
          return {
            select: () => ({
              limit: async () => ({
                data: [
                  {
                    profile_id: "profile-sam",
                    email: "sam.r@example.com",
                    profiles: [{ personal_info: { email: "sam.r@example.com" } }],
                  },
                ],
              }),
            }),
          };
        }

        if (table === "artifacts") {
          return {
            select: () => ({
              in: async () => ({ data: [] }),
            }),
          };
        }

        return {
          select: () => ({
            limit: async () => ({ data: [] }),
          }),
        };
      },
    });

    fetchATSPipelineForOrgMock.mockResolvedValue({
      provider: "greenhouse",
      result: {
        source: "greenhouse",
        candidates: [
          makeCandidate({
            ats_id: "sam-app-1",
            full_name: "Sam Robinson",
            email: "sam.r@example.com",
            raw: {
              source: "greenhouse_sqlite_dev",
              candidate_id: 1019,
              first_name: "Sam",
            },
          }),
        ],
        total: 1,
        page: 1,
        has_more: false,
      },
    });

    resolveCandidateForIngestionMock.mockResolvedValue({
      candidate: {
        candidate_id: "candidate-sam",
        canonical_profile_id: null,
      },
      variant: {
        source_profile_id: "profile-sam",
      },
      scope: "employer",
    });

    const list = await listRecruiterReviewCandidates({ orgId: "org-1" });
    expect(list.candidates).toHaveLength(1);
    const sam = list.candidates[0];
    expect(sam?.identity_state).toBe("resolved");
    expect(sam?.identity_source).toBe("ats_linked");
    expect(sam?.candidate_id).not.toBeNull();

    const totalEvidence =
      (sam?.evidence_indicator.verified ?? 0) +
      (sam?.evidence_indicator.pending ?? 0) +
      (sam?.evidence_indicator.unverified ?? 0);

    expect(totalEvidence).toBeGreaterThanOrEqual(6);
    expect(sam?.capability_summary.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("keeps unresolved non-mock candidates on application-scoped fallback evidence", async () => {
    const list = await listRecruiterReviewCandidates({ orgId: "org-1" });
    const apiCandidate = list.candidates.find((row) => row.application_id === "real-app-2");
    expect(apiCandidate).toBeDefined();
    expect(apiCandidate?.candidate_id).toBeNull();
    expect(apiCandidate?.identity_state).toBe("unresolved");
    expect(apiCandidate?.identity_source).toBe("ats_derived");

    const detail = await getRecruiterReviewCandidateEvidence({
      orgId: "org-1",
      applicationId: "real-app-2",
    });

    expect(detail).not.toBeNull();
    expect(detail?.identity_state).toBe("unresolved");
    expect(detail?.identity_source).toBe("ats_derived");
    expect(detail?.artifacts).toHaveLength(1);
    expect(detail?.artifacts[0]?.artifact_type).toBe("application_record");
  });
});
