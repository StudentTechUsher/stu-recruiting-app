import type { ATSPipelineResult, NormalizedATSCandidate } from "@/lib/ats/types";

const SAMPLE_CANDIDATES: NormalizedATSCandidate[] = [
  {
    ats_id: "bhr-app-1001",
    ats_source: "bamboohr",
    full_name: "Morgan Lee",
    email: "morgan.lee@example.edu",
    current_stage: "Phone Screen",
    applied_at: "2026-03-02T09:00:00Z",
    job_title: "Data Analyst",
    job_id: "bhr-role-20",
    status: "active",
    profile_url: "https://example.bamboohr.com/careers/candidate/1001",
    tags: ["campus", "analytics"],
    raw: {
      source: "bamboohr_mock",
      candidate_id: 1001,
    },
  },
  {
    ats_id: "bhr-app-1002",
    ats_source: "bamboohr",
    full_name: "Jordan Cruz",
    email: "jordan.cruz@example.edu",
    current_stage: "Hiring Manager",
    applied_at: "2026-03-05T11:30:00Z",
    job_title: "Product Analyst",
    job_id: "bhr-role-21",
    status: "active",
    profile_url: "https://example.bamboohr.com/careers/candidate/1002",
    tags: ["product"],
    raw: {
      source: "bamboohr_mock",
      candidate_id: 1002,
    },
  },
  {
    ats_id: "bhr-app-1003",
    ats_source: "bamboohr",
    full_name: "Casey Wright",
    email: "casey.wright@example.edu",
    current_stage: "Declined",
    applied_at: "2026-02-25T14:10:00Z",
    job_title: "Associate Consultant",
    job_id: "bhr-role-22",
    status: "rejected",
    profile_url: "https://example.bamboohr.com/careers/candidate/1003",
    tags: ["consulting"],
    raw: {
      source: "bamboohr_mock",
      candidate_id: 1003,
    },
  },
];

export async function fetchBambooHRPipelineFromMock(opts: { page?: number }): Promise<ATSPipelineResult> {
  const page = opts.page ?? 1;
  const perPage = 25;
  const offset = (page - 1) * perPage;
  const paged = SAMPLE_CANDIDATES.slice(offset, offset + perPage);

  return {
    source: "bamboohr",
    candidates: paged,
    total: SAMPLE_CANDIDATES.length,
    page,
    has_more: offset + perPage < SAMPLE_CANDIDATES.length,
  };
}
