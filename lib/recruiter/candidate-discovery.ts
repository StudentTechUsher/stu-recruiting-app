import type {
  ATSProvider,
  CandidateMatchStatus,
  RecommendationReasonCode,
  RecommendationState,
} from "@/lib/ats/types";
import type {
  EnrichedRecruiterCandidate,
  RecruiterPipelineSummary,
  RecruiterStudentProfile,
  RecruiterTimelineEvent,
} from "@/lib/recruiter/types";
import { fetchATSPipelineForOrg } from "@/lib/ats/provider-pipeline";
import { fetchGreenhouseScorecards } from "@/lib/ats/greenhouse";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { evaluateRecommendation } from "@/lib/recruiter/recommendation";

const normalizeEmail = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

type StudentRow = {
  profile_id: string;
  student_data: Record<string, unknown> | null;
  profiles:
    | {
        personal_info: Record<string, unknown> | null;
      }
    | Array<{ personal_info: Record<string, unknown> | null }>
    | null;
  student_share_links:
    | {
        share_slug: string | null;
      }
    | Array<{ share_slug: string | null }>
    | null;
};

const getOne = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

async function resolveOrgCompanyName(orgId: string): Promise<string | null> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;

  const { data } = (await supabase
    .from("companies")
    .select("company_name")
    .eq("company_id", orgId)
    .limit(1)) as { data: Array<{ company_name: string | null }> | null };

  return toString(data?.[0]?.company_name) ?? null;
}

async function fetchRecruiterEligibleStudents(orgId: string): Promise<RecruiterStudentProfile[]> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return [];

  const orgCompanyName = await resolveOrgCompanyName(orgId);
  const normalizedCompanyName = orgCompanyName?.toLowerCase() ?? null;

  const { data, error } = (await supabase
    .from("students")
    .select("profile_id, student_data, profiles:profiles!students_profile_id_fkey(personal_info), student_share_links(share_slug)")) as {
    data: StudentRow[] | null;
    error: unknown;
  };

  if (error || !data) return [];

  const eligible: RecruiterStudentProfile[] = [];

  for (const row of data) {
    const studentData = toRecord(row.student_data);
    const visibility = toBoolean(
      studentData.employer_visibility_opt_in ?? studentData.target_employer_visibility_opt_in
    );
    if (!visibility) continue;

    const targetCompanies = toStringArray(studentData.target_companies);
    if (normalizedCompanyName && targetCompanies.length > 0) {
      const companyMatch = targetCompanies.some(
        (companyName) => companyName.trim().toLowerCase() === normalizedCompanyName
      );
      if (!companyMatch) continue;
    }

    const profileRef = getOne(row.profiles);
    const personalInfo = toRecord(profileRef?.personal_info);
    const shareRef = getOne(row.student_share_links);

    const firstName = toString(personalInfo.first_name);
    const lastName = toString(personalInfo.last_name);
    const fullName =
      toString(personalInfo.full_name) ??
      [firstName, lastName].filter(Boolean).join(" ").trim() ??
      "Student";

    eligible.push({
      profile_id: row.profile_id,
      full_name: fullName.length > 0 ? fullName : "Student",
      email: normalizeEmail(toString(personalInfo.email)),
      avatar_url: toString(personalInfo.avatar_url) ?? toString(personalInfo.avatarUrl),
      target_roles: toStringArray(studentData.target_roles),
      target_companies: targetCompanies,
      university: toString(studentData.university) ?? toString(personalInfo.university),
      share_slug: toString(shareRef?.share_slug),
    });
  }

  return eligible;
}

async function fetchGreenhouseScorecardMap(orgId: string, applicationIds: string[]): Promise<Map<string, string[]>> {
  const scorecardMap = new Map<string, string[]>();

  await Promise.all(
    applicationIds.map(async (applicationId) => {
      try {
        const scorecards = await fetchGreenhouseScorecards(orgId, applicationId);
        const recommendations = scorecards
          .map((scorecard) => (typeof scorecard.recommendation === "string" ? scorecard.recommendation : null))
          .filter((value): value is string => Boolean(value));
        scorecardMap.set(applicationId, recommendations);
      } catch {
        scorecardMap.set(applicationId, []);
      }
    })
  );

  return scorecardMap;
}

function buildCandidateKey(provider: ATSProvider, atsCandidateId: string): string {
  return `${provider}:${atsCandidateId}`;
}

type RecommendationEventRow = {
  candidate_key: string;
  recommendation_state: RecommendationState | null;
  reason_code: RecommendationReasonCode | null;
};

async function persistRecommendationEvents(
  orgId: string,
  userId: string,
  candidates: EnrichedRecruiterCandidate[]
): Promise<void> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return;

  const { data: existingRows } = (await supabase
    .from("recruiter_recommendation_events")
    .select("candidate_key, recommendation_state, reason_code")
    .eq("org_id", orgId)
    .eq("event_type", "recommendation")
    .order("created_at", { ascending: false })
    .limit(500)) as { data: RecommendationEventRow[] | null };

  const latestByCandidateKey = new Map<string, RecommendationEventRow>();
  for (const row of existingRows ?? []) {
    if (!latestByCandidateKey.has(row.candidate_key)) {
      latestByCandidateKey.set(row.candidate_key, row);
    }
  }

  const inserts = candidates
    .filter((candidate) => {
      const existing = latestByCandidateKey.get(candidate.candidate_key);
      if (!existing) return true;
      return (
        existing.recommendation_state !== candidate.recommendation_state ||
        existing.reason_code !== candidate.recommendation_reason_code
      );
    })
    .map((candidate) => ({
      org_id: orgId,
      candidate_key: candidate.candidate_key,
      ats_provider: candidate.ats_provider,
      ats_candidate_id: candidate.ats_candidate_id,
      student_profile_id: candidate.student_profile?.profile_id ?? null,
      candidate_email: candidate.email,
      event_type: "recommendation",
      recommendation_state: candidate.recommendation_state,
      reason_code: candidate.recommendation_reason_code,
      evidence: {
        status: candidate.status,
        current_stage: candidate.current_stage,
        match_status: candidate.match_status,
      },
      created_by: userId,
    }));

  if (inserts.length === 0) return;

  await supabase.from("recruiter_recommendation_events").insert(inserts);
}

async function fetchTimelinePreviewByCandidateKey(orgId: string): Promise<Map<string, RecruiterTimelineEvent>> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return new Map();

  const { data } = (await supabase
    .from("recruiter_recommendation_events")
    .select("event_id, candidate_key, event_type, action_name, recommendation_state, reason_code, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(400)) as {
    data:
      | Array<{
          event_id: string;
          candidate_key: string;
          event_type: "recommendation" | "recruiter_action";
          action_name: string | null;
          recommendation_state: RecommendationState | null;
          reason_code: RecommendationReasonCode | null;
          created_at: string;
        }>
      | null;
  };

  const map = new Map<string, RecruiterTimelineEvent>();
  for (const row of data ?? []) {
    if (map.has(row.candidate_key)) continue;

    const title =
      row.event_type === "recruiter_action"
        ? `Recruiter action: ${row.action_name ?? "updated"}`
        : `Recommendation: ${row.recommendation_state ?? "manual_review"}`;

    const detail =
      row.event_type === "recruiter_action"
        ? row.action_name
        : row.reason_code;

    map.set(row.candidate_key, {
      id: row.event_id,
      candidate_key: row.candidate_key,
      event_type: row.event_type,
      title,
      detail,
      created_at: row.created_at,
    });
  }

  return map;
}

type DiscoveryOptions = {
  page?: number;
  pageSize?: number;
  university?: string;
  targetRole?: string;
  recommendationState?: RecommendationState;
  matchStatus?: CandidateMatchStatus;
};

export async function getRecruiterCandidateDiscovery(
  orgId: string,
  userId: string,
  options: DiscoveryOptions = {}
): Promise<{
  provider: ATSProvider;
  summary: RecruiterPipelineSummary;
  candidates: EnrichedRecruiterCandidate[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  timeline_preview_by_candidate_key: Record<string, RecruiterTimelineEvent | undefined>;
}> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 25;

  const [{ provider, result }, recruiterEligibleStudents] = await Promise.all([
    fetchATSPipelineForOrg(orgId, { page: 1 }),
    fetchRecruiterEligibleStudents(orgId),
  ]);

  const studentByEmail = new Map<string, RecruiterStudentProfile>();
  for (const student of recruiterEligibleStudents) {
    const email = normalizeEmail(student.email);
    if (!email) continue;
    if (!studentByEmail.has(email)) studentByEmail.set(email, student);
  }

  const scorecardMap =
    provider === "greenhouse"
      ? await fetchGreenhouseScorecardMap(
          orgId,
          result.candidates.slice(0, 60).map((candidate) => candidate.ats_id)
        )
      : new Map<string, string[]>();

  const enriched: EnrichedRecruiterCandidate[] = result.candidates.map((candidate) => {
    const normalizedCandidateEmail = normalizeEmail(candidate.email);
    const matchedStudent = normalizedCandidateEmail ? studentByEmail.get(normalizedCandidateEmail) ?? null : null;
    const recommendation = evaluateRecommendation(candidate, (scorecardMap.get(candidate.ats_id) ?? []).map((value) => ({ recommendation: value })));

    const matchStatus: CandidateMatchStatus = matchedStudent ? "MATCHED_STUDENT" : "NO_STUDENT_MATCH";
    const recommendationState: RecommendationState =
      matchStatus === "NO_STUDENT_MATCH" ? "manual_review" : recommendation.state;
    const reasonCode: RecommendationReasonCode =
      matchStatus === "NO_STUDENT_MATCH" ? "NO_STUDENT_MATCH" : recommendation.reasonCode;

    return {
      candidate_key: buildCandidateKey(provider, candidate.ats_id),
      ats_provider: provider,
      ats_candidate_id: candidate.ats_id,
      full_name: candidate.full_name,
      email: normalizeEmail(candidate.email),
      current_stage: candidate.current_stage,
      applied_at: candidate.applied_at,
      job_title: candidate.job_title,
      job_id: candidate.job_id,
      status: candidate.status,
      profile_url: candidate.profile_url,
      recommendation_state: recommendationState,
      recommendation_reason_code: reasonCode,
      match_status: matchStatus,
      student_profile: matchedStudent,
    };
  });

  await persistRecommendationEvents(orgId, userId, enriched);

  const timelinePreviewByCandidateKey = await fetchTimelinePreviewByCandidateKey(orgId);

  const filtered = enriched.filter((candidate) => {
    const matchesUniversity =
      !options.university ||
      options.university === "all" ||
      candidate.student_profile?.university === options.university;
    const matchesRole =
      !options.targetRole ||
      options.targetRole === "all" ||
      candidate.student_profile?.target_roles.includes(options.targetRole);
    const matchesRecommendation =
      !options.recommendationState || candidate.recommendation_state === options.recommendationState;
    const matchesStatus = !options.matchStatus || candidate.match_status === options.matchStatus;

    return matchesUniversity && matchesRole && matchesRecommendation && matchesStatus;
  });

  const sorted = filtered.slice().sort((first, second) => {
    const firstAppliedAt = first.applied_at ? Date.parse(first.applied_at) : 0;
    const secondAppliedAt = second.applied_at ? Date.parse(second.applied_at) : 0;
    return secondAppliedAt - firstAppliedAt;
  });

  const start = (page - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const summary: RecruiterPipelineSummary = {
    total_candidates: enriched.length,
    matched_students: enriched.filter((candidate) => candidate.match_status === "MATCHED_STUDENT").length,
    unmatched_candidates: enriched.filter((candidate) => candidate.match_status === "NO_STUDENT_MATCH").length,
    recommendation_buckets: {
      recommended: enriched.filter((candidate) => candidate.recommendation_state === "recommended").length,
      hold: enriched.filter((candidate) => candidate.recommendation_state === "hold").length,
      manual_review: enriched.filter((candidate) => candidate.recommendation_state === "manual_review").length,
    },
    top_reason_codes: (() => {
      const counts = new Map<RecommendationReasonCode, number>();
      for (const candidate of enriched) {
        counts.set(
          candidate.recommendation_reason_code,
          (counts.get(candidate.recommendation_reason_code) ?? 0) + 1
        );
      }
      return [...counts.entries()]
        .map(([reason_code, count]) => ({ reason_code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })(),
  };

  const previewRecord: Record<string, RecruiterTimelineEvent | undefined> = {};
  for (const candidate of paged) {
    previewRecord[candidate.candidate_key] = timelinePreviewByCandidateKey.get(candidate.candidate_key);
  }

  return {
    provider,
    summary,
    candidates: paged,
    total: sorted.length,
    page,
    page_size: pageSize,
    has_more: start + pageSize < sorted.length,
    timeline_preview_by_candidate_key: previewRecord,
  };
}

export async function recordRecruiterCandidateAction(input: {
  orgId: string;
  userId: string;
  candidateKey: string;
  actionName: string;
  details?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { recorded: false };

  await supabase.from("recruiter_recommendation_events").insert({
    org_id: input.orgId,
    candidate_key: input.candidateKey,
    event_type: "recruiter_action",
    action_name: input.actionName,
    evidence: input.details ?? {},
    created_by: input.userId,
  });

  return { recorded: true };
}
