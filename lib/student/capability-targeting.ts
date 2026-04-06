import { getCapabilityAxisDefinition } from "@/lib/capabilities/ontology";
import {
  getActiveRoleCapabilityAxes,
  normalizeRoleCapabilityAxes,
  type RoleCapabilityAxis,
} from "@/lib/recruiter/capability-axes";

type VerificationState = "verified" | "pending" | "unverified";

export const capabilityProfileSelectionSources = [
  "manual",
  "agent_recommended",
  "agent_confirmed",
  "migrated_legacy",
] as const;

export type CapabilityProfileSelectionSource = (typeof capabilityProfileSelectionSources)[number];

export const capabilityProfileArchiveReasons = [
  "replaced",
  "removed_by_user",
  "migration_cleanup",
] as const;

export type CapabilityProfileArchiveReason = (typeof capabilityProfileArchiveReasons)[number];

export type ActiveCapabilityProfileSelection = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: CapabilityProfileSelectionSource;
  status: "active";
};

export type ArchivedCapabilityProfileSelection = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: CapabilityProfileSelectionSource;
  status: "archived";
  archived_at: string;
  archive_reason: CapabilityProfileArchiveReason;
};

export type CapabilityProfileOption = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  capability_ids: string[];
  target_axes: RoleCapabilityAxis[];
  target_weights: Record<string, number>;
  updated_at: string;
};

type DerivationArtifact = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  updated_at: string | null;
};

export type CapabilityFitEvidenceState = "missing" | "tentative" | "strong";

export type CapabilityProfileFitAxis = {
  capability_id: string;
  label: string;
  candidate_score: number;
  required_level: number;
  gap: number;
  attainment: number;
  weighted_contribution: number;
  confidence: number;
  evidence_count: number;
  low_confidence: boolean;
  confidence_reason: string[];
  confidence_level: "low" | "medium" | "high";
  weight: number;
  target_magnitude: number;
  evidence_magnitude: number;
  evidence_state: CapabilityFitEvidenceState;
  supporting_evidence_count: number;
};

export type CapabilityProfileFit = {
  capability_profile_id: string;
  company_label: string;
  role_label: string;
  alignment_score: number;
  overall_alignment: number;
  confidence_summary: {
    average_confidence: number;
    low_confidence_axis_count: number;
    axis_count: number;
  };
  axes: CapabilityProfileFitAxis[];
  generated_at: string;
  evidence_freshness_marker: string;
};

const capabilityLabelById: Record<string, string> = {
  communication: "Communication",
  collaboration: "Collaboration",
  execution_reliability: "Execution Reliability",
  technical_depth: "Technical Depth",
  systems_thinking: "Systems Thinking",
  data_management: "Data Management",
  product_analytics: "Product Analytics",
  research_methodology: "Research Methodology",
  leadership: "Leadership",
  other_evidence: "Other Evidence",
};

const artifactTypeToCapabilities: Record<string, string[]> = {
  // TODO(stu-evidence): Replace type-level defaults with artifact-level signal extraction
  // and role-targeted signal validation. A single artifact type can emit different signals.
  coursework: ["technical_depth", "data_management"],
  project: ["technical_depth", "systems_thinking", "execution_reliability"],
  internship: ["execution_reliability", "collaboration", "communication"],
  employment: ["execution_reliability", "collaboration", "leadership"],
  certification: ["technical_depth", "execution_reliability"],
  test: ["technical_depth", "execution_reliability"],
  leadership: ["leadership", "communication", "collaboration"],
  club: ["collaboration", "communication", "leadership"],
  competition: ["technical_depth", "research_methodology", "execution_reliability"],
  research: ["research_methodology", "technical_depth", "systems_thinking"],
};

const contributionWeightByVerificationState: Record<VerificationState, number> = {
  verified: 1,
  pending: 0.65,
  unverified: 0.35,
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toIsoTimestampOrNow = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
};

const normalizeLabelKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");
const normalizeCapabilityKey = (value: string): string =>
  normalizeLabelKey(value)
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const toVerificationState = (value: unknown): VerificationState => {
  const raw = toTrimmedString(value)?.toLowerCase();
  if (raw === "verified" || raw === "pending" || raw === "unverified") return raw;
  return "unverified";
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const normalizeSelectionSource = (
  value: unknown,
  fallback: CapabilityProfileSelectionSource
): CapabilityProfileSelectionSource => {
  const raw = toTrimmedString(value);
  if (!raw) return fallback;
  if (capabilityProfileSelectionSources.includes(raw as CapabilityProfileSelectionSource)) {
    return raw as CapabilityProfileSelectionSource;
  }
  return fallback;
};

export const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (normalized.length === 0) continue;
    const key = normalizeLabelKey(normalized);
    if (!deduped.has(key)) deduped.set(key, normalized);
  }
  return Array.from(deduped.values());
};

export const parseActiveCapabilityProfiles = (value: unknown): ActiveCapabilityProfileSelection[] => {
  if (!Array.isArray(value)) return [];

  const parsed: ActiveCapabilityProfileSelection[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const record = toRecord(item);
    const capabilityProfileId = toTrimmedString(record.capability_profile_id);
    const companyId = toTrimmedString(record.company_id);
    const companyLabel = toTrimmedString(record.company_label);
    const roleId = toTrimmedString(record.role_id);
    const roleLabel = toTrimmedString(record.role_label);
    if (!capabilityProfileId || !companyId || !companyLabel || !roleId || !roleLabel) continue;
    if (seen.has(capabilityProfileId)) continue;
    seen.add(capabilityProfileId);
    parsed.push({
      capability_profile_id: capabilityProfileId,
      company_id: companyId,
      company_label: companyLabel,
      role_id: roleId,
      role_label: roleLabel,
      selected_at: toIsoTimestampOrNow(record.selected_at),
      selection_source: normalizeSelectionSource(record.selection_source, "manual"),
      status: "active",
    });
    if (parsed.length >= 2) break;
  }

  return parsed;
};

export const parseCapabilityProfileSelectionHistory = (value: unknown): ArchivedCapabilityProfileSelection[] => {
  if (!Array.isArray(value)) return [];
  const parsed: ArchivedCapabilityProfileSelection[] = [];

  for (const item of value) {
    const record = toRecord(item);
    const capabilityProfileId = toTrimmedString(record.capability_profile_id);
    const companyId = toTrimmedString(record.company_id);
    const companyLabel = toTrimmedString(record.company_label) ?? "";
    const roleId = toTrimmedString(record.role_id);
    const roleLabel = toTrimmedString(record.role_label) ?? "";
    const archiveReasonRaw = toTrimmedString(record.archive_reason);
    if (!capabilityProfileId || !companyId || !roleId) continue;
    if (
      !archiveReasonRaw ||
      !capabilityProfileArchiveReasons.includes(archiveReasonRaw as CapabilityProfileArchiveReason)
    ) {
      continue;
    }

    parsed.push({
      capability_profile_id: capabilityProfileId,
      company_id: companyId,
      company_label: companyLabel,
      role_id: roleId,
      role_label: roleLabel,
      selected_at: toIsoTimestampOrNow(record.selected_at),
      selection_source: normalizeSelectionSource(record.selection_source, "manual"),
      status: "archived",
      archived_at: toIsoTimestampOrNow(record.archived_at),
      archive_reason: archiveReasonRaw as CapabilityProfileArchiveReason,
    });
  }

  return parsed;
};

export const toArchivedSelection = ({
  active,
  archivedAt,
  reason,
}: {
  active: ActiveCapabilityProfileSelection;
  archivedAt: string;
  reason: CapabilityProfileArchiveReason;
}): ArchivedCapabilityProfileSelection => ({
  capability_profile_id: active.capability_profile_id,
  company_id: active.company_id,
  company_label: active.company_label,
  role_id: active.role_id,
  role_label: active.role_label,
  selected_at: active.selected_at,
  selection_source: active.selection_source,
  status: "archived",
  archived_at: archivedAt,
  archive_reason: reason,
});

export const deriveLegacyTargetsFromActive = (active: ActiveCapabilityProfileSelection[]): {
  target_roles: string[];
  target_companies: string[];
} => {
  const roles = new Map<string, string>();
  const companies = new Map<string, string>();

  for (const item of active) {
    const roleKey = normalizeLabelKey(item.role_label);
    const companyKey = normalizeLabelKey(item.company_label);
    if (!roles.has(roleKey)) roles.set(roleKey, item.role_label);
    if (!companies.has(companyKey)) companies.set(companyKey, item.company_label);
  }

  return {
    target_roles: Array.from(roles.values()),
    target_companies: Array.from(companies.values()),
  };
};

export const buildLegacyMigrationSelections = ({
  targetRoles,
  targetCompanies,
  profiles,
}: {
  targetRoles: string[];
  targetCompanies: string[];
  profiles: CapabilityProfileOption[];
}): ActiveCapabilityProfileSelection[] => {
  if (targetRoles.length === 0 || targetCompanies.length === 0 || profiles.length === 0) return [];

  const roleKeys = targetRoles.map((role) => normalizeLabelKey(role));
  const companyKeys = targetCompanies.map((company) => normalizeLabelKey(company));
  const byCombo = new Map<string, CapabilityProfileOption>();
  for (const profile of profiles) {
    const comboKey = `${normalizeLabelKey(profile.role_label)}::${normalizeLabelKey(profile.company_label)}`;
    if (!byCombo.has(comboKey)) byCombo.set(comboKey, profile);
  }

  const migrated: ActiveCapabilityProfileSelection[] = [];
  const nowIso = new Date().toISOString();
  for (const roleKey of roleKeys) {
    for (const companyKey of companyKeys) {
      const combo = byCombo.get(`${roleKey}::${companyKey}`);
      if (!combo) continue;
      if (migrated.some((item) => item.capability_profile_id === combo.capability_profile_id)) continue;
      migrated.push({
        capability_profile_id: combo.capability_profile_id,
        company_id: combo.company_id,
        company_label: combo.company_label,
        role_id: combo.role_id,
        role_label: combo.role_label,
        selected_at: nowIso,
        selection_source: "migrated_legacy",
        status: "active",
      });
      if (migrated.length >= 2) return migrated;
    }
  }

  return migrated;
};

export const normalizeCapabilityProfileRequestKey = ({
  companyId,
  roleId,
  companyLabel,
  roleLabel,
}: {
  companyId?: string | null;
  roleId?: string | null;
  companyLabel?: string | null;
  roleLabel?: string | null;
}): string | null => {
  const normalizedCompanyId = toTrimmedString(companyId);
  const normalizedRoleId = toTrimmedString(roleId);

  if (normalizedCompanyId && normalizedRoleId) {
    return `ids:${normalizedCompanyId}::${normalizedRoleId}`;
  }

  const normalizedCompanyLabel = companyLabel ? normalizeLabelKey(companyLabel) : "";
  const normalizedRoleLabel = roleLabel ? normalizeLabelKey(roleLabel) : "";
  if (!normalizedCompanyLabel || !normalizedRoleLabel) return null;
  return `labels:${normalizedCompanyLabel}::${normalizedRoleLabel}`;
};

export const buildSelectionFingerprint = (active: ActiveCapabilityProfileSelection[]): string =>
  active.map((item) => item.capability_profile_id).join("|");

type CapabilityFamily =
  | "communication"
  | "collaboration"
  | "execution_reliability"
  | "technical_depth"
  | "systems_thinking"
  | "data_management"
  | "product_analytics"
  | "research_methodology"
  | "leadership";

const resolveCapabilityFamily = (capabilityId: string): CapabilityFamily | null => {
  const normalized = normalizeCapabilityKey(capabilityId);
  if (!normalized) return null;

  if (normalized.includes("communicat")) return "communication";
  if (normalized.includes("collab") || normalized.includes("teamwork") || normalized.includes("cross_function")) {
    return "collaboration";
  }
  if (
    normalized.includes("execution") ||
    normalized.includes("reliab") ||
    normalized.includes("delivery") ||
    normalized.includes("ownership")
  ) {
    return "execution_reliability";
  }
  if (normalized.includes("technical") || normalized.includes("engineering") || normalized.includes("coding")) {
    return "technical_depth";
  }
  if (normalized.includes("systems") || normalized.includes("architecture") || normalized.includes("problem_solv")) {
    return "systems_thinking";
  }
  if (normalized.includes("data_manage") || normalized.includes("data_quality") || normalized.includes("data_literacy")) {
    return "data_management";
  }
  if (
    normalized.includes("analytics") ||
    normalized.includes("analytical") ||
    normalized.includes("business_judg") ||
    normalized.includes("decision")
  ) {
    return "product_analytics";
  }
  if (normalized.includes("research") || normalized.includes("experiment") || normalized.includes("hypothesis")) {
    return "research_methodology";
  }
  if (normalized.includes("leader") || normalized.includes("influence") || normalized.includes("stakeholder_manage")) {
    return "leadership";
  }
  return null;
};

const expandMappedCapabilityIds = ({
  mappedCapabilityIds,
  targetCapabilityIds,
}: {
  mappedCapabilityIds: string[];
  targetCapabilityIds: string[];
}): string[] => {
  if (mappedCapabilityIds.length === 0) return [];

  const targetIdsByFamily = new Map<CapabilityFamily, Set<string>>();
  for (const targetCapabilityId of targetCapabilityIds) {
    const family = resolveCapabilityFamily(targetCapabilityId);
    if (!family) continue;
    const existing = targetIdsByFamily.get(family) ?? new Set<string>();
    existing.add(targetCapabilityId);
    targetIdsByFamily.set(family, existing);
  }

  const expanded = new Set<string>();
  for (const mappedCapabilityId of mappedCapabilityIds) {
    expanded.add(mappedCapabilityId);
    const family = resolveCapabilityFamily(mappedCapabilityId);
    if (!family) continue;
    const familyTargets = targetIdsByFamily.get(family);
    if (!familyTargets) continue;
    for (const capabilityId of familyTargets) expanded.add(capabilityId);
  }

  return Array.from(expanded.values());
};

const hashMarkerSeed = (seed: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildEvidenceFreshnessMarker = (artifacts: DerivationArtifact[]): string => {
  const latestUpdatedAt = artifacts.reduce((latest, artifact) => {
    const ts = artifact.updated_at ? Date.parse(artifact.updated_at) : 0;
    if (!Number.isFinite(ts) || ts <= latest) return latest;
    return ts;
  }, 0);

  const markerSeed = artifacts
    .map((artifact) => {
      const verificationStatus = toVerificationState(artifact.artifact_data.verification_status);
      return `${artifact.artifact_id}:${artifact.artifact_type}:${verificationStatus}:${artifact.updated_at ?? ""}`;
    })
    .sort()
    .join("|");

  return `${artifacts.length}:${latestUpdatedAt}:${hashMarkerSeed(markerSeed)}`;
};

const capabilityLabel = (capabilityId: string): string => {
  const normalized = capabilityId.trim().toLowerCase();
  const mapped = capabilityLabelById[normalized];
  if (mapped) return mapped;
  const ontologyDefinition = getCapabilityAxisDefinition(normalized);
  if (ontologyDefinition?.label) return ontologyDefinition.label;
  const humanized = normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
  return humanized.length > 0 ? humanized : capabilityId;
};

const toNumericRecord = (value: unknown): Record<string, number> => {
  const record = toRecord(value);
  const parsed: Record<string, number> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    parsed[key.trim()] = raw;
  }
  return parsed;
};

export const computeCapabilityProfileFit = ({
  profile,
  artifacts,
  evidenceFreshnessMarker,
  candidateAxisScoresById,
}: {
  profile: CapabilityProfileOption;
  artifacts: DerivationArtifact[];
  evidenceFreshnessMarker: string;
  candidateAxisScoresById?: Record<
    string,
    {
      score_normalized: number;
      confidence: number;
      evidence_count: number;
      low_confidence: boolean;
      confidence_reason: string[];
      confidence_level: "low" | "medium" | "high";
    }
  >;
}): CapabilityProfileFit => {
  const normalizedTargetAxes = getActiveRoleCapabilityAxes(
    normalizeRoleCapabilityAxes({
      axes: profile.target_axes ?? [],
      weights: profile.target_weights,
    })
  );
  const fallbackTargetAxes =
    normalizedTargetAxes.length > 0
      ? normalizedTargetAxes
      : profile.capability_ids.map((capabilityId) => ({
          axis_id: capabilityId,
          required_level: 0.7,
          required_level_source: "legacy_default" as const,
          weight: 1,
          required_evidence_types: [],
          is_active: true,
        }));
  const targetCapabilityIds = fallbackTargetAxes.map((axis) => axis.axis_id);
  const axisById = new Map(fallbackTargetAxes.map((axis) => [axis.axis_id, axis]));
  const activeWeightSum = fallbackTargetAxes.reduce((sum, axis) => sum + Math.max(axis.weight, 0), 0);
  const evidenceByCapability = new Map<
    string,
    {
      magnitude: number;
      supportingEvidenceIds: Set<string>;
      hasVerified: boolean;
      verificationBreakdown: Record<VerificationState, number>;
    }
  >();

  for (const capabilityId of targetCapabilityIds) {
    evidenceByCapability.set(capabilityId, {
      magnitude: 0,
      supportingEvidenceIds: new Set<string>(),
      hasVerified: false,
      verificationBreakdown: {
        verified: 0,
        pending: 0,
        unverified: 0,
      },
    });
  }

  for (const artifact of artifacts) {
    const mappedCapabilities = expandMappedCapabilityIds({
      mappedCapabilityIds: artifactTypeToCapabilities[artifact.artifact_type] ?? [],
      targetCapabilityIds,
    });
    if (mappedCapabilities.length === 0) continue;
    const verificationState = toVerificationState(artifact.artifact_data.verification_status);
    const contribution = contributionWeightByVerificationState[verificationState];

    for (const capabilityId of mappedCapabilities) {
      const current = evidenceByCapability.get(capabilityId);
      if (!current) continue;
      current.magnitude = clamp01(current.magnitude + contribution);
      current.supportingEvidenceIds.add(artifact.artifact_id);
      if (verificationState === "verified") current.hasVerified = true;
      current.verificationBreakdown[verificationState] += 1;
    }
  }

  const axes: CapabilityProfileFitAxis[] = targetCapabilityIds.map((capabilityId) => {
    const evidenceState = evidenceByCapability.get(capabilityId) ?? {
      magnitude: 0,
      supportingEvidenceIds: new Set<string>(),
      hasVerified: false,
      verificationBreakdown: {
        verified: 0,
        pending: 0,
        unverified: 0,
      },
    };
    const targetAxis = axisById.get(capabilityId) ?? {
      axis_id: capabilityId,
      required_level: 0.7,
      required_level_source: "legacy_default" as const,
      weight: 1,
      is_active: true,
      required_evidence_types: [],
    };
    const candidateSnapshotScore = candidateAxisScoresById?.[capabilityId];
    const candidateScore = clamp01(candidateSnapshotScore?.score_normalized ?? evidenceState.magnitude);
    const requiredLevel = clamp01(targetAxis.required_level);
    const evidenceCount = Math.max(candidateSnapshotScore?.evidence_count ?? evidenceState.supportingEvidenceIds.size, 0);
    const verifiedCount = evidenceState.verificationBreakdown.verified;
    const verifiedRatio = evidenceCount > 0 ? verifiedCount / evidenceCount : 0;
    const inferredConfidence = clamp01(evidenceCount === 0 ? 0 : 0.35 + Math.min(evidenceCount, 4) * 0.1 + verifiedRatio * 0.25);
    const confidence = clamp01(candidateSnapshotScore?.confidence ?? inferredConfidence);
    const lowConfidence = Boolean(
      candidateSnapshotScore?.low_confidence ?? (confidence < 0.6 || evidenceCount < 2)
    );
    const confidenceReason: string[] =
      candidateSnapshotScore?.confidence_reason?.length
        ? candidateSnapshotScore.confidence_reason
        : [
            ...(confidence < 0.6 ? ["confidence_below_threshold"] : []),
            ...(evidenceCount < 2 ? ["insufficient_evidence_count"] : []),
          ];
    const confidenceLevel: "low" | "medium" | "high" =
      candidateSnapshotScore?.confidence_level ?? (lowConfidence ? "low" : confidence < 0.8 ? "medium" : "high");
    const attainment = requiredLevel > 0 ? clamp01(Math.min(candidateScore / requiredLevel, 1)) : 1;
    const normalizedWeight = activeWeightSum > 0 ? Math.max(targetAxis.weight, 0) / activeWeightSum : 0;
    const weightedContribution = normalizedWeight * attainment;
    const gap = candidateScore - requiredLevel;

    return {
      capability_id: capabilityId,
      label: capabilityLabel(capabilityId),
      candidate_score: candidateScore,
      required_level: requiredLevel,
      gap,
      attainment,
      weighted_contribution: weightedContribution,
      confidence,
      evidence_count: evidenceCount,
      low_confidence: lowConfidence,
      confidence_reason: confidenceReason,
      confidence_level: confidenceLevel,
      weight: Math.max(targetAxis.weight, 0),
      target_magnitude: requiredLevel,
      evidence_magnitude: candidateScore,
      evidence_state:
        candidateScore <= 0 ? "missing" : lowConfidence ? "tentative" : evidenceState.hasVerified ? "strong" : "tentative",
      supporting_evidence_count: evidenceCount,
    };
  });
  const alignmentScore = clamp01(axes.reduce((sum, axis) => sum + axis.weighted_contribution, 0));
  const averageConfidence =
    axes.length > 0
      ? clamp01(axes.reduce((sum, axis) => sum + axis.confidence, 0) / axes.length)
      : 0;
  const lowConfidenceAxisCount = axes.filter((axis) => axis.low_confidence).length;

  return {
    capability_profile_id: profile.capability_profile_id,
    company_label: profile.company_label,
    role_label: profile.role_label,
    alignment_score: alignmentScore,
    overall_alignment: alignmentScore,
    confidence_summary: {
      average_confidence: averageConfidence,
      low_confidence_axis_count: lowConfidenceAxisCount,
      axis_count: axes.length,
    },
    axes,
    generated_at: new Date().toISOString(),
    evidence_freshness_marker: evidenceFreshnessMarker,
  };
};
