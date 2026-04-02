import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { evaluateAndPersistAiLiteracyMap, getAiLiteracyMapForAudience } from "@/lib/ai-literacy/map";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentRow = { student_data: unknown };
type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  source_provenance: unknown;
  updated_at: string | null;
  is_active?: boolean | null;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => (item as string).trim())
    .filter((item) => item.length > 0);
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveEvaluationContext = (studentData: Record<string, unknown>) => {
  const selectedRoles = toStringArray(studentData.target_roles);
  const activeCapabilityProfiles = Array.isArray(studentData.active_capability_profiles)
    ? studentData.active_capability_profiles
    : [];
  const selectedCapabilityProfileRecord =
    activeCapabilityProfiles.length > 0 && typeof activeCapabilityProfiles[0] === "object" && activeCapabilityProfiles[0] !== null
      ? (activeCapabilityProfiles[0] as Record<string, unknown>)
      : null;
  const selectedCapabilityModelId =
    selectedCapabilityProfileRecord && typeof selectedCapabilityProfileRecord.capability_profile_id === "string"
      ? (selectedCapabilityProfileRecord.capability_profile_id as string)
      : null;
  const selectedRoleFromCapabilityProfile = toTrimmedString(selectedCapabilityProfileRecord?.role_label);
  const selectedRolesForEvaluation = Array.from(
    new Set(
      [...selectedRoles, ...(selectedRoleFromCapabilityProfile ? [selectedRoleFromCapabilityProfile] : [])]
        .map((role) => role.trim())
        .filter((role) => role.length > 0)
    )
  );

  return {
    selectedRolesForEvaluation,
    selectedCapabilityModelId,
  };
};

const toDefaultAiLiteracyPayload = ({
  selectedRolesForEvaluation,
  hasSelectedCapabilityModel,
}: {
  selectedRolesForEvaluation: string[];
  hasSelectedCapabilityModel: boolean;
}) => ({
  status: "not_started" as const,
  profile_coverage_percent: 0,
  recruiter_safe_coverage_percent: 0,
  overall_indicative_literacy_level: "Awareness" as const,
  confidence: { class: "insufficient" as const, score: 0 },
  role_lens: {
    role_family: "business_ops_analyst",
    role_labels: selectedRolesForEvaluation,
    role_lens_key: "business_ops_analyst:baseline",
  },
  domains_with_profile_signal: 0,
  domains_with_recruiter_safe_signal: 0,
  total_role_relevant_domains: 0,
  last_evaluated_at: null as string | null,
  updated: false,
  has_selected_capability_model: hasSelectedCapabilityModel,
});

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return ok({
      resource: "ai_literacy_map",
      ai_literacy: toDefaultAiLiteracyPayload({
        selectedRolesForEvaluation: [],
        hasSelectedCapabilityModel: false,
      }),
    });
  }

  const { data: studentRows } = (await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1)) as { data: StudentRow[] | null; error: unknown };
  const studentData = toRecord((studentRows ?? [])[0]?.student_data);
  const { selectedRolesForEvaluation, selectedCapabilityModelId } = resolveEvaluationContext(studentData);
  const aiLiteracyMap = await getAiLiteracyMapForAudience({
    supabase,
    profileId: context.user_id,
    audience: "candidate",
    requireManualGeneration: true,
  });

  return ok({
    resource: "ai_literacy_map",
    ai_literacy: aiLiteracyMap
      ? {
          status: aiLiteracyMap.status,
          profile_coverage_percent: aiLiteracyMap.profile_coverage_percent,
          recruiter_safe_coverage_percent: aiLiteracyMap.recruiter_safe_coverage_percent,
          overall_indicative_literacy_level: aiLiteracyMap.overall_indicative_literacy_level ?? "Awareness",
          confidence: aiLiteracyMap.confidence,
          role_lens: aiLiteracyMap.role_lens,
          domains_with_profile_signal: aiLiteracyMap.domains_with_profile_signal,
          domains_with_recruiter_safe_signal: aiLiteracyMap.domains_with_recruiter_safe_signal,
          total_role_relevant_domains: aiLiteracyMap.total_role_relevant_domains,
          last_evaluated_at: aiLiteracyMap.evaluated_at,
          updated: false,
          has_selected_capability_model: Boolean(selectedCapabilityModelId),
        }
      : toDefaultAiLiteracyPayload({
          selectedRolesForEvaluation,
          hasSelectedCapabilityModel: Boolean(selectedCapabilityModelId),
        }),
  });
}

export async function POST() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const [{ data: studentRows }, { data: artifactRows }] = (await Promise.all([
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, source_provenance, updated_at, is_active")
      .eq("profile_id", context.user_id)
      .order("updated_at", { ascending: false }),
  ])) as [{ data: StudentRow[] | null; error: unknown }, { data: ArtifactRow[] | null; error: unknown }];

  const studentData = toRecord((studentRows ?? [])[0]?.student_data);
  const { selectedRolesForEvaluation, selectedCapabilityModelId } = resolveEvaluationContext(studentData);
  if (!selectedCapabilityModelId) return badRequest("capability_model_required");

  const activeArtifacts = (artifactRows ?? [])
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      artifact_id: row.artifact_id,
      artifact_type: row.artifact_type,
      artifact_data: toRecord(row.artifact_data),
      source_provenance: toRecord(row.source_provenance),
      updated_at: row.updated_at,
    }));

  const aiLiteracyResult = await evaluateAndPersistAiLiteracyMap({
    supabase,
    profileId: context.user_id,
    selectedRoles: selectedRolesForEvaluation,
    selectedCapabilityModelId,
    artifacts: activeArtifacts,
    evaluationTrigger: "manual_refresh",
  });
  const aiLiteracyMap = aiLiteracyResult.map;
  if (!aiLiteracyMap) return badRequest("ai_literacy_generation_failed");

  return ok({
    resource: "ai_literacy_map",
    ai_literacy: {
      status: aiLiteracyMap.status,
      profile_coverage_percent: aiLiteracyMap.profile_coverage_percent,
      recruiter_safe_coverage_percent: aiLiteracyMap.recruiter_safe_coverage_percent,
      overall_indicative_literacy_level: aiLiteracyMap.overall_indicative_literacy_level ?? "Awareness",
      confidence: aiLiteracyMap.confidence,
      role_lens: aiLiteracyMap.role_lens,
      domains_with_profile_signal: aiLiteracyMap.domains_with_profile_signal,
      domains_with_recruiter_safe_signal: aiLiteracyMap.domains_with_recruiter_safe_signal,
      total_role_relevant_domains: aiLiteracyMap.total_role_relevant_domains,
      last_evaluated_at: aiLiteracyMap.evaluated_at,
      updated: false,
      has_selected_capability_model: true,
    },
  });
}
