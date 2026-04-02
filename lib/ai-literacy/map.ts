import { createHash } from "node:crypto";

export type AiLiteracyMapStatus =
  | "not_started"
  | "in_progress"
  | "partial_available"
  | "available"
  | "needs_attention";

export type AiLiteracyEvaluationTrigger =
  | "initial_generation"
  | "artifact_added"
  | "artifact_updated"
  | "artifact_deactivated"
  | "verification_changed"
  | "role_lens_changed"
  | "framework_changed"
  | "manual_refresh"
  | "scheduled_recheck";

export type AiLiteracySufficiencyClass = "insufficient" | "limited" | "moderate" | "strong";
export type AiLiteracyLevel = "Awareness" | "Foundational Use" | "Applied Judgment" | "Strategic Fluency";

type DomainRelevance = "core" | "expected" | "optional";

type RoleFamilyId =
  | "software_engineering"
  | "product_management"
  | "recruiting_ops"
  | "support_cx"
  | "business_ops_analyst";

export type AiLiteracyArtifactInput = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  updated_at: string | null;
  source_provenance?: Record<string, unknown>;
};

export type AiLiteracyRoleLens = {
  role_family: RoleFamilyId;
  role_labels: string[];
  role_lens_key: string;
  domain_relevance: Record<string, DomainRelevance>;
};

type DomainDefinition = {
  domain_id: string;
  label: string;
  universal: boolean;
};

type DomainSignalCounts = {
  observed_count: number;
  observed_non_self_asserted_count: number;
  inferred_count: number;
  candidate_stated_count: number;
  corroborated_candidate_stated_count: number;
};

type DomainAccumulator = {
  domain_id: string;
  label: string;
  relevance: DomainRelevance;
  supporting_evidence_refs: Array<{
    artifact_id: string;
    verification_status: "verified" | "pending" | "unverified";
    source: string | null;
    observed_non_self_asserted: boolean;
    updated_at: string | null;
  }>;
  observed_count: number;
  observed_non_self_asserted_count: number;
  candidate_stated_count: number;
  inferred_count: number;
  candidate_sources: Set<string>;
  concrete_output_count: number;
};

export type AiLiteracyDomainBreakdown = {
  domain_id: string;
  label: string;
  relevance: DomainRelevance;
  sufficiency_class: AiLiteracySufficiencyClass;
  indicative_level: AiLiteracyLevel;
  signal_mix: DomainSignalCounts & {
    missing_signal: boolean;
  };
  supporting_evidence_refs: Array<{
    artifact_id: string;
    verification_status: "verified" | "pending" | "unverified";
    source: string | null;
    observed_non_self_asserted: boolean;
    updated_at: string | null;
  }>;
  explanation: string;
};

export type AiLiteracyDerivationResult = {
  status: AiLiteracyMapStatus;
  role_lens: AiLiteracyRoleLens;
  profile_coverage_percent: number;
  recruiter_safe_coverage_percent: number;
  total_role_relevant_domains: number;
  domains_with_profile_signal: number;
  domains_with_recruiter_safe_signal: number;
  overall_indicative_literacy_level: AiLiteracyLevel;
  confidence: {
    class: "insufficient" | "limited" | "moderate" | "strong";
    score: number;
  };
  evidence_sufficiency: {
    class: "insufficient" | "limited" | "moderate" | "strong";
    summary: string;
  };
  domain_breakdown: AiLiteracyDomainBreakdown[];
  supporting_evidence_refs: AiLiteracyDomainBreakdown["supporting_evidence_refs"];
  inferred_observations: string[];
  candidate_stated_claims: string[];
  missing_signal_areas: string[];
  recommendations: string[];
  evidence_snapshot_hash: string;
  generated_at: string;
  evaluated_at: string;
  model_metadata: {
    evaluator_model: string;
    prompt_template_version: string;
    framework_version: string;
    policy_version: string;
  };
};

type AiLiteracyVersionRow = {
  ai_literacy_map_version_id: string;
  ai_literacy_map_id: string;
  profile_id: string;
  version_number: number;
  status: AiLiteracyMapStatus;
  evaluation_trigger?: AiLiteracyEvaluationTrigger | null;
  evidence_snapshot_hash: string | null;
  profile_coverage_percent: number;
  recruiter_safe_coverage_percent: number;
  overall_indicative_literacy_level: AiLiteracyLevel | null;
  confidence: Record<string, unknown>;
  selected_role_lens: Record<string, unknown>;
  domain_breakdown: unknown;
  evaluated_at: string;
  created_at: string;
};

type AiLiteracyMapHeadRow = {
  ai_literacy_map_id: string;
  profile_id: string;
  role_lens_key: string;
  current_version_id: string | null;
  latest_version_number: number;
  status: AiLiteracyMapStatus;
  generated_at: string | null;
  last_evaluated_at: string | null;
};

type SupabaseQueryLike = {
  select: (...args: unknown[]) => SupabaseQueryLike;
  eq: (...args: unknown[]) => SupabaseQueryLike;
  limit: (...args: unknown[]) => SupabaseQueryLike;
  order: (...args: unknown[]) => SupabaseQueryLike;
  insert: (...args: unknown[]) => SupabaseQueryLike;
  update: (...args: unknown[]) => SupabaseQueryLike;
  single: (...args: unknown[]) => SupabaseQueryLike;
};

type SupabaseLike = {
  from: (table: string) => unknown;
};

const tableQuery = (supabase: SupabaseLike, table: string): SupabaseQueryLike =>
  supabase.from(table) as unknown as SupabaseQueryLike;

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    domain_id: "ai_conceptual_awareness",
    label: "AI Conceptual Awareness",
    universal: true,
  },
  {
    domain_id: "prompting_interaction_quality",
    label: "Prompting & Interaction Quality",
    universal: true,
  },
  {
    domain_id: "output_evaluation_judgment",
    label: "Output Evaluation & Judgment",
    universal: true,
  },
  {
    domain_id: "workflow_integration",
    label: "Workflow Integration",
    universal: true,
  },
  {
    domain_id: "governance_safety_risk_awareness",
    label: "Governance, Safety & Risk Awareness",
    universal: true,
  },
  {
    domain_id: "role_context_ai_application",
    label: "Role-Context AI Application",
    universal: true,
  },
  {
    domain_id: "automation_workflow_building",
    label: "Automation & Workflow Building",
    universal: false,
  },
  {
    domain_id: "doc_intelligence_knowledge_workflows",
    label: "Doc Intelligence & Knowledge Workflows",
    universal: false,
  },
  {
    domain_id: "workspace_productivity_ai_tools",
    label: "Workspace Productivity with AI Tools",
    universal: false,
  },
  {
    domain_id: "coding_ai_assisted_software_development",
    label: "Coding Tools / AI-Assisted Development",
    universal: false,
  },
  {
    domain_id: "agent_tool_orchestration_concepts",
    label: "Agent / Tool Orchestration Concepts",
    universal: false,
  },
];

const DOMAIN_BY_ID = new Map(DOMAIN_DEFINITIONS.map((domain) => [domain.domain_id, domain]));

const ROLE_FAMILY_EXTENSIONS: Record<RoleFamilyId, Record<string, DomainRelevance>> = {
  software_engineering: {
    automation_workflow_building: "expected",
    doc_intelligence_knowledge_workflows: "expected",
    workspace_productivity_ai_tools: "expected",
    coding_ai_assisted_software_development: "core",
    agent_tool_orchestration_concepts: "expected",
  },
  product_management: {
    automation_workflow_building: "expected",
    doc_intelligence_knowledge_workflows: "core",
    workspace_productivity_ai_tools: "expected",
    coding_ai_assisted_software_development: "optional",
    agent_tool_orchestration_concepts: "optional",
  },
  recruiting_ops: {
    automation_workflow_building: "expected",
    doc_intelligence_knowledge_workflows: "core",
    workspace_productivity_ai_tools: "core",
    coding_ai_assisted_software_development: "optional",
    agent_tool_orchestration_concepts: "optional",
  },
  support_cx: {
    automation_workflow_building: "expected",
    doc_intelligence_knowledge_workflows: "core",
    workspace_productivity_ai_tools: "core",
    coding_ai_assisted_software_development: "optional",
    agent_tool_orchestration_concepts: "optional",
  },
  business_ops_analyst: {
    automation_workflow_building: "expected",
    doc_intelligence_knowledge_workflows: "core",
    workspace_productivity_ai_tools: "core",
    coding_ai_assisted_software_development: "optional",
    agent_tool_orchestration_concepts: "optional",
  },
};

const ARTIFACT_TYPE_DOMAIN_MAP: Record<string, string[]> = {
  coursework: ["ai_conceptual_awareness", "role_context_ai_application"],
  project: ["workflow_integration", "output_evaluation_judgment", "role_context_ai_application"],
  internship: ["workflow_integration", "role_context_ai_application", "output_evaluation_judgment"],
  employment: ["workflow_integration", "role_context_ai_application", "output_evaluation_judgment"],
  certification: ["ai_conceptual_awareness", "role_context_ai_application"],
  test: ["ai_conceptual_awareness", "role_context_ai_application"],
  leadership: ["role_context_ai_application", "workflow_integration"],
  club: ["role_context_ai_application", "workflow_integration"],
  competition: ["output_evaluation_judgment", "ai_conceptual_awareness", "role_context_ai_application"],
  research: ["output_evaluation_judgment", "ai_conceptual_awareness", "role_context_ai_application"],
  application_record: ["role_context_ai_application"],
};

const KEYWORDS: Record<string, string[]> = {
  prompting_interaction_quality: ["prompt", "chatgpt", "claude", "llm", "instruction", "few-shot"],
  output_evaluation_judgment: ["evaluate", "validation", "review", "quality", "judge", "benchmark", "test"],
  governance_safety_risk_awareness: ["safety", "risk", "governance", "compliance", "privacy", "bias", "hallucination"],
  automation_workflow_building: ["automation", "workflow", "zapier", "n8n", "airflow", "pipeline", "orchestrate"],
  doc_intelligence_knowledge_workflows: ["documentation", "knowledge base", "confluence", "notion", "retrieval", "summar"],
  workspace_productivity_ai_tools: ["copilot", "workspace", "slack", "notion ai", "assistant", "productivity"],
  coding_ai_assisted_software_development: ["github", "code", "typescript", "python", "javascript", "refactor", "pr", "copilot"],
  agent_tool_orchestration_concepts: ["agent", "tool calling", "mcp", "orchestration", "skills", "function calling"],
  ai_conceptual_awareness: ["model", "token", "context window", "llm", "inference", "ai"],
};

const SELF_ASSERTED_SOURCES = ["resume", "linkedin", "manual", "self", "self-asserted", "profile"];
const OBSERVED_SOURCES = [
  "github",
  "kaggle",
  "leetcode",
  "transcript",
  "portfolio",
  "credential",
  "ats",
  "work sample",
  "application",
];

const MODEL_METADATA = {
  evaluator_model: "heuristic-v1",
  prompt_template_version: "alm_v1",
  framework_version: "ai_literacy_framework_v1",
  policy_version: "trust_guardrails_v1",
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const normalizeRole = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const resolveVerificationStatus = (artifactData: Record<string, unknown>): "verified" | "pending" | "unverified" => {
  const status = normalizeText(toTrimmedString(artifactData.verification_status) ?? "unverified");
  if (status === "verified" || status === "pending" || status === "unverified") return status;
  return "unverified";
};

const resolveSourceLabel = (artifact: AiLiteracyArtifactInput): string | null => {
  const fromData = toTrimmedString(artifact.artifact_data.source);
  if (fromData) return fromData;
  const provenance = artifact.source_provenance ?? toRecord(artifact.artifact_data.provenance);
  return toTrimmedString(provenance.source);
};

const isConcreteOutput = (artifactData: Record<string, unknown>): boolean => {
  const urlLike = [artifactData.url, artifactData.link, artifactData.project_demo_link, artifactData.profile_url]
    .map((value) => toTrimmedString(value))
    .some(Boolean);
  if (urlLike) return true;

  const tags = Array.isArray(artifactData.tags) ? artifactData.tags : [];
  const skills = Array.isArray(artifactData.skills) ? artifactData.skills : [];
  return tags.length > 0 || skills.length > 0;
};

const deriveRoleFamily = (selectedRoles: string[]): RoleFamilyId => {
  const normalizedRoles = selectedRoles.map(normalizeRole);
  const score = {
    software_engineering: 0,
    product_management: 0,
    recruiting_ops: 0,
    support_cx: 0,
    business_ops_analyst: 0,
  } satisfies Record<RoleFamilyId, number>;

  for (const role of normalizedRoles) {
    if (
      role.includes("software") ||
      role.includes("engineer") ||
      role.includes("developer") ||
      role.includes("devops") ||
      role.includes("full stack") ||
      role.includes("backend") ||
      role.includes("frontend")
    ) {
      score.software_engineering += 2;
    }
    if (role.includes("product manager") || role.includes("product management")) {
      score.product_management += 2;
    }
    if (role.includes("recruit") || role.includes("talent") || role.includes("sourcer")) {
      score.recruiting_ops += 2;
    }
    if (role.includes("support") || role.includes("customer success") || role.includes("cx")) {
      score.support_cx += 2;
    }
    if (
      role.includes("analyst") ||
      role.includes("operations") ||
      role.includes("consultant") ||
      role.includes("business")
    ) {
      score.business_ops_analyst += 1;
    }
  }

  const sorted = Object.entries(score).sort((first, second) => second[1] - first[1]);
  const winner = sorted[0];
  if (!winner || winner[1] <= 0) {
    return "business_ops_analyst";
  }
  return winner[0] as RoleFamilyId;
};

export const buildAiLiteracyRoleLens = (selectedRoles: string[]): AiLiteracyRoleLens => {
  const dedupedRoleLabels = Array.from(
    new Set(
      selectedRoles
        .map((role) => toTrimmedString(role))
        .filter((role): role is string => Boolean(role))
    )
  );

  const roleFamily = deriveRoleFamily(dedupedRoleLabels);
  const roleLensKey =
    dedupedRoleLabels.length > 0
      ? `${roleFamily}:${dedupedRoleLabels.map(normalizeRole).sort().join("|")}`
      : `${roleFamily}:baseline`;

  const domainRelevance: Record<string, DomainRelevance> = {};
  for (const domain of DOMAIN_DEFINITIONS) {
    if (domain.universal) {
      domainRelevance[domain.domain_id] = "core";
      continue;
    }
    domainRelevance[domain.domain_id] = ROLE_FAMILY_EXTENSIONS[roleFamily][domain.domain_id] ?? "optional";
  }

  return {
    role_family: roleFamily,
    role_labels: dedupedRoleLabels,
    role_lens_key: roleLensKey,
    domain_relevance: domainRelevance,
  };
};

const resolveDomainCandidates = (artifact: AiLiteracyArtifactInput): Set<string> => {
  const domainIds = new Set<string>(ARTIFACT_TYPE_DOMAIN_MAP[artifact.artifact_type] ?? []);

  const text = [
    toTrimmedString(artifact.artifact_data.title),
    toTrimmedString(artifact.artifact_data.description),
    toTrimmedString(artifact.artifact_data.source),
    Array.isArray(artifact.artifact_data.tags)
      ? (artifact.artifact_data.tags as unknown[]).filter((item) => typeof item === "string").join(" ")
      : "",
    Array.isArray(artifact.artifact_data.skills)
      ? (artifact.artifact_data.skills as unknown[]).filter((item) => typeof item === "string").join(" ")
      : "",
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();

  for (const [domainId, patterns] of Object.entries(KEYWORDS)) {
    if (patterns.some((pattern) => text.includes(pattern))) {
      domainIds.add(domainId);
    }
  }

  if (domainIds.size === 0) {
    domainIds.add("role_context_ai_application");
  }

  return domainIds;
};

const resolveSignalClass = (artifact: AiLiteracyArtifactInput): {
  sourceLabel: string | null;
  verificationStatus: "verified" | "pending" | "unverified";
  observed: boolean;
  observedNonSelfAsserted: boolean;
  candidateStated: boolean;
} => {
  const verificationStatus = resolveVerificationStatus(artifact.artifact_data);
  const sourceLabel = resolveSourceLabel(artifact);
  const normalizedSource = normalizeText(sourceLabel ?? "");

  const sourceLooksSelfAsserted = SELF_ASSERTED_SOURCES.some((token) => normalizedSource.includes(token));
  const sourceLooksObserved = OBSERVED_SOURCES.some((token) => normalizedSource.includes(token));

  if (verificationStatus === "verified" || verificationStatus === "pending") {
    return {
      sourceLabel,
      verificationStatus,
      observed: true,
      observedNonSelfAsserted: true,
      candidateStated: false,
    };
  }

  if (sourceLooksObserved) {
    return {
      sourceLabel,
      verificationStatus,
      observed: true,
      observedNonSelfAsserted: true,
      candidateStated: false,
    };
  }

  if (sourceLooksSelfAsserted) {
    return {
      sourceLabel,
      verificationStatus,
      observed: false,
      observedNonSelfAsserted: false,
      candidateStated: true,
    };
  }

  return {
    sourceLabel,
    verificationStatus,
    observed: false,
    observedNonSelfAsserted: false,
    candidateStated: true,
  };
};

const toSufficiencyClass = (input: {
  observedNonSelfAssertedCount: number;
  candidateStatedCount: number;
  corroboratedCandidateStatedCount: number;
}): AiLiteracySufficiencyClass => {
  if (input.observedNonSelfAssertedCount >= 2) return "strong";
  if (input.observedNonSelfAssertedCount >= 1) return "moderate";
  if (input.candidateStatedCount > 0) return "limited";
  return "insufficient";
};

const toIndicativeLevel = (input: {
  domainId: string;
  sufficiencyClass: AiLiteracySufficiencyClass;
}): AiLiteracyLevel => {
  if (input.sufficiencyClass === "insufficient") return "Awareness";
  if (input.sufficiencyClass === "limited") return "Awareness";
  if (input.sufficiencyClass === "moderate") return "Foundational Use";

  if (
    input.domainId === "automation_workflow_building" ||
    input.domainId === "coding_ai_assisted_software_development" ||
    input.domainId === "agent_tool_orchestration_concepts"
  ) {
    return "Strategic Fluency";
  }

  return "Applied Judgment";
};

const toExplanation = (input: {
  domainLabel: string;
  sufficiencyClass: AiLiteracySufficiencyClass;
  observedCount: number;
  candidateStatedCount: number;
  observedNonSelfAssertedCount: number;
}): string => {
  if (input.sufficiencyClass === "insufficient") {
    return `No meaningful signal yet for ${input.domainLabel}.`;
  }
  if (input.sufficiencyClass === "limited") {
    return `${input.domainLabel} currently relies on early or candidate-stated evidence and needs stronger corroboration.`;
  }
  if (input.sufficiencyClass === "moderate") {
    return `${input.domainLabel} has credible observed support with room for broader evidence depth.`;
  }
  if (input.observedNonSelfAssertedCount >= 2) {
    return `${input.domainLabel} is backed by multiple observed non-self-asserted signals.`;
  }
  return `${input.domainLabel} has strong support.`;
};

const deriveOverallLevel = (input: {
  recruiterSafeCoveragePercent: number;
  profileCoveragePercent: number;
  relevantBreakdowns: AiLiteracyDomainBreakdown[];
}): AiLiteracyLevel => {
  if (input.relevantBreakdowns.length === 0) return "Awareness";

  const scoreByClass: Record<AiLiteracySufficiencyClass, number> = {
    insufficient: 0,
    limited: 1,
    moderate: 2,
    strong: 3,
  };

  const averageScore =
    input.relevantBreakdowns.reduce((sum, breakdown) => sum + scoreByClass[breakdown.sufficiency_class], 0) /
    input.relevantBreakdowns.length;

  if (input.recruiterSafeCoveragePercent >= 70 && averageScore >= 2.5) return "Strategic Fluency";
  if (input.recruiterSafeCoveragePercent >= 40 || averageScore >= 2) return "Applied Judgment";
  if (input.profileCoveragePercent >= 25 || averageScore >= 1) return "Foundational Use";
  return "Awareness";
};

const deriveConfidence = (input: {
  profileCoveragePercent: number;
  recruiterSafeCoveragePercent: number;
  relevantBreakdowns: AiLiteracyDomainBreakdown[];
}) => {
  const observedNonSelfAssertedDomains = input.relevantBreakdowns.filter(
    (breakdown) => breakdown.signal_mix.observed_non_self_asserted_count > 0
  ).length;
  const observedRatio = input.relevantBreakdowns.length === 0 ? 0 : observedNonSelfAssertedDomains / input.relevantBreakdowns.length;

  const score = Number(((input.profileCoveragePercent / 100) * 0.55 + (input.recruiterSafeCoveragePercent / 100) * 0.3 + observedRatio * 0.15).toFixed(4));

  const confidenceClass =
    score >= 0.75
      ? "strong"
      : score >= 0.5
        ? "moderate"
        : score >= 0.25
          ? "limited"
          : "insufficient";

  const evidenceSufficiencyClass =
    input.profileCoveragePercent >= 70 && input.recruiterSafeCoveragePercent >= 50
      ? "strong"
      : input.profileCoveragePercent >= 40 && input.recruiterSafeCoveragePercent >= 20
        ? "moderate"
        : input.profileCoveragePercent >= 15
          ? "limited"
          : "insufficient";

  return {
    confidence: {
      class: confidenceClass,
      score,
    } as AiLiteracyDerivationResult["confidence"],
    evidence_sufficiency: {
      class: evidenceSufficiencyClass,
      summary:
        evidenceSufficiencyClass === "strong"
          ? "Broad and externally interpretable evidence coverage."
          : evidenceSufficiencyClass === "moderate"
            ? "Credible evidence present with remaining depth gaps."
            : evidenceSufficiencyClass === "limited"
              ? "Early signal exists but requires stronger evidence."
              : "Insufficient evidence to support interpretation.",
    } as AiLiteracyDerivationResult["evidence_sufficiency"],
  };
};

const extractCandidateClaim = (artifact: AiLiteracyArtifactInput): string | null => {
  const title = toTrimmedString(artifact.artifact_data.title) ?? toTrimmedString(artifact.artifact_data.project_title);
  const description = toTrimmedString(artifact.artifact_data.description);
  if (title && description) return `${title}: ${description}`;
  return title ?? description ?? null;
};

const buildEvidenceSnapshotHash = (input: {
  artifacts: AiLiteracyArtifactInput[];
  roleLens: AiLiteracyRoleLens;
}): string => {
  const payload = {
    framework_version: MODEL_METADATA.framework_version,
    role_lens_key: input.roleLens.role_lens_key,
    artifacts: input.artifacts
      .slice()
      .sort((first, second) => first.artifact_id.localeCompare(second.artifact_id))
      .map((artifact) => ({
        artifact_id: artifact.artifact_id,
        artifact_type: artifact.artifact_type,
        updated_at: artifact.updated_at,
        verification_status: resolveVerificationStatus(artifact.artifact_data),
      })),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

export function deriveAiLiteracyMap(input: {
  artifacts: AiLiteracyArtifactInput[];
  selectedRoles: string[];
}): AiLiteracyDerivationResult {
  const nowIso = new Date().toISOString();
  const roleLens = buildAiLiteracyRoleLens(input.selectedRoles);
  const roleRelevantDomainIds = DOMAIN_DEFINITIONS.filter((domain) => {
    const relevance = roleLens.domain_relevance[domain.domain_id] ?? "optional";
    return domain.universal || relevance === "core" || relevance === "expected";
  }).map((domain) => domain.domain_id);

  const domainAccumulators = new Map<string, DomainAccumulator>();
  for (const domainId of roleRelevantDomainIds) {
    const definition = DOMAIN_BY_ID.get(domainId);
    if (!definition) continue;
    domainAccumulators.set(domainId, {
      domain_id: domainId,
      label: definition.label,
      relevance: roleLens.domain_relevance[domainId] ?? "optional",
      supporting_evidence_refs: [],
      observed_count: 0,
      observed_non_self_asserted_count: 0,
      candidate_stated_count: 0,
      inferred_count: 0,
      candidate_sources: new Set(),
      concrete_output_count: 0,
    });
  }

  const candidateStatedClaims = new Set<string>();

  for (const artifact of input.artifacts) {
    const domainCandidates = resolveDomainCandidates(artifact);
    const signal = resolveSignalClass(artifact);

    for (const domainId of domainCandidates) {
      const accumulator = domainAccumulators.get(domainId);
      if (!accumulator) continue;

      if (signal.observed) accumulator.observed_count += 1;
      if (signal.observedNonSelfAsserted) accumulator.observed_non_self_asserted_count += 1;
      if (signal.candidateStated) {
        accumulator.candidate_stated_count += 1;
        if (signal.sourceLabel) accumulator.candidate_sources.add(normalizeText(signal.sourceLabel));

        const claim = extractCandidateClaim(artifact);
        if (claim) candidateStatedClaims.add(claim);
      }

      if (isConcreteOutput(artifact.artifact_data)) {
        accumulator.concrete_output_count += 1;
      }

      accumulator.supporting_evidence_refs.push({
        artifact_id: artifact.artifact_id,
        verification_status: signal.verificationStatus,
        source: signal.sourceLabel,
        observed_non_self_asserted: signal.observedNonSelfAsserted,
        updated_at: artifact.updated_at,
      });

      if (signal.observedNonSelfAsserted) {
        accumulator.inferred_count += 1;
      }
    }
  }

  const breakdowns: AiLiteracyDomainBreakdown[] = [];

  for (const domainId of roleRelevantDomainIds) {
    const accumulator = domainAccumulators.get(domainId);
    if (!accumulator) continue;

    const corroboratedCandidateStatedCount =
      accumulator.candidate_stated_count > 0 &&
      (accumulator.candidate_sources.size >= 2 ||
        accumulator.concrete_output_count > 0 ||
        accumulator.observed_non_self_asserted_count > 0)
        ? accumulator.candidate_stated_count
        : 0;

    const sufficiencyClass = toSufficiencyClass({
      observedNonSelfAssertedCount: accumulator.observed_non_self_asserted_count,
      candidateStatedCount: accumulator.candidate_stated_count,
      corroboratedCandidateStatedCount,
    });

    const indicativeLevel = toIndicativeLevel({
      domainId,
      sufficiencyClass,
    });

    const supportingEvidenceRefs = accumulator.supporting_evidence_refs
      .slice()
      .sort((first, second) => Date.parse(second.updated_at ?? "") - Date.parse(first.updated_at ?? ""))
      .slice(0, 8);

    breakdowns.push({
      domain_id: accumulator.domain_id,
      label: accumulator.label,
      relevance: accumulator.relevance,
      sufficiency_class: sufficiencyClass,
      indicative_level: indicativeLevel,
      signal_mix: {
        observed_count: accumulator.observed_count,
        observed_non_self_asserted_count: accumulator.observed_non_self_asserted_count,
        inferred_count: accumulator.inferred_count,
        candidate_stated_count: accumulator.candidate_stated_count,
        corroborated_candidate_stated_count: corroboratedCandidateStatedCount,
        missing_signal: accumulator.observed_count === 0 && accumulator.candidate_stated_count === 0,
      },
      supporting_evidence_refs: supportingEvidenceRefs,
      explanation: toExplanation({
        domainLabel: accumulator.label,
        sufficiencyClass,
        observedCount: accumulator.observed_count,
        candidateStatedCount: accumulator.candidate_stated_count,
        observedNonSelfAssertedCount: accumulator.observed_non_self_asserted_count,
      }),
    });
  }

  const totalRoleRelevantDomains = breakdowns.length;

  const domainsWithProfileSignal = breakdowns.filter((breakdown) => {
    const hasLimitedOrBetter =
      breakdown.sufficiency_class === "limited" ||
      breakdown.sufficiency_class === "moderate" ||
      breakdown.sufficiency_class === "strong";
    const hasCredibleSignal =
      breakdown.signal_mix.observed_non_self_asserted_count > 0 ||
      breakdown.signal_mix.corroborated_candidate_stated_count > 0;
    return hasLimitedOrBetter && hasCredibleSignal;
  }).length;

  const domainsWithRecruiterSafeSignal = breakdowns.filter((breakdown) => {
    const hasModerateOrStrong = breakdown.sufficiency_class === "moderate" || breakdown.sufficiency_class === "strong";
    return hasModerateOrStrong && breakdown.signal_mix.observed_non_self_asserted_count > 0;
  }).length;

  const profileCoveragePercent = clampPercent(
    totalRoleRelevantDomains === 0 ? 0 : (domainsWithProfileSignal / totalRoleRelevantDomains) * 100
  );
  const recruiterSafeCoveragePercent = clampPercent(
    totalRoleRelevantDomains === 0 ? 0 : (domainsWithRecruiterSafeSignal / totalRoleRelevantDomains) * 100
  );

  const recruiterSafeCoveragePercentBounded = Math.min(recruiterSafeCoveragePercent, profileCoveragePercent);

  const { confidence, evidence_sufficiency } = deriveConfidence({
    profileCoveragePercent,
    recruiterSafeCoveragePercent: recruiterSafeCoveragePercentBounded,
    relevantBreakdowns: breakdowns,
  });

  const overallLevel = deriveOverallLevel({
    recruiterSafeCoveragePercent: recruiterSafeCoveragePercentBounded,
    profileCoveragePercent,
    relevantBreakdowns: breakdowns,
  });

  const supportingEvidenceRefs = Array.from(
    new Map(
      breakdowns
        .flatMap((breakdown) => breakdown.supporting_evidence_refs)
        .map((ref) => [ref.artifact_id, ref])
    ).values()
  ).slice(0, 20);

  const missingSignalAreas = breakdowns
    .filter((breakdown) => breakdown.sufficiency_class === "insufficient")
    .map((breakdown) => breakdown.domain_id);

  const recommendations = breakdowns
    .filter((breakdown) => {
      if (breakdown.sufficiency_class === "insufficient") return true;
      if (breakdown.sufficiency_class === "limited" && breakdown.signal_mix.corroborated_candidate_stated_count === 0) return true;
      return false;
    })
    .slice(0, 4)
    .map((breakdown) =>
      breakdown.sufficiency_class === "insufficient"
        ? `Add at least one role-relevant artifact for ${breakdown.label}.`
        : `Strengthen ${breakdown.label} with observed non-self-asserted evidence.`
    );

  const inferredObservations = breakdowns
    .filter((breakdown) => breakdown.sufficiency_class === "moderate" || breakdown.sufficiency_class === "strong")
    .slice(0, 5)
    .map((breakdown) =>
      `${breakdown.label} shows ${breakdown.sufficiency_class === "strong" ? "strong" : "credible"} evidence support in the selected role context.`
    );

  const evidenceSnapshotHash = buildEvidenceSnapshotHash({
    artifacts: input.artifacts,
    roleLens,
  });

  const domainCountWithAnySignal = breakdowns.filter(
    (breakdown) => breakdown.signal_mix.observed_count > 0 || breakdown.signal_mix.candidate_stated_count > 0
  ).length;

  const status: AiLiteracyMapStatus =
    input.artifacts.length === 0
      ? "not_started"
      : domainsWithProfileSignal >= 2 && domainCountWithAnySignal >= 2
        ? domainsWithRecruiterSafeSignal >= 3
          ? "available"
          : "partial_available"
        : "not_started";

  return {
    status,
    role_lens: roleLens,
    profile_coverage_percent: profileCoveragePercent,
    recruiter_safe_coverage_percent: recruiterSafeCoveragePercentBounded,
    total_role_relevant_domains: totalRoleRelevantDomains,
    domains_with_profile_signal: domainsWithProfileSignal,
    domains_with_recruiter_safe_signal: domainsWithRecruiterSafeSignal,
    overall_indicative_literacy_level: overallLevel,
    confidence,
    evidence_sufficiency,
    domain_breakdown: breakdowns,
    supporting_evidence_refs: supportingEvidenceRefs,
    inferred_observations: inferredObservations,
    candidate_stated_claims: Array.from(candidateStatedClaims).slice(0, 20),
    missing_signal_areas: missingSignalAreas,
    recommendations,
    evidence_snapshot_hash: evidenceSnapshotHash,
    generated_at: nowIso,
    evaluated_at: nowIso,
    model_metadata: MODEL_METADATA,
  };
}

const toIsoStringOrNull = (value: unknown): string | null => {
  const candidate = toTrimmedString(value);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const toRoleLensRecord = (value: unknown): Record<string, unknown> => {
  const record = toRecord(value);
  return {
    role_family: toTrimmedString(record.role_family) ?? "business_ops_analyst",
    role_labels: Array.isArray(record.role_labels)
      ? record.role_labels.filter((item) => typeof item === "string").map((item) => (item as string).trim()).filter(Boolean)
      : [],
    role_lens_key: toTrimmedString(record.role_lens_key) ?? "business_ops_analyst:baseline",
    domain_relevance: toRecord(record.domain_relevance),
  };
};

export type AiLiteracyMapView = {
  ai_literacy_map_id: string;
  ai_literacy_map_version_id: string;
  profile_id: string;
  status: AiLiteracyMapStatus;
  profile_coverage_percent: number;
  recruiter_safe_coverage_percent: number;
  overall_indicative_literacy_level: AiLiteracyLevel | null;
  confidence: {
    class: "insufficient" | "limited" | "moderate" | "strong";
    score: number;
  };
  role_lens: {
    role_family: string;
    role_labels: string[];
    role_lens_key: string;
  };
  total_role_relevant_domains: number;
  domains_with_profile_signal: number;
  domains_with_recruiter_safe_signal: number;
  domain_breakdown: AiLiteracyDomainBreakdown[];
  evaluated_at: string | null;
  created_at: string | null;
};

const toAiLiteracyMapView = (row: AiLiteracyVersionRow): AiLiteracyMapView => {
  const roleLensRecord = toRoleLensRecord(row.selected_role_lens);
  const domainBreakdown = Array.isArray(row.domain_breakdown)
    ? (row.domain_breakdown as AiLiteracyDomainBreakdown[])
    : [];
  const profileSignal = domainBreakdown.filter((domain) => {
    const hasLimitedOrBetter = domain.sufficiency_class === "limited" || domain.sufficiency_class === "moderate" || domain.sufficiency_class === "strong";
    const hasCredibleSignal =
      domain.signal_mix?.observed_non_self_asserted_count > 0 || domain.signal_mix?.corroborated_candidate_stated_count > 0;
    return hasLimitedOrBetter && hasCredibleSignal;
  }).length;
  const recruiterSafeSignal = domainBreakdown.filter((domain) => {
    const hasModerateOrStrong = domain.sufficiency_class === "moderate" || domain.sufficiency_class === "strong";
    return hasModerateOrStrong && domain.signal_mix?.observed_non_self_asserted_count > 0;
  }).length;

  const confidenceRecord = toRecord(row.confidence);
  const confidenceClassRaw = toTrimmedString(confidenceRecord.class) ?? "insufficient";
  const confidenceClass =
    confidenceClassRaw === "strong" || confidenceClassRaw === "moderate" || confidenceClassRaw === "limited"
      ? confidenceClassRaw
      : "insufficient";

  return {
    ai_literacy_map_id: row.ai_literacy_map_id,
    ai_literacy_map_version_id: row.ai_literacy_map_version_id,
    profile_id: row.profile_id,
    status: row.status,
    profile_coverage_percent: Math.max(0, Math.min(100, row.profile_coverage_percent ?? 0)),
    recruiter_safe_coverage_percent: Math.max(0, Math.min(100, row.recruiter_safe_coverage_percent ?? 0)),
    overall_indicative_literacy_level: row.overall_indicative_literacy_level,
    confidence: {
      class: confidenceClass,
      score: typeof confidenceRecord.score === "number" && Number.isFinite(confidenceRecord.score)
        ? confidenceRecord.score
        : 0,
    },
    role_lens: {
      role_family: toTrimmedString(roleLensRecord.role_family) ?? "business_ops_analyst",
      role_labels: Array.isArray(roleLensRecord.role_labels)
        ? roleLensRecord.role_labels.filter((item) => typeof item === "string").map((item) => (item as string).trim()).filter(Boolean)
        : [],
      role_lens_key: toTrimmedString(roleLensRecord.role_lens_key) ?? "business_ops_analyst:baseline",
    },
    total_role_relevant_domains: domainBreakdown.length,
    domains_with_profile_signal: profileSignal,
    domains_with_recruiter_safe_signal: recruiterSafeSignal,
    domain_breakdown: domainBreakdown,
    evaluated_at: toIsoStringOrNull(row.evaluated_at),
    created_at: toIsoStringOrNull(row.created_at),
  };
};

const toVersionDeltaSummary = (input: {
  previousVersion: AiLiteracyVersionRow | null;
  nextEvaluation: AiLiteracyDerivationResult;
}) => {
  if (!input.previousVersion) {
    return {
      change_kind: "initial",
      profile_coverage_delta: input.nextEvaluation.profile_coverage_percent,
      recruiter_safe_coverage_delta: input.nextEvaluation.recruiter_safe_coverage_percent,
    };
  }

  return {
    change_kind: "reevaluation",
    profile_coverage_delta: input.nextEvaluation.profile_coverage_percent - (input.previousVersion.profile_coverage_percent ?? 0),
    recruiter_safe_coverage_delta:
      input.nextEvaluation.recruiter_safe_coverage_percent - (input.previousVersion.recruiter_safe_coverage_percent ?? 0),
    previous_status: input.previousVersion.status,
    next_status: input.nextEvaluation.status,
  };
};

export async function evaluateAndPersistAiLiteracyMap(input: {
  supabase: unknown;
  profileId: string;
  selectedRoles: string[];
  selectedCapabilityModelId?: string | null;
  artifacts: AiLiteracyArtifactInput[];
  evaluationTrigger: AiLiteracyEvaluationTrigger;
}): Promise<{ map: AiLiteracyMapView | null; persisted: boolean }> {
  const supabase = input.supabase as SupabaseLike | null;
  if (!supabase) return { map: null, persisted: false };

  const evaluation = deriveAiLiteracyMap({
    artifacts: input.artifacts,
    selectedRoles: input.selectedRoles,
  });

  const roleLensKey = evaluation.role_lens.role_lens_key;

  const { data: existingMapRows } = (await tableQuery(supabase, "ai_literacy_maps")
    .select("ai_literacy_map_id, profile_id, role_lens_key, current_version_id, latest_version_number, status, generated_at, last_evaluated_at")
    .eq("profile_id", input.profileId)
    .eq("role_lens_key", roleLensKey)
    .limit(1)) as unknown as { data: AiLiteracyMapHeadRow[] | null; error: unknown };

  const existingMap = existingMapRows?.[0] ?? null;

  const mapHead =
    existingMap ??
    ((
      await tableQuery(supabase, "ai_literacy_maps")
        .insert({
          profile_id: input.profileId,
          role_lens_key: roleLensKey,
          selected_capability_model_id: input.selectedCapabilityModelId ?? null,
          selected_role_lens: evaluation.role_lens,
          status: "not_started",
          latest_version_number: 0,
          generated_at: null,
          last_evaluated_at: null,
          profile_coverage_percent: 0,
          recruiter_safe_coverage_percent: 0,
        })
        .select("ai_literacy_map_id, profile_id, role_lens_key, current_version_id, latest_version_number, status, generated_at, last_evaluated_at")
        .limit(1)
        .single()) as unknown as { data: AiLiteracyMapHeadRow | null; error: unknown }).data;

  if (!mapHead) return { map: null, persisted: false };

  const { data: currentVersionRows } = mapHead.current_version_id
    ? ((await tableQuery(supabase, "ai_literacy_map_versions")
        .select(
          "ai_literacy_map_version_id, ai_literacy_map_id, profile_id, version_number, status, evidence_snapshot_hash, profile_coverage_percent, recruiter_safe_coverage_percent, overall_indicative_literacy_level, confidence, selected_role_lens, domain_breakdown, evaluated_at, created_at"
        )
        .eq("ai_literacy_map_version_id", mapHead.current_version_id)
        .limit(1)) as unknown as { data: AiLiteracyVersionRow[] | null; error: unknown })
    : ({ data: [] } as { data: AiLiteracyVersionRow[]; error?: unknown });

  const currentVersion = currentVersionRows?.[0] ?? null;

  if (
    currentVersion &&
    currentVersion.evidence_snapshot_hash &&
    currentVersion.evidence_snapshot_hash === evaluation.evidence_snapshot_hash &&
    currentVersion.status !== "in_progress"
  ) {
    return {
      map: toAiLiteracyMapView(currentVersion),
      persisted: false,
    };
  }

  if (
    currentVersion &&
    currentVersion.evidence_snapshot_hash &&
    currentVersion.evidence_snapshot_hash === evaluation.evidence_snapshot_hash &&
    currentVersion.status === "in_progress"
  ) {
    const { data: updatedVersion } = (await tableQuery(supabase, "ai_literacy_map_versions")
      .update({
        status: evaluation.status,
        evaluation_trigger: input.evaluationTrigger,
        selected_capability_model_id: input.selectedCapabilityModelId ?? null,
        selected_role_lens: evaluation.role_lens,
        overall_indicative_literacy_level: evaluation.overall_indicative_literacy_level,
        confidence: evaluation.confidence,
        evidence_sufficiency: evaluation.evidence_sufficiency,
        domain_breakdown: evaluation.domain_breakdown,
        supporting_evidence_refs: evaluation.supporting_evidence_refs,
        inferred_observations: evaluation.inferred_observations,
        candidate_stated_claims: evaluation.candidate_stated_claims,
        missing_signal_areas: evaluation.missing_signal_areas,
        recommendations: evaluation.recommendations,
        model_metadata: evaluation.model_metadata,
        profile_coverage_percent: evaluation.profile_coverage_percent,
        recruiter_safe_coverage_percent: evaluation.recruiter_safe_coverage_percent,
        generated_at: evaluation.generated_at,
        evaluated_at: evaluation.evaluated_at,
        version_delta_summary: toVersionDeltaSummary({
          previousVersion: currentVersion,
          nextEvaluation: evaluation,
        }),
      })
      .eq("ai_literacy_map_version_id", currentVersion.ai_literacy_map_version_id)
      .select(
        "ai_literacy_map_version_id, ai_literacy_map_id, profile_id, version_number, status, evidence_snapshot_hash, profile_coverage_percent, recruiter_safe_coverage_percent, overall_indicative_literacy_level, confidence, selected_role_lens, domain_breakdown, evaluated_at, created_at"
      )
      .limit(1)
      .single()) as unknown as { data: AiLiteracyVersionRow | null; error: unknown };

    if (!updatedVersion) {
      return { map: null, persisted: false };
    }

    await tableQuery(supabase, "ai_literacy_maps")
      .update({
        selected_capability_model_id: input.selectedCapabilityModelId ?? null,
        selected_role_lens: evaluation.role_lens,
        status: evaluation.status,
        generated_at: evaluation.generated_at,
        last_evaluated_at: evaluation.evaluated_at,
        profile_coverage_percent: evaluation.profile_coverage_percent,
        recruiter_safe_coverage_percent: evaluation.recruiter_safe_coverage_percent,
      })
      .eq("ai_literacy_map_id", mapHead.ai_literacy_map_id);

    return {
      map: toAiLiteracyMapView(updatedVersion),
      persisted: true,
    };
  }

  const nextVersionNumber = Math.max(0, mapHead.latest_version_number ?? 0) + 1;

  const { data: insertedVersion } = (await tableQuery(supabase, "ai_literacy_map_versions")
    .insert({
      ai_literacy_map_id: mapHead.ai_literacy_map_id,
      profile_id: input.profileId,
      version_number: nextVersionNumber,
      status: evaluation.status,
      evaluation_trigger: input.evaluationTrigger,
      selected_capability_model_id: input.selectedCapabilityModelId ?? null,
      selected_role_lens: evaluation.role_lens,
      overall_indicative_literacy_level: evaluation.overall_indicative_literacy_level,
      confidence: evaluation.confidence,
      evidence_sufficiency: evaluation.evidence_sufficiency,
      domain_breakdown: evaluation.domain_breakdown,
      supporting_evidence_refs: evaluation.supporting_evidence_refs,
      inferred_observations: evaluation.inferred_observations,
      candidate_stated_claims: evaluation.candidate_stated_claims,
      missing_signal_areas: evaluation.missing_signal_areas,
      recommendations: evaluation.recommendations,
      model_metadata: evaluation.model_metadata,
      version_delta_summary: toVersionDeltaSummary({
        previousVersion: currentVersion,
        nextEvaluation: evaluation,
      }),
      evidence_snapshot_hash: evaluation.evidence_snapshot_hash,
      profile_coverage_percent: evaluation.profile_coverage_percent,
      recruiter_safe_coverage_percent: evaluation.recruiter_safe_coverage_percent,
      generated_at: evaluation.generated_at,
      evaluated_at: evaluation.evaluated_at,
    })
    .select(
      "ai_literacy_map_version_id, ai_literacy_map_id, profile_id, version_number, status, evidence_snapshot_hash, profile_coverage_percent, recruiter_safe_coverage_percent, overall_indicative_literacy_level, confidence, selected_role_lens, domain_breakdown, evaluated_at, created_at"
    )
    .limit(1)
    .single()) as unknown as { data: AiLiteracyVersionRow | null; error: unknown };

  if (!insertedVersion) {
    return { map: null, persisted: false };
  }

  await tableQuery(supabase, "ai_literacy_maps")
    .update({
      selected_capability_model_id: input.selectedCapabilityModelId ?? null,
      selected_role_lens: evaluation.role_lens,
      current_version_id: insertedVersion.ai_literacy_map_version_id,
      latest_version_number: nextVersionNumber,
      status: evaluation.status,
      generated_at: mapHead.generated_at ?? evaluation.generated_at,
      last_evaluated_at: evaluation.evaluated_at,
      profile_coverage_percent: evaluation.profile_coverage_percent,
      recruiter_safe_coverage_percent: evaluation.recruiter_safe_coverage_percent,
    })
    .eq("ai_literacy_map_id", mapHead.ai_literacy_map_id);

  return {
    map: toAiLiteracyMapView(insertedVersion),
    persisted: true,
  };
}

export async function getAiLiteracyMapForAudience(input: {
  supabase: unknown;
  profileId: string;
  roleLensKey?: string | null;
  audience: "candidate" | "recruiter";
  requireManualGeneration?: boolean;
}): Promise<AiLiteracyMapView | null> {
  const supabase = input.supabase as SupabaseLike | null;
  if (!supabase) return null;

  let query = tableQuery(supabase, "ai_literacy_map_versions")
    .select(
      "ai_literacy_map_version_id, ai_literacy_map_id, profile_id, version_number, status, evaluation_trigger, evidence_snapshot_hash, profile_coverage_percent, recruiter_safe_coverage_percent, overall_indicative_literacy_level, confidence, selected_role_lens, domain_breakdown, evaluated_at, created_at"
    )
    .eq("profile_id", input.profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (input.roleLensKey) {
    query = query.eq("selected_role_lens->>role_lens_key", input.roleLensKey);
  }

  const { data } = (await query) as unknown as { data: AiLiteracyVersionRow[] | null; error: unknown };

  const rows = data ?? [];
  if (rows.length === 0) return null;
  if (input.requireManualGeneration) {
    const hasManualSeed = rows.some((row) => row.evaluation_trigger === "manual_refresh");
    if (!hasManualSeed) return null;
  }

  const selected =
    input.audience === "recruiter"
      ? rows.find((row) => row.status === "available") ?? null
      : rows.find((row) => row.status === "available" || row.status === "partial_available") ?? rows[0] ?? null;

  return selected ? toAiLiteracyMapView(selected) : null;
}
