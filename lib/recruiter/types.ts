import type {
  ATSProvider,
  CandidateMatchStatus,
  RecommendationReasonCode,
  RecommendationState,
} from "@/lib/ats/types";

export type RecruiterStudentProfile = {
  profile_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  target_roles: string[];
  target_companies: string[];
  university: string | null;
  share_slug: string | null;
};

export type EnrichedRecruiterCandidate = {
  candidate_key: string;
  ats_provider: ATSProvider;
  ats_candidate_id: string;
  full_name: string;
  email: string | null;
  current_stage: string | null;
  applied_at: string | null;
  job_title: string | null;
  job_id: string | null;
  status: "active" | "rejected" | "hired" | "other";
  profile_url: string | null;
  recommendation_state: RecommendationState;
  recommendation_reason_code: RecommendationReasonCode;
  match_status: CandidateMatchStatus;
  student_profile: RecruiterStudentProfile | null;
};

export type RecruiterTimelineEvent = {
  id: string;
  candidate_key: string;
  event_type: "recommendation" | "recruiter_action" | "crm_note" | "crm_reminder";
  title: string;
  detail: string | null;
  created_at: string;
};

export type RecruiterPipelineSummary = {
  total_candidates: number;
  matched_students: number;
  unmatched_candidates: number;
  recommendation_buckets: Record<RecommendationState, number>;
  top_reason_codes: Array<{ reason_code: RecommendationReasonCode; count: number }>;
};

export type RecruiterCapabilityModel = {
  capability_model_id: string;
  org_id: string;
  model_name: string;
  description: string | null;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CapabilityModelVersion = {
  capability_model_version_id: string;
  capability_model_id: string;
  org_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  required_evidence: string[];
  notes: string | null;
  created_at: string;
  published_at: string | null;
};

export type CandidateCRMNote = {
  note_id: string;
  candidate_key: string;
  student_profile_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
};

export type CandidateCRMReminder = {
  reminder_id: string;
  candidate_key: string;
  student_profile_id: string | null;
  title: string;
  due_at: string | null;
  status: "open" | "completed" | "dismissed";
  created_at: string;
  completed_at: string | null;
};

export type CandidateCRMRecord = {
  record_id: string;
  primary_candidate_key: string;
  candidate_keys: string[];
  display_name: string;
  email: string | null;
  student_profile_id: string | null;
  applied_roles: string[];
  applied_job_ids: string[];
  active_application_count: number;
  latest_stage: string | null;
  latest_applied_at: string | null;
  latest_activity_at: string | null;
  open_reminder_count: number;
  note_count: number;
};
