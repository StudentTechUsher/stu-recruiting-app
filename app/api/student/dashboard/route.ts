import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { deriveCapabilitiesFromEvidence, type RoleCapabilityMap } from "@/lib/capabilities/derivation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentRow = { student_data: unknown };
type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  updated_at: string | null;
  is_active?: boolean | null;
};
type SourceExtractionStatus = "extracting" | "succeeded" | "failed" | "unknown";

type DashboardState = "no_evidence" | "partial_no_verification" | "full_low_trust" | "progressing";
type JobRoleMappingRow = { role_name_normalized: string | null; role_data: unknown };

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

const normalizeRoleName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");
const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildDbRoleCapabilityMap = async ({
  supabase,
  selectedRoles,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;
  selectedRoles: string[];
}): Promise<RoleCapabilityMap | null> => {
  if (selectedRoles.length === 0) return null;

  const normalizedRoles = Array.from(new Set(selectedRoles.map(normalizeRoleName).filter((role) => role.length > 0)));
  if (normalizedRoles.length === 0) return null;

  const mappingQuery = (await supabase
    .from("job_roles")
    .select("role_name_normalized, role_data")
    .in("role_name_normalized", normalizedRoles)) as { data: JobRoleMappingRow[] | null; error: unknown };
  if (mappingQuery.error) return null;

  const roleCapabilityMap: RoleCapabilityMap = {};
  for (const row of mappingQuery.data ?? []) {
    const roleNameNormalized = row.role_name_normalized?.trim().toLowerCase() ?? "";
    if (!roleNameNormalized) continue;
    const roleData = toRecord(row.role_data);
    const capabilityIds = Array.isArray(roleData.capability_ids)
      ? roleData.capability_ids
          .filter((capabilityId) => typeof capabilityId === "string")
          .map((capabilityId) => (capabilityId as string).trim())
          .filter((capabilityId) => capabilityId.length > 0)
      : [];
    if (capabilityIds.length === 0) continue;
    const deduped = Array.from(new Set(capabilityIds));
    if (deduped.length > 0) {
      roleCapabilityMap[roleNameNormalized] = deduped;
    }
  }

  return Object.keys(roleCapabilityMap).length > 0 ? roleCapabilityMap : null;
};

const determineDashboardState = ({
  evidenceCount,
  coveragePercent,
  verifiedShare,
  hasLowTrustRequiredCapability,
}: {
  evidenceCount: number;
  coveragePercent: number;
  verifiedShare: number;
  hasLowTrustRequiredCapability: boolean;
}): DashboardState => {
  if (evidenceCount === 0) return "no_evidence";
  if (coveragePercent > 0 && verifiedShare === 0) return "partial_no_verification";
  if (coveragePercent === 100 && hasLowTrustRequiredCapability) return "full_low_trust";
  return "progressing";
};

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return ok({
      resource: "student_dashboard",
      dashboard: {
        roles: [],
        axes: [],
        kpis: {
          capability_coverage_percent: 0,
          verified_evidence_share: 0,
          pending_unverified_share: 0,
          last_updated_at: null,
          evidence_count: 0,
          total_linked_evidence: 0,
        },
        identity_state: "unavailable",
        alerts: {
          extraction_in_progress: false,
          extraction_status: {
            resume: "unknown",
            transcript: "unknown",
          },
          resume_email_mismatch: null,
        },
        state: "no_evidence",
        primary_cta: { label: "Add artifacts", href: "/student/artifacts?openAddArtifact=true" },
        secondary_cta: { label: "Review Evidence Profile", href: "/student/artifacts" },
      },
    });
  }

  const [{ data: studentRows }, { data: artifactRows }] = (await Promise.all([
    supabase.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, updated_at, is_active")
      .eq("profile_id", context.user_id)
      .order("updated_at", { ascending: false }),
  ])) as [{ data: StudentRow[] | null }, { data: ArtifactRow[] | null }];

  const studentData = toRecord((studentRows ?? [])[0]?.student_data);
  const selectedRoles = toStringArray(studentData.target_roles);
  const sourceExtractionLog = toRecord(studentData.source_extraction_log);
  const onboardingSignals = toRecord(studentData.onboarding_signals);
  const mismatchSignal = toRecord(onboardingSignals.resume_email_mismatch);
  const mismatchDismissed = Boolean(mismatchSignal.dismissed_at);
  const mismatchResolved = mismatchSignal.status === "resolved";
  const activeMismatch =
    !mismatchDismissed &&
    !mismatchResolved &&
    mismatchSignal.status === "active" &&
    toTrimmedString(mismatchSignal.auth_email) &&
    toTrimmedString(mismatchSignal.resume_email)
      ? {
          auth_email: toTrimmedString(mismatchSignal.auth_email),
          resume_email: toTrimmedString(mismatchSignal.resume_email),
          detected_at: toTrimmedString(mismatchSignal.detected_at),
          message:
            toTrimmedString(mismatchSignal.message) ??
            "Resume email does not match your account email. Employers may not link applications to this profile if emails differ.",
        }
      : null;

  const normalizeExtractionStatus = (value: unknown): SourceExtractionStatus => {
    const normalized = toTrimmedString(value)?.toLowerCase();
    if (normalized === "extracting" || normalized === "succeeded" || normalized === "failed") return normalized;
    return "unknown";
  };

  const resumeExtractionStatus = normalizeExtractionStatus(toRecord(sourceExtractionLog.resume).status);
  const transcriptExtractionStatus = normalizeExtractionStatus(toRecord(sourceExtractionLog.transcript).status);
  const extractionInProgress = resumeExtractionStatus === "extracting" || transcriptExtractionStatus === "extracting";
  const activeArtifacts = (artifactRows ?? [])
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      artifact_id: row.artifact_id,
      artifact_type: row.artifact_type,
      artifact_data: toRecord(row.artifact_data),
      updated_at: row.updated_at,
    }));

  const dbRoleCapabilityMap = await buildDbRoleCapabilityMap({
    supabase,
    selectedRoles,
  });

  const derived = deriveCapabilitiesFromEvidence({
    selectedRoles,
    artifacts: activeArtifacts,
    roleCapabilityMap: dbRoleCapabilityMap ?? undefined,
  });
  const coveragePercentForDashboard =
    selectedRoles.length === 0
      ? Math.min(derived.kpis.capability_coverage_percent, 30)
      : derived.kpis.capability_coverage_percent;

  const requiredAxes = derived.axes.filter((axis) => axis.capability_class !== "fallback");
  const hasLowTrustRequiredCapability = requiredAxes.some(
    (axis) => axis.covered && axis.verification_breakdown.verified === 0
  );

  const state = determineDashboardState({
    evidenceCount: derived.kpis.evidence_count,
    coveragePercent: coveragePercentForDashboard,
    verifiedShare: derived.kpis.verified_evidence_share,
    hasLowTrustRequiredCapability,
  });

  const primaryCta =
    state === "no_evidence"
      ? { label: "Add artifacts", href: "/student/artifacts?openAddArtifact=true" }
      : state === "partial_no_verification"
        ? { label: "Verify artifacts", href: "/student/artifacts?focus=verification" }
        : state === "full_low_trust"
          ? { label: "Verify high-impact artifacts", href: "/student/artifacts?focus=verification" }
          : { label: "Review Evidence Profile", href: "/student/artifacts" };
  const secondaryCta =
    state === "no_evidence"
      ? { label: "Review Evidence Profile", href: "/student/artifacts" }
      : state === "partial_no_verification"
        ? { label: "Add artifacts", href: "/student/artifacts?openAddArtifact=true" }
        : { label: "Review Evidence Profile", href: "/student/artifacts" };

  return ok({
    resource: "student_dashboard",
    dashboard: {
      roles: selectedRoles,
      axes: derived.axes,
      unmapped_artifact_ids: derived.unmapped_artifact_ids,
      kpis: {
        ...derived.kpis,
        capability_coverage_percent: coveragePercentForDashboard,
      },
      alerts: {
        extraction_in_progress: extractionInProgress,
        extraction_status: {
          resume: resumeExtractionStatus,
          transcript: transcriptExtractionStatus,
        },
        resume_email_mismatch: activeMismatch,
      },
      state,
      primary_cta: primaryCta,
      secondary_cta: secondaryCta,
    },
  });
}
