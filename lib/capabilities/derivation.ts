type VerificationState = "verified" | "pending" | "unverified";

export type CapabilityClass = "soft_skill" | "role_capability" | "fallback";

export type CapabilityDefinition = {
  capability_id: string;
  label: string;
  capability_class: CapabilityClass;
};

export type DerivationArtifact = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  updated_at: string | null;
};

export type CapabilityAxis = CapabilityDefinition & {
  covered: boolean;
  supporting_evidence_ids: string[];
  verification_breakdown: Record<VerificationState, number>;
};

export type CapabilityDerivationResult = {
  selected_role_capability_ids: string[];
  axes: CapabilityAxis[];
  unmapped_artifact_ids: string[];
  kpis: {
    capability_coverage_percent: number;
    verified_evidence_share: number;
    pending_unverified_share: number;
    last_updated_at: string | null;
    evidence_count: number;
    total_linked_evidence: number;
  };
};

export type RoleCapabilityMap = Record<string, string[]>;

const UNIVERSAL_SOFT_SKILLS: CapabilityDefinition[] = [
  { capability_id: "communication", label: "Communication", capability_class: "soft_skill" },
  { capability_id: "collaboration", label: "Collaboration", capability_class: "soft_skill" },
  { capability_id: "execution_reliability", label: "Execution Reliability", capability_class: "soft_skill" },
];

const CAPABILITY_DEFINITIONS_BY_ID: Record<string, CapabilityDefinition> = {
  communication: { capability_id: "communication", label: "Communication", capability_class: "soft_skill" },
  collaboration: { capability_id: "collaboration", label: "Collaboration", capability_class: "soft_skill" },
  execution_reliability: {
    capability_id: "execution_reliability",
    label: "Execution Reliability",
    capability_class: "soft_skill",
  },
  technical_depth: { capability_id: "technical_depth", label: "Technical Depth", capability_class: "role_capability" },
  systems_thinking: { capability_id: "systems_thinking", label: "Systems Thinking", capability_class: "role_capability" },
  data_management: { capability_id: "data_management", label: "Data Management", capability_class: "role_capability" },
  product_analytics: {
    capability_id: "product_analytics",
    label: "Product Analytics",
    capability_class: "role_capability",
  },
  research_methodology: {
    capability_id: "research_methodology",
    label: "Research Methodology",
    capability_class: "role_capability",
  },
  leadership: { capability_id: "leadership", label: "Leadership", capability_class: "role_capability" },
  other_evidence: { capability_id: "other_evidence", label: "Other Evidence", capability_class: "fallback" },
};

const ROLE_CAPABILITY_MAP: Record<string, string[]> = {
  "data analyst": ["data_management", "systems_thinking", "product_analytics", "communication"],
  "data scientist": ["technical_depth", "data_management", "research_methodology", "systems_thinking"],
  "product designer": ["communication", "collaboration", "systems_thinking", "product_analytics"],
  "software engineer": ["technical_depth", "systems_thinking", "execution_reliability", "collaboration"],
  "product manager": ["communication", "collaboration", "systems_thinking", "product_analytics"],
  "associate consultant": ["communication", "systems_thinking", "collaboration", "leadership"],
};

const ARTIFACT_TYPE_TO_CAPABILITIES: Record<string, string[]> = {
  // TODO(stu-evidence): Move beyond artifact-type defaults to artifact-level signal extraction
  // validated against the active role capability set.
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

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRoleKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");
const normalizeCapabilityKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
const capabilityLabelFromId = (value: string): string =>
  normalizeCapabilityKey(value)
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

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
  requiredCapabilityIds,
}: {
  mappedCapabilityIds: string[];
  requiredCapabilityIds: string[];
}): string[] => {
  if (mappedCapabilityIds.length === 0) return [];

  const requiredIdsByFamily = new Map<CapabilityFamily, Set<string>>();
  for (const requiredCapabilityId of requiredCapabilityIds) {
    const family = resolveCapabilityFamily(requiredCapabilityId);
    if (!family) continue;
    const existing = requiredIdsByFamily.get(family) ?? new Set<string>();
    existing.add(requiredCapabilityId);
    requiredIdsByFamily.set(family, existing);
  }

  const expanded = new Set<string>();
  for (const mappedCapabilityId of mappedCapabilityIds) {
    expanded.add(mappedCapabilityId);
    const family = resolveCapabilityFamily(mappedCapabilityId);
    if (!family) continue;
    const familyRequired = requiredIdsByFamily.get(family);
    if (!familyRequired) continue;
    for (const capabilityId of familyRequired) expanded.add(capabilityId);
  }

  return Array.from(expanded.values());
};

export const resolveRoleCapabilityIds = (roles: string[], roleCapabilityMap: RoleCapabilityMap = ROLE_CAPABILITY_MAP): string[] => {
  const unique = new Set<string>();
  for (const role of roles) {
    const normalized = normalizeRoleKey(role);
    const mapped = roleCapabilityMap[normalized] ?? [];
    for (const capabilityId of mapped) unique.add(capabilityId);
  }
  return Array.from(unique.values());
};

const resolveVerificationState = (artifact: DerivationArtifact): VerificationState => {
  const raw = toTrimmedString(artifact.artifact_data.verification_status)?.toLowerCase();
  if (raw === "verified" || raw === "pending" || raw === "unverified") return raw;
  return "unverified";
};

const toIsoTimestamp = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createEmptyBreakdown = (): Record<VerificationState, number> => ({
  verified: 0,
  pending: 0,
  unverified: 0,
});

const createAxis = (definition: CapabilityDefinition): CapabilityAxis => ({
  ...definition,
  covered: false,
  supporting_evidence_ids: [],
  verification_breakdown: createEmptyBreakdown(),
});

export const deriveCapabilitiesFromEvidence = ({
  selectedRoles,
  artifacts,
  roleCapabilityMap,
  explicitRequiredCapabilityIds,
}: {
  selectedRoles: string[];
  artifacts: DerivationArtifact[];
  roleCapabilityMap?: RoleCapabilityMap;
  explicitRequiredCapabilityIds?: string[];
}): CapabilityDerivationResult => {
  const roleCapabilityIds = resolveRoleCapabilityIds(selectedRoles, roleCapabilityMap ?? ROLE_CAPABILITY_MAP);
  const explicitCapabilityIds =
    explicitRequiredCapabilityIds
      ?.filter((capabilityId) => typeof capabilityId === "string")
      .map((capabilityId) => capabilityId.trim())
      .filter((capabilityId) => capabilityId.length > 0) ?? [];
  const requiredCapabilityIds =
    explicitCapabilityIds.length > 0
      ? Array.from(new Set(explicitCapabilityIds))
      : Array.from(
          new Set([
            ...UNIVERSAL_SOFT_SKILLS.map((capability) => capability.capability_id),
            ...roleCapabilityIds,
          ])
        );

  const axesById = new Map<string, CapabilityAxis>();
  for (const capabilityId of requiredCapabilityIds) {
    const definition = CAPABILITY_DEFINITIONS_BY_ID[capabilityId] ?? {
      capability_id: capabilityId,
      label: capabilityLabelFromId(capabilityId) || capabilityId,
      capability_class: "role_capability" as const,
    };
    axesById.set(capabilityId, createAxis(definition));
  }

  const unmappedArtifactIds: string[] = [];

  for (const artifact of artifacts) {
    const mappedCapabilityIds = expandMappedCapabilityIds({
      mappedCapabilityIds: ARTIFACT_TYPE_TO_CAPABILITIES[artifact.artifact_type] ?? [],
      requiredCapabilityIds,
    });
    const verificationState = resolveVerificationState(artifact);

    if (mappedCapabilityIds.length === 0) {
      unmappedArtifactIds.push(artifact.artifact_id);
      continue;
    }

    for (const capabilityId of mappedCapabilityIds) {
      const axis = axesById.get(capabilityId);
      if (!axis) continue; // Axis set is fixed: soft-skill baseline + selected-role union.
      axis.covered = true;
      axis.supporting_evidence_ids.push(artifact.artifact_id);
      axis.verification_breakdown[verificationState] += 1;
    }
  }

  const axes = Array.from(axesById.values()).map((axis) => ({
    ...axis,
    supporting_evidence_ids: Array.from(new Set(axis.supporting_evidence_ids)),
  }));

  const requiredAxes = axes.filter((axis) => axis.capability_class !== "fallback");
  const coveredRequiredAxes = requiredAxes.filter((axis) => axis.covered);
  const capabilityCoveragePercent =
    requiredAxes.length === 0 ? 0 : Math.round((coveredRequiredAxes.length / requiredAxes.length) * 100);

  let totalLinkedEvidence = 0;
  let totalVerifiedEvidence = 0;
  let totalPendingUnverifiedEvidence = 0;

  for (const axis of requiredAxes) {
    const { verified, pending, unverified } = axis.verification_breakdown;
    totalLinkedEvidence += verified + pending + unverified;
    totalVerifiedEvidence += verified;
    totalPendingUnverifiedEvidence += pending + unverified;
  }

  const verifiedEvidenceShare =
    totalLinkedEvidence === 0 ? 0 : Number((totalVerifiedEvidence / totalLinkedEvidence).toFixed(4));
  const pendingUnverifiedShare =
    totalLinkedEvidence === 0 ? 0 : Number((totalPendingUnverifiedEvidence / totalLinkedEvidence).toFixed(4));

  const sortedByUpdated = artifacts
    .slice()
    .sort((first, second) => toIsoTimestamp(second.updated_at) - toIsoTimestamp(first.updated_at));

  return {
    selected_role_capability_ids: roleCapabilityIds,
    axes,
    unmapped_artifact_ids: unmappedArtifactIds,
    kpis: {
      capability_coverage_percent: capabilityCoveragePercent,
      verified_evidence_share: verifiedEvidenceShare,
      pending_unverified_share: pendingUnverifiedShare,
      last_updated_at: sortedByUpdated[0]?.updated_at ?? null,
      evidence_count: artifacts.length,
      total_linked_evidence: totalLinkedEvidence,
    },
  };
};
