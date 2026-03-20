import { describe, expect, it } from "vitest";
import type { NormalizedATSCandidate } from "@/lib/ats/types";
import { buildCandidateCRMRecords } from "@/lib/recruiter/crm";

const makeCandidate = (overrides: Partial<NormalizedATSCandidate>): NormalizedATSCandidate => ({
  ats_id: "candidate-1",
  ats_source: "greenhouse",
  full_name: "Student One",
  email: "student@school.edu",
  current_stage: "Phone Screen",
  applied_at: "2026-03-01T10:00:00.000Z",
  job_title: "Software Engineer Intern",
  job_id: "job-1",
  status: "active",
  profile_url: "https://example.com",
  tags: [],
  raw: {},
  ...overrides,
});

describe("buildCandidateCRMRecords", () => {
  it("dedupes multiple active applications for the same email into one CRM record", () => {
    const records = buildCandidateCRMRecords({
      provider: "greenhouse",
      candidates: [
        makeCandidate({
          ats_id: "100",
          email: "student@school.edu",
          job_title: "Backend Engineer Intern",
          applied_at: "2026-03-01T10:00:00.000Z",
        }),
        makeCandidate({
          ats_id: "101",
          email: "student@school.edu",
          job_title: "Platform Engineer Intern",
          applied_at: "2026-03-05T10:00:00.000Z",
        }),
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].active_application_count).toBe(2);
    expect(records[0].applied_roles).toEqual([
      "Backend Engineer Intern",
      "Platform Engineer Intern",
    ]);
    expect(records[0].primary_candidate_key).toBe("greenhouse:101");
  });

  it("excludes non-active candidates from CRM records", () => {
    const records = buildCandidateCRMRecords({
      provider: "greenhouse",
      candidates: [
        makeCandidate({
          ats_id: "100",
          email: "student@school.edu",
          status: "active",
        }),
        makeCandidate({
          ats_id: "102",
          email: "student@school.edu",
          status: "rejected",
        }),
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].candidate_keys).toEqual(["greenhouse:100"]);
  });

  it("prefers student profile id metadata when deduping", () => {
    const candidateMetaByKey = new Map([
      ["greenhouse:100", { student_profile_id: "profile-1", candidate_email: "first@school.edu" }],
      ["greenhouse:101", { student_profile_id: "profile-1", candidate_email: "second@school.edu" }],
    ]);

    const records = buildCandidateCRMRecords({
      provider: "greenhouse",
      candidates: [
        makeCandidate({
          ats_id: "100",
          email: "first@school.edu",
          job_title: "Role A",
        }),
        makeCandidate({
          ats_id: "101",
          email: "second@school.edu",
          job_title: "Role B",
          applied_at: "2026-03-04T10:00:00.000Z",
        }),
      ],
      candidateMetaByKey,
    });

    expect(records).toHaveLength(1);
    expect(records[0].record_id).toBe("profile:profile-1");
    expect(records[0].applied_roles).toEqual(["Role A", "Role B"]);
  });
});
