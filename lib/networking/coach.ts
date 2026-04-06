import type {
  ActiveTarget,
  ConnectionRecord,
  GeneratedNetworkingPayload,
  ProjectedArtifact,
  ScoredArtifact,
  ScoredConnection,
} from "@/lib/networking/types";

type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  updated_at: string | null;
  is_active: boolean | null;
};

const artifactTypeToCapabilityId: Record<string, string> = {
  coursework: "technical_depth",
  project: "systems_thinking",
  internship: "execution_reliability",
  employment: "execution_reliability",
  certification: "technical_depth",
  test: "technical_depth",
  leadership: "leadership",
  club: "collaboration",
  competition: "research_methodology",
  research: "research_methodology",
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

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toVerificationStatus = (value: unknown): "verified" | "pending" | "unverified" => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "verified" || normalized === "pending" || normalized === "unverified") return normalized;
  return "unverified";
};

const uniqueTokenSet = (values: string[]): Set<string> => new Set(values.flatMap((value) => tokenize(value)));

const countOverlap = (left: Set<string>, right: Set<string>): number => {
  let matches = 0;
  for (const token of left) {
    if (right.has(token)) matches += 1;
  }
  return matches;
};

const daysSince = (isoString: string | null): number | null => {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
};

const recencyBonus = (updatedAt: string | null): number => {
  const days = daysSince(updatedAt);
  if (days === null) return 0;
  if (days <= 30) return 2;
  if (days <= 90) return 1;
  return 0;
};

const verificationBonus = (status: "verified" | "pending" | "unverified"): number => {
  if (status === "verified") return 2;
  if (status === "pending") return 1;
  return 0;
};

const compareIsoDesc = (left: string | null, right: string | null): number => {
  const leftEpoch = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightEpoch = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(leftEpoch) && !Number.isFinite(rightEpoch)) return 0;
  if (!Number.isFinite(leftEpoch)) return 1;
  if (!Number.isFinite(rightEpoch)) return -1;
  return rightEpoch - leftEpoch;
};

export const toCanonicalSharePath = (slug: string): string => `/u/${slug}`;

export const toAbsoluteShareUrl = ({
  sharePath,
  appUrl,
  requestOrigin,
}: {
  sharePath: string;
  appUrl?: string | null;
  requestOrigin: string;
}): string => {
  const normalizedAppUrl = toTrimmedString(appUrl);
  if (normalizedAppUrl) {
    try {
      const parsed = new URL(normalizedAppUrl);
      return `${parsed.origin}${sharePath}`;
    } catch {
      // Ignore invalid APP_URL and use request origin.
    }
  }
  return `${requestOrigin}${sharePath}`;
};

export const projectArtifactsForNetworking = (rows: ArtifactRow[]): ProjectedArtifact[] => {
  return rows
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const artifactData = toRecord(row.artifact_data);
      const artifactType = toTrimmedString(row.artifact_type).toLowerCase();
      const title =
        toTrimmedString(artifactData.title) ||
        toTrimmedString(artifactData.project_title) ||
        toTrimmedString(artifactData.course_title) ||
        "Untitled artifact";
      const source =
        toTrimmedString(artifactData.source) ||
        toTrimmedString(artifactData.organization) ||
        toTrimmedString(artifactData.company) ||
        "Profile";
      const description = toTrimmedString(artifactData.description) || null;
      const verificationStatus = toVerificationStatus(artifactData.verification_status);
      const capabilityId = artifactTypeToCapabilityId[artifactType] ?? "other_evidence";
      const capabilityLabel = capabilityLabelById[capabilityId] ?? "Other Evidence";

      return {
        artifact_id: row.artifact_id,
        artifact_type: artifactType || "other",
        title,
        source,
        description,
        verification_status: verificationStatus,
        updated_at: row.updated_at,
        capability_label: capabilityLabel,
      } satisfies ProjectedArtifact;
    });
};

const buildTargetTokenContext = (targets: ActiveTarget[]) => {
  const primary = targets[0] ?? null;
  const roleTokens = uniqueTokenSet(targets.map((target) => target.role_label));
  const companyTokens = uniqueTokenSet(targets.map((target) => target.company_label));
  return {
    primaryRolePhrase: primary?.role_label.toLowerCase() ?? "",
    primaryCompanyPhrase: primary?.company_label.toLowerCase() ?? "",
    roleTokens,
    companyTokens,
  };
};

export const rankArtifactsForTargets = ({
  artifacts,
  targets,
  limit = 5,
}: {
  artifacts: ProjectedArtifact[];
  targets: ActiveTarget[];
  limit?: number;
}): ScoredArtifact[] => {
  const { roleTokens, companyTokens } = buildTargetTokenContext(targets);

  return artifacts
    .map((artifact) => {
      const textTokens = uniqueTokenSet([
        artifact.title,
        artifact.source,
        artifact.description ?? "",
        artifact.capability_label,
        artifact.artifact_type,
      ]);
      const roleOverlap = countOverlap(textTokens, roleTokens);
      const companyOverlap = countOverlap(textTokens, companyTokens);
      const score =
        roleOverlap * 5 +
        companyOverlap * 4 +
        verificationBonus(artifact.verification_status) +
        recencyBonus(artifact.updated_at);

      return {
        ...artifact,
        score,
      } satisfies ScoredArtifact;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const updatedAtComparison = compareIsoDesc(left.updated_at, right.updated_at);
      if (updatedAtComparison !== 0) return updatedAtComparison;
      return left.artifact_id.localeCompare(right.artifact_id);
    })
    .slice(0, Math.max(1, limit));
};

const buildArtifactKeywordSet = (artifacts: ScoredArtifact[]): Set<string> =>
  uniqueTokenSet(
    artifacts.flatMap((artifact) => [artifact.title, artifact.source, artifact.capability_label, artifact.artifact_type])
  );

export const rankConnectionsForTargets = ({
  connections,
  targets,
  topArtifacts,
  limit = 40,
}: {
  connections: ConnectionRecord[];
  targets: ActiveTarget[];
  topArtifacts: ScoredArtifact[];
  limit?: number;
}): ScoredConnection[] => {
  const { roleTokens, companyTokens, primaryRolePhrase, primaryCompanyPhrase } = buildTargetTokenContext(targets);
  const artifactTokens = buildArtifactKeywordSet(topArtifacts);

  return connections
    .map((connection) => {
      const text = `${connection.name} ${connection.headline}`.trim();
      const lowerHeadline = connection.headline.toLowerCase();
      const tokens = uniqueTokenSet([text]);
      const roleOverlap = countOverlap(tokens, roleTokens);
      const companyOverlap = countOverlap(tokens, companyTokens);
      const artifactOverlap = countOverlap(tokens, artifactTokens);
      const primaryRoleBoost = primaryRolePhrase && lowerHeadline.includes(primaryRolePhrase) ? 2 : 0;
      const primaryCompanyBoost = primaryCompanyPhrase && lowerHeadline.includes(primaryCompanyPhrase) ? 2 : 0;
      const score = roleOverlap * 5 + companyOverlap * 4 + artifactOverlap * 2 + primaryRoleBoost + primaryCompanyBoost;

      return {
        ...connection,
        score,
      } satisfies ScoredConnection;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const nameComparison = left.name.localeCompare(right.name);
      if (nameComparison !== 0) return nameComparison;
      return left.url.localeCompare(right.url);
    })
    .slice(0, Math.max(1, limit));
};

const trimToMaxLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const trimmed = value.slice(0, maxLength).trimEnd();
  return trimmed.length > 0 ? trimmed : value.slice(0, maxLength);
};

const ensureFollowUpIncludesUrl = (followUp: string, profileUrl: string): string => {
  const normalizedFollowUp = followUp.trim();
  if (normalizedFollowUp.includes(profileUrl)) return normalizedFollowUp;
  if (!normalizedFollowUp) return `You can review my profile here: ${profileUrl}`;
  return `${normalizedFollowUp}\n\nYou can review my profile here: ${profileUrl}`;
};

export const enforceGeneratedPayload = ({
  payload,
  profileUrl,
}: {
  payload: GeneratedNetworkingPayload;
  profileUrl: string;
}): GeneratedNetworkingPayload => {
  const inviteMessage = trimToMaxLength(payload.invite_message.trim(), 300);
  const followUpMessageWithUrl = ensureFollowUpIncludesUrl(payload.follow_up_message, profileUrl);
  const followUpMessage = trimToMaxLength(followUpMessageWithUrl, 700);

  return {
    ...payload,
    rationale: payload.rationale.trim(),
    invite_message: inviteMessage,
    follow_up_message: followUpMessage.includes(profileUrl)
      ? followUpMessage
      : trimToMaxLength(ensureFollowUpIncludesUrl(followUpMessage, profileUrl), 700),
  };
};

const firstNameFromFullName = (value: string): string => {
  const firstName = value.trim().split(/\s+/)[0] ?? "";
  return firstName || "there";
};

export const buildFallbackPayload = ({
  selectedConnection,
  primaryTarget,
  artifacts,
  profileUrl,
}: {
  selectedConnection: ScoredConnection;
  primaryTarget: ActiveTarget;
  artifacts: ScoredArtifact[];
  profileUrl: string;
}): GeneratedNetworkingPayload => {
  const contactFirstName = firstNameFromFullName(selectedConnection.name);
  const topArtifact = artifacts[0];
  const topArtifactSnippet = topArtifact
    ? `${topArtifact.title} (${topArtifact.capability_label})`
    : "recent project work";

  const inviteMessage = trimToMaxLength(
    `Hi ${contactFirstName}, I’m targeting ${primaryTarget.role_label} roles at ${primaryTarget.company_label} and your background stood out. Would you be open to connecting?`,
    300
  );

  const followUpMessage = trimToMaxLength(
    ensureFollowUpIncludesUrl(
      `Thanks for connecting. I’m a student focused on ${primaryTarget.role_label} opportunities at ${primaryTarget.company_label}. ` +
        `One project I’m proud of is ${topArtifactSnippet}. I’d value any advice on building stronger signal for this path.`,
      profileUrl
    ),
    700
  );

  return {
    selected_url: selectedConnection.url,
    rationale:
      `Matched to ${primaryTarget.role_label} at ${primaryTarget.company_label} using deterministic target and artifact overlap scoring.`,
    invite_message: inviteMessage,
    follow_up_message: followUpMessage,
  };
};

