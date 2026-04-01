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
  target_magnitude: number;
  evidence_magnitude: number;
  evidence_state: CapabilityFitEvidenceState;
  supporting_evidence_count: number;
};

export type CapabilityProfileFit = {
  capability_profile_id: string;
  company_label: string;
  role_label: string;
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

export const buildEvidenceFreshnessMarker = (artifacts: DerivationArtifact[]): string => {
  const latestUpdatedAt = artifacts.reduce((latest, artifact) => {
    const ts = artifact.updated_at ? Date.parse(artifact.updated_at) : 0;
    if (!Number.isFinite(ts) || ts <= latest) return latest;
    return ts;
  }, 0);

  return `${artifacts.length}:${latestUpdatedAt}`;
};

const capabilityLabel = (capabilityId: string): string => {
  const normalized = capabilityId.trim().toLowerCase();
  return capabilityLabelById[normalized] ?? capabilityId;
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
}: {
  profile: CapabilityProfileOption;
  artifacts: DerivationArtifact[];
  evidenceFreshnessMarker: string;
}): CapabilityProfileFit => {
  const weights = toNumericRecord(profile.target_weights);
  const weightedCapabilityIds = Object.keys(weights).filter((id) => id.trim().length > 0);
  const targetCapabilityIds = weightedCapabilityIds.length > 0 ? weightedCapabilityIds : profile.capability_ids;

  const maxWeight = Object.values(weights).reduce((max, weight) => (weight > max ? weight : max), 0);
  const evidenceByCapability = new Map<
    string,
    {
      magnitude: number;
      supportingEvidenceIds: Set<string>;
      hasVerified: boolean;
    }
  >();

  for (const capabilityId of targetCapabilityIds) {
    evidenceByCapability.set(capabilityId, {
      magnitude: 0,
      supportingEvidenceIds: new Set<string>(),
      hasVerified: false,
    });
  }

  for (const artifact of artifacts) {
    const mappedCapabilities = artifactTypeToCapabilities[artifact.artifact_type] ?? [];
    if (mappedCapabilities.length === 0) continue;
    const verificationState = toVerificationState(artifact.artifact_data.verification_status);
    const contribution = contributionWeightByVerificationState[verificationState];

    for (const capabilityId of mappedCapabilities) {
      const current = evidenceByCapability.get(capabilityId);
      if (!current) continue;
      current.magnitude = clamp01(current.magnitude + contribution);
      current.supportingEvidenceIds.add(artifact.artifact_id);
      if (verificationState === "verified") current.hasVerified = true;
    }
  }

  const axes: CapabilityProfileFitAxis[] = targetCapabilityIds.map((capabilityId) => {
    const targetMagnitude =
      weightedCapabilityIds.length > 0 && maxWeight > 0 ? clamp01(weights[capabilityId] / maxWeight) : 1;
    const evidenceState = evidenceByCapability.get(capabilityId) ?? {
      magnitude: 0,
      supportingEvidenceIds: new Set<string>(),
      hasVerified: false,
    };

    return {
      capability_id: capabilityId,
      label: capabilityLabel(capabilityId),
      target_magnitude: targetMagnitude,
      evidence_magnitude: clamp01(evidenceState.magnitude),
      evidence_state: evidenceState.magnitude <= 0 ? "missing" : evidenceState.hasVerified ? "strong" : "tentative",
      supporting_evidence_count: evidenceState.supportingEvidenceIds.size,
    };
  });

  return {
    capability_profile_id: profile.capability_profile_id,
    company_label: profile.company_label,
    role_label: profile.role_label,
    axes,
    generated_at: new Date().toISOString(),
    evidence_freshness_marker: evidenceFreshnessMarker,
  };
};
