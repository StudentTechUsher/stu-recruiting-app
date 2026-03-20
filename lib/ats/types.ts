export type ATSProvider = "greenhouse" | "lever" | "bamboohr";

export type ATSSource = ATSProvider;

export type RecommendationState = "recommended" | "hold" | "manual_review";

export type RecommendationReasonCode =
  | "RANKED_NORMAL"
  | "UNSCORED_SCANNED_RESUME"
  | "UNSCORED_BROKEN_ATTACHMENT"
  | "UNSCORED_DUPLICATE_RECORD"
  | "UNSCORED_MISSING_ROLE_REQUIREMENTS"
  | "UNSCORED_CONFLICTING_ARTIFACTS"
  | "UNSCORED_LOW_EXTRACTION_CONFIDENCE"
  | "MANUAL_OVERRIDE_UNSCORED"
  | "ATS_REJECTED"
  | "ATS_HIRED"
  | "ATS_WITHOUT_SCORECARD"
  | "ATS_SCORECARD_MIXED"
  | "ATS_SCORECARD_NEGATIVE"
  | "NO_STUDENT_MATCH";

export type CandidateMatchStatus = "MATCHED_STUDENT" | "NO_STUDENT_MATCH";

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

export type GreenhouseJobResult = {
  id: string;
  name: string;
  status: "open" | "closed" | "draft";
  departments: string[];
  stage_count: number;
};

export type GreenhouseCandidateResult = {
  id: string;
  full_name: string;
  email: string | null;
  application_count: number;
  tags: string[];
};

export type GreenhouseScorecardResult = {
  id: string;
  application_id: string;
  interviewer_name: string;
  submitted_at: string | null;
  recommendation: string | null;
  attributes: { name: string; rating: string | null }[];
};

export type GreenhouseOfferResult = {
  id: string;
  application_id: string;
  status: string;
  created_at: string;
  offer_letter_name: string | null;
};

export type GreenhouseDepartmentResult = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type GreenhouseJobStageResult = {
  id: string;
  job_id: string;
  name: string;
  order: number;
};
