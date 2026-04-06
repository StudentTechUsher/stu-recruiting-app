export type ActiveTarget = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: string;
  status: "active";
};

export type ConnectionRecord = {
  name: string;
  headline: string;
  url: string;
};

export type ProjectedArtifact = {
  artifact_id: string;
  artifact_type: string;
  title: string;
  source: string;
  description: string | null;
  verification_status: "verified" | "pending" | "unverified";
  updated_at: string | null;
  capability_label: string;
};

export type ScoredArtifact = ProjectedArtifact & {
  score: number;
};

export type ScoredConnection = ConnectionRecord & {
  score: number;
};

export type GeneratedNetworkingPayload = {
  selected_url: string;
  rationale: string;
  invite_message: string;
  follow_up_message: string;
};

