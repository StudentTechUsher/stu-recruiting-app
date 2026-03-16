export type ATSSource = "greenhouse" | "lever";

export type NormalizedATSCandidate = {
  ats_id: string;
  ats_source: ATSSource;
  full_name: string;
  email: string | null;
  current_stage: string | null;
  applied_at: string | null; // ISO 8601
  job_title: string | null;
  job_id: string | null;
  status: "active" | "rejected" | "hired" | "other";
  profile_url: string | null;
  tags: string[];
  raw: Record<string, unknown>;
};

export type ATSPipelineResult = {
  source: ATSSource;
  candidates: NormalizedATSCandidate[];
  total: number;
  page: number;
  has_more: boolean;
};
