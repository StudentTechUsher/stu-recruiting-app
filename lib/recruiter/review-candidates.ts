import type { ATSProvider, NormalizedATSCandidate } from "@/lib/ats/types";
import { fetchATSPipelineForOrg } from "@/lib/ats/provider-pipeline";
import {
  createSupabaseCandidateIdentityStore,
  linkCandidateApplication,
  normalizeCandidateEmail,
  resolveCandidateForIngestion,
  selectCanonicalArtifactVersion,
} from "@/lib/candidates/identity";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type VerificationState = "verified" | "pending" | "unverified";
export type IdentityState = "resolved" | "unresolved";
export type IdentitySource = "canonical_linked" | "ats_linked" | "ats_derived";

export type ReviewCapabilitySummary = {
  capability_id: string;
  label: string;
  evidence_count: number;
};

export type ReviewEvidenceIndicator = {
  verified: number;
  pending: number;
  unverified: number;
};

export type ReviewCandidateRow = {
  candidate_key: string;
  candidate_id: string | null;
  application_id: string;
  employer_id: string;
  job_role: string | null;
  full_name: string;
  avatar_url: string | null;
  identity_state: IdentityState;
  identity_source: IdentitySource;
  identity_reason: string | null;
  capability_summary: ReviewCapabilitySummary[];
  evidence_indicator: ReviewEvidenceIndicator;
  current_stage: string | null;
  applied_at: string | null;
};

export type ReviewEvidenceArtifact = {
  artifact_id: string;
  artifact_type: string;
  capability_id: string;
  title: string;
  source: string;
  description: string | null;
  verification_status: VerificationState;
  updated_at: string;
  created_at: string;
  provenance: Record<string, unknown>;
  artifact_data: Record<string, unknown>;
  provenance_versions: Array<{
    artifact_id: string;
    verification_status: VerificationState;
    updated_at: string | null;
    artifact_data: Record<string, unknown>;
  }>;
};

const DEFAULT_CANDIDATE_CONTEXT_CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 20_000 : 2_000;
const configuredCacheTtlMs = Number.parseInt(
  process.env.REVIEW_CANDIDATE_CONTEXT_CACHE_TTL_MS ?? "",
  10
);
const CANDIDATE_CONTEXT_CACHE_TTL_MS =
  Number.isFinite(configuredCacheTtlMs) && configuredCacheTtlMs >= 0
    ? configuredCacheTtlMs
    : DEFAULT_CANDIDATE_CONTEXT_CACHE_TTL_MS;
const candidateContextCache = new Map<
  string,
  {
    expiresAt: number;
    value: Promise<{ provider: ATSProvider; contexts: CandidateContext[]; jobRoles: string[] }>;
  }
>();

export function resetReviewCandidateContextCacheForTests() {
  candidateContextCache.clear();
}

export type ReviewCandidateEvidencePayload = {
  application_id: string;
  candidate_id: string | null;
  identity_state: IdentityState;
  identity_source: IdentitySource;
  identity_reason: string | null;
  full_name: string;
  avatar_url: string | null;
  job_role: string | null;
  capability_summary: ReviewCapabilitySummary[];
  selected_capability_id: string | null;
  artifacts: ReviewEvidenceArtifact[];
  panel_state:
    | "panel_loading"
    | "panel_single_evidence"
    | "panel_multi_evidence"
    | "panel_no_evidence"
    | "panel_error";
};

type ArtifactRow = {
  artifact_id: string;
  profile_id: string;
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  created_at: string;
  updated_at: string;
};

type StudentEmailRow = {
  profile_id: string;
  email: string | null;
  profiles:
    | {
        personal_info: Record<string, unknown> | null;
      }
    | Array<{ personal_info: Record<string, unknown> | null }>
    | null;
};

type ProfileEmailRow = {
  id: string;
  personal_info: Record<string, unknown> | null;
};

type CandidateContext = {
  row: ReviewCandidateRow;
  evidence_profile_id: string | null;
  artifacts: ReviewEvidenceArtifact[];
};

type AvatarFileRef = {
  bucket: string;
  path: string;
};

type ProfileAvatarMeta = {
  avatarUrl: string | null;
  avatarFileRef: AvatarFileRef | null;
};

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl?: string | null } | null; error: unknown }>;
    };
  };
};

const AVATAR_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toVerificationState = (value: unknown): VerificationState => {
  const normalized = toTrimmedString(value)?.toLowerCase();
  if (normalized === "verified" || normalized === "pending" || normalized === "unverified") {
    return normalized;
  }
  return "unverified";
};

const parseAvatarFileRef = (value: unknown): AvatarFileRef | null => {
  const parsed = toRecord(value);
  const bucket = toTrimmedString(parsed.bucket);
  const path = toTrimmedString(parsed.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

const normalizedArtifactFieldKeys = [
  "title",
  "source",
  "description",
  "verification_status",
  "course_title",
  "project_title",
  "job_title",
  "current_stage",
  "profile_url",
  "organization",
  "institution",
  "started_at",
  "ended_at",
  "issued_at",
  "expires_at",
  "skills",
  "tags",
  "url",
] as const;

const getOne = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const capabilityLabelByType: Record<string, string> = {
  coursework: "Coursework",
  project: "Project Experience",
  internship: "Professional Experience",
  employment: "Professional Experience",
  certification: "Credentials",
  test: "Credentials",
  leadership: "Leadership & Collaboration",
  club: "Leadership & Collaboration",
  competition: "Research & Competition",
  research: "Research & Competition",
};

type MockArtifactTemplate = {
  artifact_type: string;
  title: string;
  description: string;
  source: string;
  verification_status: VerificationState;
  tags?: string[];
  skills?: string[];
  url?: string;
};

type MockEvidenceOverride = {
  templateId: string;
  artifacts: MockArtifactTemplate[];
};

const mockEvidenceTemplates: MockArtifactTemplate[][] = [
  [
    {
      artifact_type: "project",
      title: "Fraud Detection Pipeline",
      description: "Built a model + ETL workflow for card transaction anomaly detection.",
      source: "GitHub",
      verification_status: "verified",
      tags: ["ml", "python", "etl"],
      skills: ["Machine Learning", "Data Engineering"],
      url: "https://github.com/example/fraud-detection-pipeline",
    },
    {
      artifact_type: "coursework",
      title: "Applied Statistics II",
      description: "Completed regression and experiment-design coursework with final capstone.",
      source: "Transcript",
      verification_status: "pending",
      tags: ["statistics"],
      skills: ["Statistics"],
    },
  ],
  [
    {
      artifact_type: "internship",
      title: "Product Analytics Internship",
      description: "Analyzed funnel conversion and produced decision memos for PM team.",
      source: "LinkedIn",
      verification_status: "verified",
      tags: ["product", "analytics"],
      skills: ["SQL", "Product Analytics"],
      url: "https://www.linkedin.com/in/example",
    },
    {
      artifact_type: "project",
      title: "Dashboard Instrumentation Toolkit",
      description: "Created reusable event-tracking dashboard components for growth experiments.",
      source: "GitHub",
      verification_status: "unverified",
      tags: ["frontend", "analytics"],
      skills: ["TypeScript", "Experimentation"],
      url: "https://github.com/example/dashboard-toolkit",
    },
  ],
  [
    {
      artifact_type: "research",
      title: "Demand Forecasting Study",
      description: "Published reproducible notebook on demand forecasting with error analysis.",
      source: "Kaggle",
      verification_status: "pending",
      tags: ["forecasting"],
      skills: ["Time Series"],
      url: "https://www.kaggle.com/example/forecasting-study",
    },
    {
      artifact_type: "certification",
      title: "Cloud Data Engineering Certificate",
      description: "Completed cloud data workflow certification assessment.",
      source: "Credential",
      verification_status: "verified",
      tags: ["cloud"],
      skills: ["Cloud Data Engineering"],
    },
    {
      artifact_type: "leadership",
      title: "Data Club Project Lead",
      description: "Led a student team delivering community data visualizations.",
      source: "Portfolio",
      verification_status: "unverified",
      tags: ["leadership"],
      skills: ["Collaboration", "Project Leadership"],
    },
  ],
];

const mockEvidenceOverridesByNormalizedEmail: Record<string, MockEvidenceOverride> = {
  "sam.r@example.com": {
    templateId: "sam_robinson_v2",
    artifacts: [
      {
        artifact_type: "coursework",
        title: "Advanced Data Science Practicum",
        description: "Completed applied ML coursework with production-oriented capstone delivery.",
        source: "Transcript",
        verification_status: "verified",
        tags: ["ml", "data-science"],
        skills: ["Applied Machine Learning"],
      },
      {
        artifact_type: "project",
        title: "Customer Churn Forecasting Pipeline",
        description: "Built and documented an end-to-end churn prediction workflow and evaluation dashboard.",
        source: "GitHub",
        verification_status: "verified",
        tags: ["python", "ml", "forecasting"],
        skills: ["Model Evaluation", "Feature Engineering"],
        url: "https://github.com/example/churn-forecasting",
      },
      {
        artifact_type: "internship",
        title: "Data Science Internship",
        description: "Delivered weekly insights and experimentation analysis for product teams.",
        source: "LinkedIn",
        verification_status: "pending",
        tags: ["analytics", "experimentation"],
        skills: ["SQL", "Experiment Analysis"],
        url: "https://www.linkedin.com/in/sam-robinson-example",
      },
      {
        artifact_type: "employment",
        title: "Research Assistant (Part-Time)",
        description: "Built data quality checks and weekly reporting for faculty-led analytics projects.",
        source: "Resume",
        verification_status: "unverified",
        tags: ["research", "reporting"],
        skills: ["Data Validation", "Reporting"],
      },
      {
        artifact_type: "certification",
        title: "Cloud ML Foundations Certificate",
        description: "Completed cloud ML service and deployment fundamentals certification.",
        source: "Credential",
        verification_status: "verified",
        tags: ["cloud", "mlops"],
        skills: ["Cloud ML", "MLOps Basics"],
      },
      {
        artifact_type: "research",
        title: "Model Fairness Audit",
        description: "Produced reproducible fairness metrics report comparing alternate model strategies.",
        source: "Kaggle",
        verification_status: "pending",
        tags: ["fairness", "audit"],
        skills: ["Responsible AI"],
        url: "https://www.kaggle.com/example/model-fairness-audit",
      },
      {
        artifact_type: "leadership",
        title: "Analytics Club Project Lead",
        description: "Led a student team that shipped data stories for campus operations stakeholders.",
        source: "Portfolio",
        verification_status: "unverified",
        tags: ["leadership", "communication"],
        skills: ["Team Leadership", "Stakeholder Communication"],
      },
    ],
  },
};

function mapCapabilityLabel(artifactType: string): string {
  return capabilityLabelByType[artifactType] ?? "Other Evidence";
}

function mapCapabilityId(artifactType: string): string {
  const label = mapCapabilityLabel(artifactType);
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function hashDeterministic(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function isMockAtsCandidate(candidate: NormalizedATSCandidate): boolean {
  const raw = toRecord(candidate.raw);
  const source = toTrimmedString(raw.source);
  if (source === "bamboohr_mock" || source === "greenhouse_sqlite_dev") return true;

  const sqliteLikeShape =
    typeof raw.candidate_id === "number" &&
    toTrimmedString(raw.first_name) !== null &&
    !("candidate" in raw);

  return sqliteLikeShape;
}

function buildMockEvidenceProfile(input: {
  candidate: NormalizedATSCandidate;
  applicationId: string;
  provider: ATSProvider;
}): ReviewEvidenceArtifact[] {
  const normalizedEmail = normalizeCandidateEmail(input.candidate.email);
  const override = normalizedEmail ? mockEvidenceOverridesByNormalizedEmail[normalizedEmail] : undefined;

  const key =
    normalizedEmail ??
    `${input.provider}:${input.candidate.ats_id}:${input.applicationId}`;
  const templateIndex = hashDeterministic(key) % mockEvidenceTemplates.length;
  const template = override?.artifacts ?? mockEvidenceTemplates[templateIndex] ?? mockEvidenceTemplates[0];
  const templateRef = override?.templateId ?? String(templateIndex);

  const baseTimestamp = input.candidate.applied_at ?? new Date().toISOString();

  return template.map((artifact, index) => ({
    artifact_id: `mock:${input.applicationId}:${templateRef}:${index + 1}`,
    artifact_type: artifact.artifact_type,
    capability_id: mapCapabilityId(artifact.artifact_type),
    title: artifact.title,
    source: artifact.source,
    description: artifact.description,
    verification_status: artifact.verification_status,
    updated_at: baseTimestamp,
    created_at: baseTimestamp,
    provenance: {
      provider: input.provider,
      source: "ats_mock_seed",
      application_id: input.applicationId,
      template_index: templateIndex,
      template_ref: templateRef,
    },
    artifact_data: pickNormalizedArtifactData({
      title: artifact.title,
      source: artifact.source,
      description: artifact.description,
      verification_status: artifact.verification_status,
      job_title: input.candidate.job_title,
      tags: artifact.tags ?? [],
      skills: artifact.skills ?? [],
      url: artifact.url,
    }),
    provenance_versions: [],
  }));
}

function pickNormalizedArtifactData(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const key of normalizedArtifactFieldKeys) {
    const value = input[key];
    if (value === null || value === undefined) continue;
    normalized[key] = value;
  }
  return normalized;
}

function buildCandidateKey(provider: ATSProvider, atsCandidateId: string): string {
  return `${provider}:${atsCandidateId}`;
}

function resolveApplicationId(candidate: NormalizedATSCandidate): string {
  const raw = toRecord(candidate.raw);

  const idCandidate =
    toTrimmedString(raw.application_id) ??
    toTrimmedString(raw.applicationId) ??
    toTrimmedString(raw.id);

  if (idCandidate) return idCandidate;
  return candidate.ats_id;
}

function createSyntheticApplicationArtifact(input: {
  applicationId: string;
  candidate: NormalizedATSCandidate;
  provider: ATSProvider;
}): ReviewEvidenceArtifact {
  return {
    artifact_id: `application:${input.applicationId}`,
    artifact_type: "application_record",
    capability_id: mapCapabilityId("application_record"),
    title: input.candidate.full_name || "Application evidence",
    source: "ATS application",
    description: `Normalized ATS application evidence from ${input.provider}`,
    verification_status: "unverified",
    updated_at: input.candidate.applied_at ?? new Date().toISOString(),
    created_at: input.candidate.applied_at ?? new Date().toISOString(),
    provenance: {
      provider: input.provider,
      ats_candidate_id: input.candidate.ats_id,
      application_id: input.applicationId,
    },
      artifact_data: pickNormalizedArtifactData({
        title: input.candidate.full_name || "Application evidence",
        source: "ATS application",
        description: `Stage: ${input.candidate.current_stage ?? "Unknown"}`,
        verification_status: "unverified",
        job_title: input.candidate.job_title,
        current_stage: input.candidate.current_stage,
        profile_url: input.candidate.profile_url,
      }),
      provenance_versions: [],
  };
}

function buildArtifactGroupingKey(input: {
  artifactType: string;
  artifactData: Record<string, unknown>;
}): string {
  const title = toTrimmedString(input.artifactData.title)?.toLowerCase() ?? "";
  const source = toTrimmedString(input.artifactData.source)?.toLowerCase() ?? "";
  return `${input.artifactType.toLowerCase()}|${title}|${source}`;
}

function normalizeArtifacts(rows: ArtifactRow[]): ReviewEvidenceArtifact[] {
  if (rows.length === 0) return [];

  const grouped = new Map<string, ArtifactRow[]>();
  for (const row of rows) {
    const artifactData = toRecord(row.artifact_data);
    const key = buildArtifactGroupingKey({
      artifactType: row.artifact_type,
      artifactData,
    });
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const canonicalArtifacts: ReviewEvidenceArtifact[] = [];
  for (const versions of grouped.values()) {
    const selection = selectCanonicalArtifactVersion(
      versions.map((version) => ({
        artifact_id: version.artifact_id,
        updated_at: version.updated_at,
        verification_status: toTrimmedString(toRecord(version.artifact_data).verification_status),
        artifact_data: toRecord(version.artifact_data),
      }))
    );

    const canonicalVersion = versions.find(
      (version) => version.artifact_id === selection.canonical.artifact_id
    );
    if (!canonicalVersion) continue;

    const canonicalData = toRecord(canonicalVersion.artifact_data);
    canonicalArtifacts.push({
      artifact_id: canonicalVersion.artifact_id,
      artifact_type: canonicalVersion.artifact_type,
      capability_id: mapCapabilityId(canonicalVersion.artifact_type),
      title:
        toTrimmedString(canonicalData.title) ??
        toTrimmedString(canonicalData.course_title) ??
        toTrimmedString(canonicalData.project_title) ??
        "Evidence",
      source: toTrimmedString(canonicalData.source) ?? "Unknown source",
      description: toTrimmedString(canonicalData.description),
      verification_status: toVerificationState(canonicalData.verification_status),
      updated_at: canonicalVersion.updated_at,
      created_at: canonicalVersion.created_at,
      provenance: {
        file_refs: Array.isArray(canonicalVersion.file_refs) ? canonicalVersion.file_refs : [],
      },
      artifact_data: pickNormalizedArtifactData(canonicalData),
      provenance_versions: selection.provenanceVersions.map((version) => ({
        artifact_id: version.artifact_id,
        verification_status: toVerificationState(version.verification_status ?? version.artifact_data.verification_status),
        updated_at: version.updated_at,
        artifact_data: pickNormalizedArtifactData(version.artifact_data),
      })),
    });
  }

  return canonicalArtifacts.sort((first, second) => {
    const byUpdated = Date.parse(second.updated_at) - Date.parse(first.updated_at);
    if (byUpdated !== 0) return byUpdated;
    return first.artifact_id.localeCompare(second.artifact_id);
  });
}

function buildEvidenceIndicator(artifacts: ReviewEvidenceArtifact[]): ReviewEvidenceIndicator {
  return artifacts.reduce(
    (accumulator, artifact) => {
      accumulator[artifact.verification_status] += 1;
      return accumulator;
    },
    {
      verified: 0,
      pending: 0,
      unverified: 0,
    } satisfies ReviewEvidenceIndicator
  );
}

function buildCapabilitySummary(artifacts: ReviewEvidenceArtifact[]): ReviewCapabilitySummary[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const artifact of artifacts) {
    const capabilityId = mapCapabilityId(artifact.artifact_type);
    const label = mapCapabilityLabel(artifact.artifact_type);
    const existing = counts.get(capabilityId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(capabilityId, { label, count: 1 });
  }

  return [...counts.entries()]
    .map(([capability_id, value]) => ({
      capability_id,
      label: value.label,
      evidence_count: value.count,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));
}

async function fetchStudentProfileLookup(): Promise<{
  profileIdByEmail: Map<string, string>;
  avatarMetaByProfileId: Map<string, ProfileAvatarMeta>;
}> {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return {
      profileIdByEmail: new Map(),
      avatarMetaByProfileId: new Map(),
    };
  }

  const { data } = (await supabase
    .from("students")
    .select("profile_id, email, profiles:profiles!students_profile_id_fkey(personal_info)")
    .limit(5000)) as { data: StudentEmailRow[] | null };
  const { data: profileRows } = (await supabase
    .from("profiles")
    .select("id, personal_info")
    .eq("role", "student")
    .limit(5000)) as { data: ProfileEmailRow[] | null };

  const profileIdByEmail = new Map<string, string>();
  const avatarMetaByProfileId = new Map<string, ProfileAvatarMeta>();
  for (const row of data ?? []) {
    const profileRef = getOne(row.profiles);
    const personalInfo = toRecord(profileRef?.personal_info);
    const email =
      normalizeCandidateEmail(row.email) ??
      normalizeCandidateEmail(toTrimmedString(personalInfo.email));
    if (!email) continue;
    if (!profileIdByEmail.has(email)) {
      profileIdByEmail.set(email, row.profile_id);
    }

    avatarMetaByProfileId.set(row.profile_id, {
      avatarUrl:
        toTrimmedString(personalInfo.avatar_url) ??
        toTrimmedString(personalInfo.avatarUrl) ??
        null,
      avatarFileRef: parseAvatarFileRef(personalInfo.avatar_file_ref ?? personalInfo.avatarFileRef),
    });
  }

  for (const row of profileRows ?? []) {
    const personalInfo = toRecord(row.personal_info);
    const email = normalizeCandidateEmail(toTrimmedString(personalInfo.email));
    if (!email) continue;
    if (!profileIdByEmail.has(email)) {
      profileIdByEmail.set(email, row.id);
    }

    if (!avatarMetaByProfileId.has(row.id)) {
      avatarMetaByProfileId.set(row.id, {
        avatarUrl:
          toTrimmedString(personalInfo.avatar_url) ??
          toTrimmedString(personalInfo.avatarUrl) ??
          null,
        avatarFileRef: parseAvatarFileRef(personalInfo.avatar_file_ref ?? personalInfo.avatarFileRef),
      });
    }
  }

  return {
    profileIdByEmail,
    avatarMetaByProfileId,
  };
}

async function resolveAvatarUrlForProfile(input: {
  profileId: string | null;
  avatarMetaByProfileId: Map<string, ProfileAvatarMeta>;
  avatarUrlCache: Map<string, string | null>;
  supabase: unknown;
}): Promise<string | null> {
  if (!input.profileId) return null;
  if (input.avatarUrlCache.has(input.profileId)) {
    return input.avatarUrlCache.get(input.profileId) ?? null;
  }

  const meta = input.avatarMetaByProfileId.get(input.profileId);
  if (!meta) {
    input.avatarUrlCache.set(input.profileId, null);
    return null;
  }

  if (meta.avatarUrl) {
    input.avatarUrlCache.set(input.profileId, meta.avatarUrl);
    return meta.avatarUrl;
  }

  if (!meta.avatarFileRef || !input.supabase) {
    input.avatarUrlCache.set(input.profileId, null);
    return null;
  }

  const storageClient = input.supabase as SupabaseStorageClient;
  const { data, error } = await storageClient.storage
    .from(meta.avatarFileRef.bucket)
    .createSignedUrl(meta.avatarFileRef.path, AVATAR_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    input.avatarUrlCache.set(input.profileId, null);
    return null;
  }

  input.avatarUrlCache.set(input.profileId, data.signedUrl);
  return data.signedUrl;
}

async function fetchAllActiveATSApplicants(orgId: string): Promise<{
  provider: ATSProvider;
  candidates: NormalizedATSCandidate[];
}> {
  const first = await fetchATSPipelineForOrg(orgId, { page: 1 });
  const allCandidates = [...first.result.candidates];
  let hasMore = first.result.has_more;
  let page = 2;

  while (hasMore && first.provider !== "lever" && page <= 10) {
    const next = await fetchATSPipelineForOrg(orgId, { page });
    allCandidates.push(...next.result.candidates);
    hasMore = next.result.has_more;
    page += 1;
  }

  return {
    provider: first.provider,
    candidates: allCandidates.filter((candidate) => candidate.status === "active"),
  };
}

async function buildCandidateContextsUncached(orgId: string): Promise<{
  provider: ATSProvider;
  contexts: CandidateContext[];
  jobRoles: string[];
}> {
  const [{ provider, candidates }, profileLookup] = await Promise.all([
    fetchAllActiveATSApplicants(orgId),
    fetchStudentProfileLookup(),
  ]);
  const { profileIdByEmail, avatarMetaByProfileId } = profileLookup;

  const supabase = getSupabaseServiceRoleClient();
  const store = supabase ? createSupabaseCandidateIdentityStore(supabase) : null;
  const avatarUrlCache = new Map<string, string | null>();

  const contexts: CandidateContext[] = [];
  const profileIdsNeedingArtifacts = new Set<string>();
  const contextByApplicationId = new Map<string, CandidateContext>();
  const jobRoles = new Set<string>();

  for (const candidate of candidates) {
    const applicationId = resolveApplicationId(candidate);
    const candidateKey = buildCandidateKey(provider, candidate.ats_id);
    const normalizedEmail = normalizeCandidateEmail(candidate.email);
    const sourceProfileId = normalizedEmail ? profileIdByEmail.get(normalizedEmail) ?? null : null;

    let candidateId: string | null = null;
    let identityState: IdentityState = "unresolved";
    let identitySource: IdentitySource = "ats_derived";
    let identityReason: string | null = "identity_not_resolved";
    let evidenceProfileId: string | null = sourceProfileId;

    if (normalizedEmail && store) {
      try {
        const resolved = await resolveCandidateForIngestion({
          store,
          email: normalizedEmail,
          employerId: orgId,
          sourceProfileId,
        });

        candidateId = resolved.candidate.candidate_id;
        identityState = "resolved";
        if (resolved.scope === "canonical") {
          identitySource = "canonical_linked";
        } else {
          identitySource = resolved.variant.source_profile_id ?? sourceProfileId ? "ats_linked" : "ats_derived";
        }
        identityReason = null;
        evidenceProfileId =
          resolved.candidate.canonical_profile_id ??
          resolved.variant.source_profile_id ??
          sourceProfileId;

        await linkCandidateApplication({
          store,
          application: {
            application_id: applicationId,
            candidate_id: resolved.candidate.candidate_id,
            employer_id: orgId,
            role_context: {
              ats_provider: provider,
              ats_candidate_id: candidate.ats_id,
              job_id: candidate.job_id,
              job_title: candidate.job_title,
              current_stage: candidate.current_stage,
              status: candidate.status,
              applied_at: candidate.applied_at,
            },
            source_provenance_refs: [
              {
                provider,
                application_id: applicationId,
                ats_candidate_id: candidate.ats_id,
                profile_url: candidate.profile_url,
              },
            ],
          },
        });
      } catch {
        identityState = "unresolved";
        identityReason = "identity_resolution_failed";
      }
    } else if (!normalizedEmail) {
      identityState = "unresolved";
      identityReason = "missing_email";
    }

    if (identityState === "unresolved" && sourceProfileId) {
      identitySource = "ats_linked";
      if (identityReason === "identity_not_resolved") {
        identityReason = "profile_email_matched_unresolved";
      }
    }

    if (evidenceProfileId) profileIdsNeedingArtifacts.add(evidenceProfileId);
    if (candidate.job_title) jobRoles.add(candidate.job_title);

    const row: ReviewCandidateRow = {
      candidate_key: candidateKey,
      candidate_id: identityState === "resolved" ? candidateId : null,
      application_id: applicationId,
      employer_id: orgId,
      job_role: candidate.job_title,
      full_name: candidate.full_name,
      avatar_url: null,
      identity_state: identityState,
      identity_source: identitySource,
      identity_reason: identityReason,
      capability_summary: [],
      evidence_indicator: {
        verified: 0,
        pending: 0,
        unverified: 0,
      },
      current_stage: candidate.current_stage,
      applied_at: candidate.applied_at,
    };

    const context: CandidateContext = {
      row,
      evidence_profile_id: evidenceProfileId,
      artifacts: [],
    };
    contexts.push(context);
    contextByApplicationId.set(applicationId, context);
  }

  const artifactsByProfileId = new Map<string, ReviewEvidenceArtifact[]>();
  if (supabase && profileIdsNeedingArtifacts.size > 0) {
    const { data } = (await supabase
      .from("artifacts")
      .select("artifact_id, profile_id, artifact_type, artifact_data, file_refs, created_at, updated_at")
      .in("profile_id", [...profileIdsNeedingArtifacts])) as { data: ArtifactRow[] | null };

    const grouped = new Map<string, ArtifactRow[]>();
    for (const row of data ?? []) {
      const existing = grouped.get(row.profile_id);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(row.profile_id, [row]);
      }
    }

    for (const [profileId, rows] of grouped.entries()) {
      artifactsByProfileId.set(profileId, normalizeArtifacts(rows));
    }
  }

  for (const candidate of candidates) {
    const applicationId = resolveApplicationId(candidate);
    const context = contextByApplicationId.get(applicationId);
    if (!context) continue;

    const normalizedEmail = normalizeCandidateEmail(candidate.email);
    const sourceProfileId = normalizedEmail ? profileIdByEmail.get(normalizedEmail) ?? null : null;
    const possibleProfileIds = [context.evidence_profile_id, sourceProfileId];

    let resolvedArtifacts: ReviewEvidenceArtifact[] = [];
    for (const profileId of possibleProfileIds) {
      if (!profileId) continue;
      const fromProfile = artifactsByProfileId.get(profileId);
      if (fromProfile && fromProfile.length > 0) {
        resolvedArtifacts = fromProfile;
        break;
      }
    }

    if (resolvedArtifacts.length === 0) {
      if (isMockAtsCandidate(candidate)) {
        resolvedArtifacts = buildMockEvidenceProfile({
          candidate,
          applicationId,
          provider,
        });
      } else if (context.row.identity_state === "unresolved") {
        resolvedArtifacts = [
          createSyntheticApplicationArtifact({
            applicationId,
            candidate,
            provider,
          }),
        ];
      }
    }

    context.artifacts = resolvedArtifacts;
    context.row.evidence_indicator = buildEvidenceIndicator(resolvedArtifacts);
    context.row.capability_summary = buildCapabilitySummary(resolvedArtifacts);

    const avatarProfileId = context.evidence_profile_id ?? sourceProfileId;
    context.row.avatar_url = await resolveAvatarUrlForProfile({
      profileId: avatarProfileId,
      avatarMetaByProfileId,
      avatarUrlCache,
      supabase,
    });
  }

  return {
    provider,
    contexts,
    jobRoles: [...jobRoles].sort((first, second) => first.localeCompare(second)),
  };
}

async function buildCandidateContexts(orgId: string): Promise<{
  provider: ATSProvider;
  contexts: CandidateContext[];
  jobRoles: string[];
}> {
  const now = Date.now();
  const cached = candidateContextCache.get(orgId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = buildCandidateContextsUncached(orgId).catch((error) => {
    const current = candidateContextCache.get(orgId);
    if (current?.value === value) {
      candidateContextCache.delete(orgId);
    }
    throw error;
  });

  candidateContextCache.set(orgId, {
    value,
    expiresAt: now + CANDIDATE_CONTEXT_CACHE_TTL_MS,
  });

  return value;
}

function matchesJobRoleFilter(candidate: ReviewCandidateRow, jobRole: string | undefined): boolean {
  if (!jobRole || jobRole === "all") return true;
  return candidate.job_role === jobRole;
}

function sortCandidates(first: ReviewCandidateRow, second: ReviewCandidateRow): number {
  const firstApplied = first.applied_at ? Date.parse(first.applied_at) : 0;
  const secondApplied = second.applied_at ? Date.parse(second.applied_at) : 0;
  if (secondApplied !== firstApplied) return secondApplied - firstApplied;

  return first.candidate_key.localeCompare(second.candidate_key);
}

export async function listRecruiterReviewCandidates(input: {
  orgId: string;
  page?: number;
  pageSize?: number;
  jobRole?: string;
}) {
  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : 25;

  const { provider, contexts, jobRoles } = await buildCandidateContexts(input.orgId);
  const filtered = contexts
    .map((context) => context.row)
    .filter((row) => matchesJobRoleFilter(row, input.jobRole))
    .sort(sortCandidates);

  const start = (page - 1) * pageSize;
  const candidates = filtered.slice(start, start + pageSize);

  return {
    provider,
    candidates,
    total: filtered.length,
    page,
    page_size: pageSize,
    has_more: start + pageSize < filtered.length,
    job_roles: jobRoles,
  };
}

function determinePanelState(artifacts: ReviewEvidenceArtifact[]): ReviewCandidateEvidencePayload["panel_state"] {
  if (artifacts.length === 0) return "panel_no_evidence";
  if (artifacts.length === 1) return "panel_single_evidence";
  return "panel_multi_evidence";
}

export async function getRecruiterReviewCandidateEvidence(input: {
  orgId: string;
  applicationId: string;
  capabilityId?: string;
}): Promise<ReviewCandidateEvidencePayload | null> {
  const { contexts } = await buildCandidateContexts(input.orgId);
  const context = contexts.find((row) => row.row.application_id === input.applicationId);
  if (!context) return null;

  const selectedCapabilityId = input.capabilityId ?? null;

  const artifacts = selectedCapabilityId
    ? context.artifacts.filter(
        (artifact) => artifact.capability_id === selectedCapabilityId
      )
    : context.artifacts;

  return {
    application_id: context.row.application_id,
    candidate_id: context.row.candidate_id,
    identity_state: context.row.identity_state,
    identity_source: context.row.identity_source,
    identity_reason: context.row.identity_reason,
    full_name: context.row.full_name,
    avatar_url: context.row.avatar_url,
    job_role: context.row.job_role,
    capability_summary: context.row.capability_summary,
    selected_capability_id: selectedCapabilityId,
    artifacts,
    panel_state: determinePanelState(artifacts),
  };
}
