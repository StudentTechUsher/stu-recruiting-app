import { deriveCapabilitiesFromEvidence, resolveRoleCapabilityIds, type RoleCapabilityMap } from "@/lib/capabilities/derivation";
import {
  buildEvidenceFreshnessMarker,
  computeCapabilityProfileFit,
  parseActiveCapabilityProfiles,
  toStringArray,
  toTrimmedString,
  type ActiveCapabilityProfileSelection,
  type CapabilityProfileFitAxis,
  type CapabilityProfileOption,
} from "@/lib/student/capability-targeting";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createHash } from "node:crypto";

type ShareLinkRow = {
  profile_id: string;
  share_slug: string;
};

type ProfileRow = {
  role: string | null;
  personal_info: unknown;
};

type StudentRow = {
  student_data: unknown;
};

type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  updated_at: string | null;
  is_active: boolean | null;
};

type CapabilityModelRow = {
  capability_model_id: string;
  model_data: unknown;
};

type JobRoleMappingRow = {
  role_name_normalized: string | null;
  role_data: unknown;
};

type StudentProfileLookupRow = {
  profile_id: string;
  profiles:
    | {
        role: string | null;
        personal_info: unknown;
      }
    | Array<{
        role: string | null;
        personal_info: unknown;
      }>
    | null;
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

type ServiceRoleSupabaseClient = NonNullable<ReturnType<typeof getSupabaseServiceRoleClient>>;

export type PublicHiringSignalLevel = "Weak" | "Weak-leaning" | "Moderate" | "Strong-leaning" | "Strong";
export type PublicVerificationState = "verified" | "pending" | "unverified";

export type PublicEvidenceTargetAxis = {
  capability_id: string;
  label: string;
  target_magnitude: number;
  evidence_magnitude: number;
  evidence_state: "missing" | "tentative" | "strong";
};

export type PublicStudentTarget = {
  capability_profile_id: string;
  role_label: string;
  company_label: string;
  priority_label: "Primary" | "Secondary";
  alignment_percent: number | null;
  axes: PublicEvidenceTargetAxis[];
};

export type PublicStudentArtifact = {
  artifact_id: string;
  artifact_type: string;
  title: string;
  source: string;
  description: string | null;
  verification_status: PublicVerificationState;
  updated_at: string | null;
  capability_id: string;
  capability_label: string;
};

export type PublicStudentShareProfile = {
  share_slug: string;
  share_path: string;
  candidate: {
    full_name: string;
    avatar_url: string | null;
    education_summary: string | null;
    headline: string | null;
    location: string | null;
    target_roles: string[];
    target_companies: string[];
  };
  signals: {
    capability_coverage_percent: number;
    verified_evidence_share: number;
    overall_hiring_signal: PublicHiringSignalLevel;
    evidence_count: number;
    total_linked_evidence: number;
    last_updated_at: string | null;
  };
  capability_summary: Array<{
    capability_id: string;
    label: string;
    evidence_count: number;
  }>;
  targets: PublicStudentTarget[];
  artifacts: PublicStudentArtifact[];
};

type AvatarFileRef = {
  bucket: string;
  path: string;
};

const AVATAR_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toNumericRecord = (value: unknown): Record<string, number> => {
  const record = toRecord(value);
  const parsed: Record<string, number> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) continue;
    parsed[normalizedKey] = raw;
  }
  return parsed;
};

const toVerificationState = (value: unknown): PublicVerificationState => {
  const normalized = toTrimmedString(value)?.toLowerCase();
  if (normalized === "verified" || normalized === "pending" || normalized === "unverified") {
    return normalized;
  }
  return "unverified";
};

const normalizeRoleName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const calculateAlignmentPercent = (axes: PublicEvidenceTargetAxis[]): number | null => {
  if (axes.length === 0) return null;
  const targetTotal = axes.reduce((sum, axis) => sum + clamp01(axis.target_magnitude), 0);
  if (targetTotal <= 0) return null;
  const overlapTotal = axes.reduce(
    (sum, axis) => sum + Math.min(clamp01(axis.evidence_magnitude), clamp01(axis.target_magnitude)),
    0
  );
  return Math.round((overlapTotal / targetTotal) * 100);
};

const resolveOverallHiringSignal = ({
  coveragePercent,
  verifiedShare,
}: {
  coveragePercent: number;
  verifiedShare: number;
}): PublicHiringSignalLevel => {
  const coverageWeight = Math.max(0, Math.min(coveragePercent, 100)) / 100;
  const verifiedWeight = Math.max(0, Math.min(verifiedShare, 1));
  const score = coverageWeight * 0.65 + verifiedWeight * 0.35;
  if (score < 0.2) return "Weak";
  if (score < 0.4) return "Weak-leaning";
  if (score < 0.6) return "Moderate";
  if (score < 0.8) return "Strong-leaning";
  return "Strong";
};

const dedupePreservingOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
};

const slugifyShareHandle = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 64);
};

const deriveLegacyShareSlug = ({
  profileId,
  personalInfo,
}: {
  profileId: string;
  personalInfo: Record<string, unknown>;
}): string => {
  const fullName = toTrimmedString(personalInfo.full_name);
  const firstName = toTrimmedString(personalInfo.first_name);
  const lastName = toTrimmedString(personalInfo.last_name);
  const email = toTrimmedString(personalInfo.email);
  const emailLocalPart = email ? email.split("@")[0]?.trim() ?? "" : "";
  const nameCandidate = fullName ?? [firstName, lastName].filter(Boolean).join(" ");
  const baseCandidate = slugifyShareHandle(nameCandidate || emailLocalPart || "student");
  if (baseCandidate.length >= 3) return baseCandidate;
  const suffix = createHash("sha256").update(profileId).digest("hex").slice(0, 6);
  return `student-${suffix}`;
};

const deriveLegacyFallbackShareSlug = ({
  profileId,
  baseSlug,
}: {
  profileId: string;
  baseSlug: string;
}): string => {
  const suffix = createHash("sha256").update(profileId).digest("hex").slice(0, 6);
  const withSuffix = `${baseSlug.slice(0, 57)}-${suffix}`.replace(/^-+|-+$/g, "");
  return withSuffix || `student-${suffix}`;
};

const getOne = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const resolveProfileIdByLegacyDerivedSlug = async ({
  supabase,
  slug,
}: {
  supabase: ServiceRoleSupabaseClient;
  slug: string;
}): Promise<{ profile_id: string } | null> => {
  const studentQuery = (await supabase
    .from("students")
    .select("profile_id, profiles:profiles!students_profile_id_fkey(role, personal_info)")
    .limit(5000)) as { data: StudentProfileLookupRow[] | null; error: unknown };
  if (studentQuery.error) return null;

  const matches = new Set<string>();
  for (const row of studentQuery.data ?? []) {
    const profile = getOne(row.profiles);
    if (!profile || profile.role !== "student") continue;
    const personalInfo = toRecord(profile.personal_info);
    const primarySlug = deriveLegacyShareSlug({
      profileId: row.profile_id,
      personalInfo,
    });
    const fallbackSlug = deriveLegacyFallbackShareSlug({
      profileId: row.profile_id,
      baseSlug: primarySlug,
    });
    if (slug === primarySlug || slug === fallbackSlug) {
      matches.add(row.profile_id);
    }
  }

  if (matches.size !== 1) return null;
  const profileId = Array.from(matches)[0];
  if (!profileId) return null;
  return { profile_id: profileId };
};

const resolveDisplayName = (personalInfo: Record<string, unknown>): string => {
  const fullName = toTrimmedString(personalInfo.full_name);
  if (fullName) return fullName;
  const firstName = toTrimmedString(personalInfo.first_name);
  const lastName = toTrimmedString(personalInfo.last_name);
  const joined = [firstName, lastName].filter(Boolean).join(" ");
  if (joined.trim().length > 0) return joined;
  const email = toTrimmedString(personalInfo.email);
  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) return localPart;
  }
  return "Student";
};

const toShortText = (value: string | null, limit = 180): string | null => {
  if (!value) return null;
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
};

const resolveHeadline = ({
  personalInfo,
  studentData,
  targetRoles,
}: {
  personalInfo: Record<string, unknown>;
  studentData: Record<string, unknown>;
  targetRoles: string[];
}): string | null => {
  const candidate =
    toTrimmedString(personalInfo.headline) ??
    toTrimmedString(personalInfo.title) ??
    toTrimmedString(studentData.headline) ??
    toTrimmedString(studentData.professional_headline) ??
    toTrimmedString(studentData.summary) ??
    toTrimmedString(studentData.professional_summary) ??
    null;

  if (candidate) return toShortText(candidate, 140);
  const primaryRole = targetRoles[0];
  return primaryRole ? `${primaryRole} candidate` : null;
};

const resolveLocation = ({
  personalInfo,
  studentData,
}: {
  personalInfo: Record<string, unknown>;
  studentData: Record<string, unknown>;
}): string | null => {
  const direct =
    toTrimmedString(personalInfo.location) ??
    toTrimmedString(studentData.location) ??
    toTrimmedString(personalInfo.city_state) ??
    null;
  if (direct) return direct;

  const city = toTrimmedString(personalInfo.city);
  const state = toTrimmedString(personalInfo.state);
  const country = toTrimmedString(personalInfo.country);
  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  return city ?? state ?? country ?? null;
};

const resolveEducationSummary = ({
  personalInfo,
  studentData,
}: {
  personalInfo: Record<string, unknown>;
  studentData: Record<string, unknown>;
}): string | null => {
  const university =
    toTrimmedString(personalInfo.university) ??
    toTrimmedString(personalInfo.school) ??
    toTrimmedString(studentData.university) ??
    toTrimmedString(studentData.school);
  const fieldOfStudy =
    toTrimmedString(personalInfo.field_of_study) ??
    toTrimmedString(personalInfo.major) ??
    toTrimmedString(studentData.field_of_study) ??
    toTrimmedString(studentData.major) ??
    toTrimmedString(studentData.major_track);
  const graduationYear =
    toTrimmedString(personalInfo.graduation_year) ??
    toTrimmedString(personalInfo.estimated_graduation_year) ??
    toTrimmedString(studentData.graduation_year) ??
    toTrimmedString(studentData.estimated_graduation_year);

  const parts: string[] = [];
  if (fieldOfStudy) parts.push(fieldOfStudy);
  if (graduationYear) parts.push(`Cohort of ${graduationYear}`);
  if (university) parts.push(university);
  if (parts.length === 0) return null;
  return parts.join(", ");
};

const parseAvatarFileRef = (value: unknown): AvatarFileRef | null => {
  const parsed = toRecord(value);
  const bucket = toTrimmedString(parsed.bucket);
  const path = toTrimmedString(parsed.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

const resolveAvatarUrl = async ({
  supabase,
  personalInfo,
}: {
  supabase: unknown;
  personalInfo: Record<string, unknown>;
}): Promise<string | null> => {
  const fallbackAvatarUrl = toTrimmedString(personalInfo.avatar_url) ?? toTrimmedString(personalInfo.avatarUrl);
  const avatarFileRef = parseAvatarFileRef(personalInfo.avatar_file_ref ?? personalInfo.avatarFileRef);
  if (!avatarFileRef || !supabase) return fallbackAvatarUrl;

  const storageClient = supabase as SupabaseStorageClient;
  const { data, error } = await storageClient.storage
    .from(avatarFileRef.bucket)
    .createSignedUrl(avatarFileRef.path, AVATAR_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return fallbackAvatarUrl;
  return data.signedUrl;
};

const resolveCapabilityFromArtifactType = (artifactType: string): { capabilityId: string; capabilityLabel: string } => {
  const normalized = artifactType.trim().toLowerCase();
  const capabilityId = artifactTypeToCapabilityId[normalized] ?? "other_evidence";
  return {
    capabilityId,
    capabilityLabel: capabilityLabelById[capabilityId] ?? "Other Evidence",
  };
};

const asPublicArtifact = (row: ArtifactRow): PublicStudentArtifact => {
  const artifactData = toRecord(row.artifact_data);
  const title =
    toTrimmedString(artifactData.title) ??
    toTrimmedString(artifactData.course_title) ??
    toTrimmedString(artifactData.project_title) ??
    toTrimmedString(artifactData.job_title) ??
    toTrimmedString(artifactData.certification_name) ??
    toTrimmedString(artifactData.assessment_name) ??
    toTrimmedString(artifactData.competition_name) ??
    toTrimmedString(artifactData.research_title) ??
    "Evidence";
  const source =
    toTrimmedString(artifactData.source) ??
    toTrimmedString(artifactData.organization) ??
    toTrimmedString(artifactData.company) ??
    row.artifact_type;
  const description = toShortText(
    toTrimmedString(artifactData.description) ??
      toTrimmedString(artifactData.impact_statement) ??
      toTrimmedString(artifactData.summary),
    240
  );
  const { capabilityId, capabilityLabel } = resolveCapabilityFromArtifactType(row.artifact_type);

  return {
    artifact_id: row.artifact_id,
    artifact_type: row.artifact_type,
    title,
    source,
    description,
    verification_status: toVerificationState(artifactData.verification_status),
    updated_at: row.updated_at,
    capability_id: capabilityId,
    capability_label: capabilityLabel,
  };
};

const buildCapabilitySummary = (artifacts: PublicStudentArtifact[]) => {
  const countByCapability = new Map<string, { label: string; evidence_count: number }>();
  for (const artifact of artifacts) {
    const existing = countByCapability.get(artifact.capability_id);
    if (existing) {
      existing.evidence_count += 1;
      continue;
    }
    countByCapability.set(artifact.capability_id, {
      label: artifact.capability_label,
      evidence_count: 1,
    });
  }

  return Array.from(countByCapability.entries())
    .map(([capabilityId, value]) => ({
      capability_id: capabilityId,
      label: value.label,
      evidence_count: value.evidence_count,
    }))
    .sort((first, second) => second.evidence_count - first.evidence_count || first.label.localeCompare(second.label));
};

const toRadarAxes = (axes: CapabilityProfileFitAxis[]): PublicEvidenceTargetAxis[] =>
  axes.map((axis) => ({
    capability_id: axis.capability_id,
    label: axis.label,
    target_magnitude: axis.target_magnitude,
    evidence_magnitude: axis.evidence_magnitude,
    evidence_state: axis.evidence_state,
  }));

const buildDbRoleCapabilityMap = async ({
  supabase,
  selectedRoles,
}: {
  supabase: ServiceRoleSupabaseClient;
  selectedRoles: string[];
}): Promise<RoleCapabilityMap | null> => {
  if (selectedRoles.length === 0) return null;

  const normalizedRoles = Array.from(new Set(selectedRoles.map(normalizeRoleName).filter((role) => role.length > 0)));
  if (normalizedRoles.length === 0) return null;

  const roleQuery = (await supabase
    .from("job_roles")
    .select("role_name_normalized, role_data")
    .in("role_name_normalized", normalizedRoles)) as { data: JobRoleMappingRow[] | null; error: unknown };
  if (roleQuery.error) return null;

  const roleCapabilityMap: RoleCapabilityMap = {};
  for (const row of roleQuery.data ?? []) {
    const roleName = row.role_name_normalized?.trim().toLowerCase() ?? "";
    if (!roleName) continue;
    const roleData = toRecord(row.role_data);
    const capabilityIds = Array.isArray(roleData.capability_ids)
      ? roleData.capability_ids
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];
    if (capabilityIds.length === 0) continue;
    roleCapabilityMap[roleName] = Array.from(new Set(capabilityIds));
  }

  return Object.keys(roleCapabilityMap).length > 0 ? roleCapabilityMap : null;
};

const toCapabilityProfileOption = ({
  selection,
  modelById,
  capabilityIdsByRole,
}: {
  selection: ActiveCapabilityProfileSelection;
  modelById: Map<string, CapabilityModelRow>;
  capabilityIdsByRole: Map<string, string[]>;
}): CapabilityProfileOption => {
  const modelData = toRecord(modelById.get(selection.capability_profile_id)?.model_data);
  const weights = toNumericRecord(modelData.weights);
  const weightedCapabilityIds = Object.keys(weights).filter((capabilityId) => capabilityId.trim().length > 0);
  const mappedRoleCapabilities = capabilityIdsByRole.get(normalizeRoleName(selection.role_label)) ?? [];
  const fallbackRoleCapabilities = mappedRoleCapabilities.length > 0
    ? mappedRoleCapabilities
    : resolveRoleCapabilityIds([selection.role_label]);
  const capabilityIds = weightedCapabilityIds.length > 0 ? weightedCapabilityIds : fallbackRoleCapabilities;

  return {
    capability_profile_id: selection.capability_profile_id,
    company_id: selection.company_id,
    company_label: selection.company_label,
    role_id: selection.role_id,
    role_label: selection.role_label,
    capability_ids: Array.from(new Set(capabilityIds)),
    target_weights: weights,
    updated_at: "",
  };
};

export async function getPublicStudentShareProfileBySlug(inputSlug: string): Promise<PublicStudentShareProfile | null> {
  const slug = inputSlug.trim().toLowerCase();
  if (!slug) return null;

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;

  const shareQuery = (await supabase
    .from("student_share_links")
    .select("profile_id, share_slug")
    .eq("share_slug", slug)
    .limit(1)) as { data: ShareLinkRow[] | null; error: unknown };
  let shareLink = shareQuery.data?.[0] ?? null;
  if (!shareLink || !shareLink.profile_id) {
    const derivedProfile = await resolveProfileIdByLegacyDerivedSlug({
      supabase,
      slug,
    });
    if (!derivedProfile) return null;

    shareLink = {
      profile_id: derivedProfile.profile_id,
      share_slug: slug,
    };

    // Best-effort self-heal for rows missing from student_share_links.
    try {
      await supabase
        .from("student_share_links")
        .upsert({ profile_id: derivedProfile.profile_id, share_slug: slug }, { onConflict: "profile_id" });
    } catch {
      // no-op
    }
  }

  const [{ data: profileRows }, { data: studentRows }, { data: artifactRows }] = (await Promise.all([
    supabase.from("profiles").select("role, personal_info").eq("id", shareLink.profile_id).limit(1),
    supabase.from("students").select("student_data").eq("profile_id", shareLink.profile_id).limit(1),
    supabase
      .from("artifacts")
      .select("artifact_id, artifact_type, artifact_data, updated_at, is_active")
      .eq("profile_id", shareLink.profile_id)
      .order("updated_at", { ascending: false }),
  ])) as [{ data: ProfileRow[] | null }, { data: StudentRow[] | null }, { data: ArtifactRow[] | null }];

  const profileRow = profileRows?.[0];
  if (!profileRow || profileRow.role !== "student") return null;

  const personalInfo = toRecord(profileRow.personal_info);
  const studentData = toRecord(studentRows?.[0]?.student_data);
  const activeArtifactRows = (artifactRows ?? []).filter((artifact) => artifact.is_active !== false);
  const publicArtifacts = activeArtifactRows.map(asPublicArtifact);

  const derivationArtifacts = activeArtifactRows.map((artifact) => ({
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    artifact_data: toRecord(artifact.artifact_data),
    updated_at: artifact.updated_at,
  }));
  const evidenceFreshnessMarker = buildEvidenceFreshnessMarker(derivationArtifacts);

  const activeSelections = parseActiveCapabilityProfiles(studentData.active_capability_profiles);
  const legacyRoles = toStringArray(studentData.target_roles);
  const legacyCompanies = toStringArray(studentData.target_companies);
  const selectedRoles = dedupePreservingOrder(
    activeSelections.length > 0 ? activeSelections.map((selection) => selection.role_label) : legacyRoles
  );
  const selectedCompanies = dedupePreservingOrder(
    activeSelections.length > 0 ? activeSelections.map((selection) => selection.company_label) : legacyCompanies
  );

  const dbRoleCapabilityMap = await buildDbRoleCapabilityMap({
    supabase,
    selectedRoles,
  });
  const derived = deriveCapabilitiesFromEvidence({
    selectedRoles,
    artifacts: derivationArtifacts,
    roleCapabilityMap: dbRoleCapabilityMap ?? undefined,
  });
  const capabilityCoveragePercent =
    selectedRoles.length === 0
      ? Math.min(derived.kpis.capability_coverage_percent, 30)
      : derived.kpis.capability_coverage_percent;

  const targetProfiles: PublicStudentTarget[] = [];
  if (activeSelections.length > 0) {
    const capabilityProfileIds = activeSelections.map((selection) => selection.capability_profile_id);
    const normalizedRoleNames = Array.from(new Set(activeSelections.map((selection) => normalizeRoleName(selection.role_label))));

    const [modelQuery, roleQuery] = (await Promise.all([
      supabase
        .from("capability_models")
        .select("capability_model_id, model_data")
        .in("capability_model_id", capabilityProfileIds),
      normalizedRoleNames.length > 0
        ? supabase
            .from("job_roles")
            .select("role_name_normalized, role_data")
            .in("role_name_normalized", normalizedRoleNames)
        : Promise.resolve({ data: [] }),
    ])) as [{ data: CapabilityModelRow[] | null }, { data: JobRoleMappingRow[] | null }];

    const modelById = new Map((modelQuery.data ?? []).map((model) => [model.capability_model_id, model]));
    const capabilityIdsByRole = new Map<string, string[]>();
    for (const roleRow of roleQuery.data ?? []) {
      const roleName = roleRow.role_name_normalized?.trim().toLowerCase() ?? "";
      if (!roleName) continue;
      const roleData = toRecord(roleRow.role_data);
      const capabilityIds = Array.isArray(roleData.capability_ids)
        ? roleData.capability_ids
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [];
      capabilityIdsByRole.set(roleName, Array.from(new Set(capabilityIds)));
    }

    for (const [index, selection] of activeSelections.entries()) {
      const profileOption = toCapabilityProfileOption({
        selection,
        modelById,
        capabilityIdsByRole,
      });
      const fit = computeCapabilityProfileFit({
        profile: profileOption,
        artifacts: derivationArtifacts,
        evidenceFreshnessMarker,
      });
      const axes = toRadarAxes(fit.axes);
      targetProfiles.push({
        capability_profile_id: selection.capability_profile_id,
        role_label: selection.role_label,
        company_label: selection.company_label,
        priority_label: index === 0 ? "Primary" : "Secondary",
        alignment_percent: calculateAlignmentPercent(axes),
        axes,
      });
    }
  }

  const fullName = resolveDisplayName(personalInfo);
  const avatarUrl = await resolveAvatarUrl({
    supabase,
    personalInfo,
  });

  return {
    share_slug: shareLink.share_slug,
    share_path: `/u/${shareLink.share_slug}`,
    candidate: {
      full_name: fullName,
      avatar_url: avatarUrl,
      education_summary: resolveEducationSummary({
        personalInfo,
        studentData,
      }),
      headline: resolveHeadline({
        personalInfo,
        studentData,
        targetRoles: selectedRoles,
      }),
      location: resolveLocation({
        personalInfo,
        studentData,
      }),
      target_roles: selectedRoles,
      target_companies: selectedCompanies,
    },
    signals: {
      capability_coverage_percent: capabilityCoveragePercent,
      verified_evidence_share: derived.kpis.verified_evidence_share,
      overall_hiring_signal: resolveOverallHiringSignal({
        coveragePercent: capabilityCoveragePercent,
        verifiedShare: derived.kpis.verified_evidence_share,
      }),
      evidence_count: derived.kpis.evidence_count,
      total_linked_evidence: derived.kpis.total_linked_evidence,
      last_updated_at: derived.kpis.last_updated_at,
    },
    capability_summary: buildCapabilitySummary(publicArtifacts),
    targets: targetProfiles,
    artifacts: publicArtifacts,
  };
}
