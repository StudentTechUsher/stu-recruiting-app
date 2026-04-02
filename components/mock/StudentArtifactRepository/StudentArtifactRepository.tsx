import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  EvidenceTargetRadar,
  calculateEvidenceTargetAlignmentPercent,
  type EvidenceTargetRadarAxis
} from '@/components/student/EvidenceTargetRadar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type ArtifactType =
  | 'coursework'
  | 'club'
  | 'project'
  | 'internship'
  | 'certification'
  | 'leadership'
  | 'competition'
  | 'research'
  | 'employment'
  | 'test';
type ArtifactFilter = 'all' | ArtifactType;

type ArtifactTag =
  | 'Technical depth'
  | 'Applied execution'
  | 'Collaboration signal'
  | 'Systems thinking'
  | 'Communication signal'
  | 'Reliability signal';

type ArtifactRecord = {
  id: string;
  title: string;
  type: ArtifactType;
  artifactData: Record<string, unknown>;
  fileRefs: Array<Record<string, unknown>>;
  sourceProvenance: Record<string, unknown>;
  sourceObjectId?: string;
  ingestionRunId?: string;
  activeVersionId?: string;
  versionCount: number;
  provenanceVersions: Array<{
    versionId: string;
    operation: string;
    createdAt: string;
    verificationStatus?: string;
  }>;
  source: string;
  description: string;
  link?: string;
  attachmentName?: string;
  referenceContactName?: string;
  referenceContactRole?: string;
  referenceQuote?: string;
  tags: ArtifactTag[];
  updatedAt: string;
};

type ArtifactApiRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  file_refs: unknown;
  source_provenance?: unknown;
  source_object_id?: string | null;
  ingestion_run_id?: string | null;
  active_version_id?: string | null;
  version_count?: number | null;
  provenance_versions?: unknown;
  created_at: string;
  updated_at: string;
};

type SourceExtractionEntry = {
  last_extracted_at?: string;
  extracted_from?: string;
  extracted_from_filename?: string;
  artifact_count?: number;
  status?: 'extracting' | 'succeeded' | 'failed';
  error_message?: string | null;
  storage_file_ref?: {
    bucket?: string;
    path?: string;
    kind?: string;
  };
};

type SourceExtractionLog = {
  github?: SourceExtractionEntry;
  kaggle?: SourceExtractionEntry;
  leetcode?: SourceExtractionEntry;
  linkedin?: SourceExtractionEntry;
  resume?: SourceExtractionEntry;
  transcript?: SourceExtractionEntry;
};

type ArtifactsApiPayload = {
  artifacts?: ArtifactApiRow[];
  source_extraction_log?: SourceExtractionLog;
  profile_links?: Record<string, string | null>;
};

type ActiveCapabilityProfile = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: 'manual' | 'agent_recommended' | 'agent_confirmed' | 'migrated_legacy';
  status: 'active';
};

type CapabilityProfileFit = {
  capability_profile_id: string;
  company_label: string;
  role_label: string;
  axes: EvidenceTargetRadarAxis[];
  generated_at: string;
  evidence_freshness_marker: string;
};

type CapabilityTargetsPayload = {
  active_capability_profiles: ActiveCapabilityProfile[];
  fit_by_capability_profile_id: Record<string, CapabilityProfileFit>;
};

type AiLiteracyStatus = 'not_started' | 'in_progress' | 'partial_available' | 'available' | 'needs_attention';

type AiLiteracyPayload = {
  ai_literacy?: {
    status: AiLiteracyStatus;
    profile_coverage_percent: number;
    recruiter_safe_coverage_percent: number;
    domains_with_profile_signal: number;
    total_role_relevant_domains: number;
    last_evaluated_at: string | null;
    has_selected_capability_model?: boolean;
  };
};

type SnackbarState = { kind: 'success' | 'error' | 'info'; message: string } | null;
type ArtifactVerificationStatus = 'verified' | 'pending' | 'unverified';

type DraftArtifactForm = {
  courseCode: string;
  courseTitle: string;
  instructorName: string;
  courseImpact: string;
  projectTitle: string;
  projectDescription: string;
  projectDemoLink: string;
  internshipCompany: string;
  internshipJobTitle: string;
  internshipStartDate: string;
  internshipEndDate: string;
  internshipMentorEmail: string;
  internshipImpact: string;
  certificationName: string;
  certificationAwardedDate: string;
  leadershipOrganization: string;
  leadershipPosition: string;
  leadershipImpact: string;
  competitionName: string;
  competitionPerformance: string;
  competitionPrompt: string;
  researchTitle: string;
  researchArea: string;
  researchAdvisor: string;
  researchImpact: string;
  jobExperienceCompany: string;
  jobExperienceTitle: string;
  jobExperienceStartDate: string;
  jobExperienceEndDate: string;
  jobExperienceImpact: string;
  testName: string;
  testProvider: string;
  testScore: string;
  testEvidenceLink: string;
};

const initialDraftArtifactForm: DraftArtifactForm = {
  courseCode: '',
  courseTitle: '',
  instructorName: '',
  courseImpact: '',
  projectTitle: '',
  projectDescription: '',
  projectDemoLink: '',
  internshipCompany: '',
  internshipJobTitle: '',
  internshipStartDate: '',
  internshipEndDate: '',
  internshipMentorEmail: '',
  internshipImpact: '',
  certificationName: '',
  certificationAwardedDate: '',
  leadershipOrganization: '',
  leadershipPosition: '',
  leadershipImpact: '',
  competitionName: '',
  competitionPerformance: '',
  competitionPrompt: '',
  researchTitle: '',
  researchArea: '',
  researchAdvisor: '',
  researchImpact: '',
  jobExperienceCompany: '',
  jobExperienceTitle: '',
  jobExperienceStartDate: '',
  jobExperienceEndDate: '',
  jobExperienceImpact: '',
  testName: '',
  testProvider: '',
  testScore: '',
  testEvidenceLink: ''
};

const artifactTypes: Array<{ id: ArtifactType; label: string }> = [
  { id: 'coursework', label: 'Coursework' },
  { id: 'club', label: 'Club' },
  { id: 'project', label: 'Project' },
  { id: 'internship', label: 'Internship' },
  { id: 'certification', label: 'Certification' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'competition', label: 'Competition' },
  { id: 'research', label: 'Research' },
  { id: 'employment', label: 'Employment' },
  { id: 'test', label: 'Test evidence' }
];

const artifactTypeLabelMap: Record<ArtifactType, string> = {
  coursework: 'Coursework',
  club: 'Club',
  project: 'Project',
  internship: 'Internship',
  certification: 'Certification',
  leadership: 'Leadership',
  competition: 'Competition',
  research: 'Research',
  employment: 'Employment',
  test: 'Test evidence'
};

const artifactTypeSourcePreset: Record<ArtifactType, string> = {
  coursework: 'SIS sync',
  club: 'Club participation',
  project: 'GitHub',
  internship: 'Internship evidence',
  certification: 'Certification upload',
  leadership: 'Activity record',
  competition: 'Competition record',
  research: 'Research record',
  employment: 'Professional experience',
  test: 'Performance score report'
};

const artifactTypeTagPreset: Record<ArtifactType, ArtifactTag[]> = {
  coursework: ['Technical depth', 'Systems thinking'],
  club: ['Collaboration signal', 'Communication signal'],
  project: ['Applied execution', 'Technical depth'],
  internship: ['Applied execution', 'Communication signal'],
  certification: ['Technical depth', 'Reliability signal'],
  leadership: ['Collaboration signal', 'Communication signal'],
  competition: ['Applied execution', 'Collaboration signal'],
  research: ['Technical depth', 'Communication signal'],
  employment: ['Applied execution', 'Reliability signal'],
  test: ['Reliability signal', 'Systems thinking']
};

const artifactTypeToneClass: Record<ArtifactType, string> = {
  coursework: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  club: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  project: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  internship: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  certification: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  leadership: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  competition: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  research: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  employment: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  test: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
};

const minArtifactsSkeletonMs = 350;
const artifactIntroTourStorageKey = 'stu_artifact_intro_seen_v1';

const tagToneClass: Record<ArtifactTag, string> = {
  'Technical depth': 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  'Applied execution': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  'Collaboration signal': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'Systems thinking': 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  'Communication signal': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'Reliability signal': 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100'
};

const formatDate = () =>
  new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toFileRefs = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry))
    .map((entry) => entry as Record<string, unknown>);
};

const isTranscriptBackedCoursework = (artifactData: Record<string, unknown>): boolean => {
  const parsedCourseId = toTrimmedString(artifactData.parsed_course_id);
  if (parsedCourseId) return true;
  const provenance = toRecord(artifactData.provenance);
  return toTrimmedString(provenance.source) === 'transcript_parse';
};

const hasCourseworkVerificationFile = (fileRefs: Array<Record<string, unknown>>): boolean => {
  if (fileRefs.length === 0) return false;
  return fileRefs.some((ref) => {
    const kind = toTrimmedString(ref.kind);
    return kind === 'syllabus' || kind === 'artifact_supporting_file';
  });
};

const getArtifactVerificationStatus = (artifact: ArtifactRecord): ArtifactVerificationStatus => {
  const verificationStatus = toTrimmedString(artifact.artifactData.verification_status)?.toLowerCase();
  if (verificationStatus === 'verified') return 'verified';
  if (verificationStatus === 'pending') return 'pending';
  if (verificationStatus === 'unverified') return 'unverified';
  if (isTranscriptBackedCoursework(artifact.artifactData)) return 'verified';
  return 'unverified';
};

const verificationToneClass: Record<ArtifactVerificationStatus, string> = {
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100',
  pending: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-100',
  unverified: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100'
};

const verificationStatusLabel: Record<ArtifactVerificationStatus, string> = {
  verified: 'Verified',
  pending: 'Pending verification',
  unverified: 'Unverified'
};

type ArtifactVerificationConfig = {
  title: string;
  helpText: string;
  methods: Array<{ value: string; label: string }>;
  requireContactEmail?: boolean;
  requireEvidenceUrl?: boolean;
  requireContactOrEvidenceUrl?: boolean;
  requireSyllabusForCoursework?: boolean;
};

const verificationConfigByType: Record<ArtifactType, ArtifactVerificationConfig> = {
  coursework: {
    title: 'Submit coursework verification',
    helpText: 'Manual coursework requires a syllabus or supporting file to move into verification review.',
    methods: [{ value: 'syllabus_upload', label: 'Syllabus upload review' }],
    requireSyllabusForCoursework: true
  },
  internship: {
    title: 'Submit internship verification',
    helpText: 'Provide a supervisor or mentor contact and verification source details.',
    methods: [
      { value: 'reference_confirmation', label: 'Reference confirmation' },
      { value: 'employer_email_confirmation', label: 'Employer email confirmation' }
    ],
    requireContactEmail: true
  },
  employment: {
    title: 'Submit employment verification',
    helpText: 'Provide a manager or HR contact and verification source details.',
    methods: [
      { value: 'reference_confirmation', label: 'Reference confirmation' },
      { value: 'employer_email_confirmation', label: 'Employer email confirmation' }
    ],
    requireContactEmail: true
  },
  project: {
    title: 'Submit project verification',
    helpText: 'Link to a concrete artifact (demo, repo, or portfolio) used for verification.',
    methods: [
      { value: 'artifact_link_review', label: 'Artifact link review' },
      { value: 'work_sample_review', label: 'Work sample review' }
    ],
    requireEvidenceUrl: true
  },
  certification: {
    title: 'Submit certification verification',
    helpText: 'Provide the credential URL or official provider record.',
    methods: [
      { value: 'credential_check', label: 'Credential check' },
      { value: 'provider_record_review', label: 'Provider record review' }
    ],
    requireEvidenceUrl: true
  },
  competition: {
    title: 'Submit competition verification',
    helpText: 'Provide a public result link or uploaded proof for review.',
    methods: [
      { value: 'competition_record_review', label: 'Competition record review' },
      { value: 'artifact_link_review', label: 'Artifact link review' }
    ],
    requireEvidenceUrl: true
  },
  research: {
    title: 'Submit research verification',
    helpText: 'Provide publication, repository, or lab record evidence.',
    methods: [
      { value: 'publication_review', label: 'Publication review' },
      { value: 'artifact_link_review', label: 'Artifact link review' }
    ],
    requireEvidenceUrl: true
  },
  test: {
    title: 'Submit assessment verification',
    helpText: 'Provide score report or provider-hosted evidence URL.',
    methods: [
      { value: 'score_report_review', label: 'Score report review' },
      { value: 'provider_record_review', label: 'Provider record review' }
    ],
    requireEvidenceUrl: true
  },
  leadership: {
    title: 'Submit leadership verification',
    helpText: 'Provide organization contact or public role evidence.',
    methods: [
      { value: 'organization_confirmation', label: 'Organization confirmation' },
      { value: 'public_reference_review', label: 'Public reference review' }
    ],
    requireContactOrEvidenceUrl: true
  },
  club: {
    title: 'Submit club verification',
    helpText: 'Provide organization contact or public role evidence.',
    methods: [
      { value: 'organization_confirmation', label: 'Organization confirmation' },
      { value: 'public_reference_review', label: 'Public reference review' }
    ],
    requireContactOrEvidenceUrl: true
  }
};

const isArtifactType = (value: unknown): value is ArtifactType => {
  if (typeof value !== 'string') return false;
  return artifactTypes.some((type) => type.id === value);
};

const artifactTagLookup: Record<string, ArtifactTag> = {
  'technical depth': 'Technical depth',
  'applied execution': 'Applied execution',
  'collaboration signal': 'Collaboration signal',
  'systems thinking': 'Systems thinking',
  'communication signal': 'Communication signal',
  'reliability signal': 'Reliability signal'
};

const toArtifactTags = (value: unknown, fallbackType: ArtifactType): ArtifactTag[] => {
  if (!Array.isArray(value)) return [...artifactTypeTagPreset[fallbackType]];

  const deduped = new Map<string, ArtifactTag>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const normalizedKey = entry.trim().toLowerCase();
    const tag = artifactTagLookup[normalizedKey];
    if (!tag) continue;
    if (!deduped.has(tag)) deduped.set(tag, tag);
  }

  return deduped.size > 0 ? Array.from(deduped.values()) : [...artifactTypeTagPreset[fallbackType]];
};

const toUpdatedAtLabel = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) return formatDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDate();
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isYouTubeOrLoomUrl = (value: string): boolean => {
  const normalized = value.trim();
  if (normalized.length === 0) return false;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    return host === 'loom.com' || host.endsWith('.loom.com') || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  } catch {
    return false;
  }
};

const isValidHttpUrl = (value: string): boolean => {
  const normalized = value.trim();
  if (normalized.length === 0) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const PlusIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const CloseIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);


const ArtifactCardSkeleton = () => (
  <div className="rounded-2xl border border-[#d5e1db] bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-2">
      <div className="h-6 w-20 rounded-full bg-[#e6f1ec] dark:bg-slate-700" />
      <div className="h-4 w-12 rounded-full bg-[#e6f1ec] dark:bg-slate-700" />
    </div>
    <div className="mt-3 h-4 w-3/4 rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-2 h-3 w-1/2 rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-3 h-3 w-full rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-2 h-3 w-5/6 rounded bg-[#e6f1ec] dark:bg-slate-700" />
  </div>
);

const EvidenceVsTargetSummary = ({
  isLoading,
  capabilityTargets,
  compact = false
}: {
  isLoading: boolean;
  capabilityTargets: CapabilityTargetsPayload | null;
  compact?: boolean;
}) => {
  const activeTargets = capabilityTargets?.active_capability_profiles ?? [];
  const activeTargetsCount = activeTargets.length;
  const hasTargets = activeTargetsCount > 0;
  const useMultiColumnLayout = !compact && activeTargetsCount > 1;
  const showPriorityBadge = activeTargetsCount > 1;

  if (isLoading) {
    return (
      <div className={`mt-3 grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`} aria-hidden="true">
        <div className="h-[320px] animate-pulse rounded-xl border border-[#d4e1db] bg-[#f8fcfa] dark:border-slate-700 dark:bg-slate-900/70" />
        {!compact ? <div className="h-[320px] animate-pulse rounded-xl border border-[#d4e1db] bg-[#f8fcfa] dark:border-slate-700 dark:bg-slate-900/70" /> : null}
      </div>
    );
  }

  if (!hasTargets) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
        <p>No active capability targets selected yet.</p>
        <Link
          href="/student/targets"
          className="mt-2 inline-flex rounded-lg border border-amber-500/50 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-900 transition-colors hover:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
        >
          Open My Roles & Employers
        </Link>
      </div>
    );
  }

  const fitByCapabilityProfileId = capabilityTargets?.fit_by_capability_profile_id ?? {};

  return (
    <div className={`mt-3 grid gap-3 ${useMultiColumnLayout ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
      {activeTargets.map((target, index) => {
        const fit = fitByCapabilityProfileId[target.capability_profile_id];
        const alignmentPercent = fit?.axes?.length ? calculateEvidenceTargetAlignmentPercent(fit.axes) : null;
        return (
          <section
            key={`evidence-fit-${target.capability_profile_id}`}
            className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/70"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                {target.role_label} @ {target.company_label}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {alignmentPercent !== null ? `Alignment ${alignmentPercent}%` : 'Alignment --'}
                </span>
                {showPriorityBadge ? (
                  <span className="rounded-full border border-[#bfd2ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#21453a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                    {index === 0 ? 'Primary' : 'Secondary'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex min-h-[280px] items-center justify-center">
              {fit?.axes && fit.axes.length > 0 ? (
                <EvidenceTargetRadar axes={fit.axes} ariaLabel={`Evidence vs target for ${target.role_label} at ${target.company_label}`} />
              ) : (
                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
                  Fit data is loading. Refresh shortly.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const mapApiArtifactToRecord = (row: ArtifactApiRow): ArtifactRecord | null => {
  const data = toRecord(row.artifact_data);
  const typeCandidate = toTrimmedString(row.artifact_type) ?? toTrimmedString(data.type);
  if (typeCandidate === 'transcript') return null;
  const artifactType: ArtifactType = isArtifactType(typeCandidate) ? typeCandidate : 'project';

  const title = toTrimmedString(data.title) ?? `${artifactTypeLabelMap[artifactType]} artifact`;
  const source = toTrimmedString(data.source) ?? artifactTypeSourcePreset[artifactType];
  const description = toTrimmedString(data.description) ?? 'Student-linked evidence artifact.';

  const provenanceVersions = Array.isArray(row.provenance_versions)
    ? row.provenance_versions
        .map((entry) => toRecord(entry))
        .map((entry) => ({
          versionId: toTrimmedString(entry.version_id) ?? '',
          operation: toTrimmedString(entry.operation) ?? 'replace',
          createdAt: toUpdatedAtLabel(toTrimmedString(entry.created_at) ?? row.updated_at),
          verificationStatus: toTrimmedString(entry.verification_status) ?? undefined
        }))
        .filter((entry) => entry.versionId.length > 0)
    : [];

  return {
    id: row.artifact_id,
    title,
    type: artifactType,
    artifactData: data,
    fileRefs: toFileRefs(row.file_refs),
    sourceProvenance: toRecord(row.source_provenance),
    sourceObjectId: toTrimmedString(row.source_object_id) ?? undefined,
    ingestionRunId: toTrimmedString(row.ingestion_run_id) ?? undefined,
    activeVersionId: toTrimmedString(row.active_version_id) ?? undefined,
    versionCount:
      typeof row.version_count === 'number' && Number.isFinite(row.version_count)
        ? Math.max(1, Math.floor(row.version_count))
        : Math.max(1, provenanceVersions.length + 1),
    provenanceVersions,
    source,
    description,
    link: toTrimmedString(data.link) ?? undefined,
    attachmentName: toTrimmedString(data.attachment_name) ?? toTrimmedString(data.attachmentName) ?? undefined,
    referenceContactName: toTrimmedString(data.reference_contact_name) ?? toTrimmedString(data.referenceContactName) ?? undefined,
    referenceContactRole: toTrimmedString(data.reference_contact_role) ?? toTrimmedString(data.referenceContactRole) ?? undefined,
    referenceQuote: toTrimmedString(data.reference_quote) ?? toTrimmedString(data.referenceQuote) ?? undefined,
    tags: toArtifactTags(data.tags, artifactType),
    updatedAt: toUpdatedAtLabel(row.updated_at)
  };
};

const getArtifactDataString = (data: Record<string, unknown>, key: string, fallback = ''): string => {
  const value = toTrimmedString(data[key]);
  return value ?? fallback;
};

const toDraftFormFromArtifact = (artifact: ArtifactRecord): DraftArtifactForm => {
  const data = artifact.artifactData;
  const draft = { ...initialDraftArtifactForm };

  if (artifact.type === 'coursework') {
    draft.courseCode = getArtifactDataString(data, 'course_code');
    draft.courseTitle = getArtifactDataString(data, 'course_title');
    draft.instructorName = getArtifactDataString(data, 'instructor_name');
    draft.courseImpact = getArtifactDataString(data, 'impact_description');
  }

  if (artifact.type === 'project') {
    draft.projectTitle = getArtifactDataString(data, 'title', artifact.title);
    draft.projectDescription = getArtifactDataString(data, 'description', artifact.description);
    draft.projectDemoLink = getArtifactDataString(data, 'project_demo_link', artifact.link ?? '');
  }

  if (artifact.type === 'internship') {
    draft.internshipCompany = getArtifactDataString(data, 'company');
    draft.internshipJobTitle = getArtifactDataString(data, 'job_title');
    draft.internshipStartDate = getArtifactDataString(data, 'start_date');
    draft.internshipEndDate = getArtifactDataString(data, 'end_date');
    draft.internshipMentorEmail = getArtifactDataString(data, 'mentor_email');
    draft.internshipImpact = getArtifactDataString(data, 'impact_statement', artifact.description);
  }

  if (artifact.type === 'certification') {
    draft.certificationName = getArtifactDataString(data, 'certification_name', artifact.title);
    draft.certificationAwardedDate = getArtifactDataString(data, 'awarded_date');
  }

  if (artifact.type === 'leadership') {
    draft.leadershipOrganization = getArtifactDataString(data, 'organization');
    draft.leadershipPosition = getArtifactDataString(data, 'position');
    draft.leadershipImpact = getArtifactDataString(data, 'impact_statement', artifact.description);
  }

  if (artifact.type === 'club') {
    draft.leadershipOrganization = getArtifactDataString(data, 'organization');
    draft.leadershipPosition = getArtifactDataString(data, 'position');
    draft.leadershipImpact = getArtifactDataString(data, 'impact_statement', artifact.description);
  }

  if (artifact.type === 'competition') {
    draft.competitionName = getArtifactDataString(data, 'competition_name', artifact.title);
    draft.competitionPerformance = getArtifactDataString(data, 'performance');
    draft.competitionPrompt = getArtifactDataString(data, 'deliverable_note');
  }

  if (artifact.type === 'research') {
    draft.researchTitle = getArtifactDataString(data, 'research_title', artifact.title);
    draft.researchArea = getArtifactDataString(data, 'research_area');
    draft.researchAdvisor = getArtifactDataString(data, 'advisor');
    draft.researchImpact = getArtifactDataString(data, 'impact_statement', artifact.description);
  }

  if (artifact.type === 'employment') {
    draft.jobExperienceCompany = getArtifactDataString(data, 'company');
    draft.jobExperienceTitle = getArtifactDataString(data, 'job_title');
    draft.jobExperienceStartDate = getArtifactDataString(data, 'start_date');
    draft.jobExperienceEndDate = getArtifactDataString(data, 'end_date');
    draft.jobExperienceImpact = getArtifactDataString(data, 'impact_statement', artifact.description);
  }

  if (artifact.type === 'test') {
    draft.testName = getArtifactDataString(data, 'assessment_name', artifact.title);
    draft.testProvider = getArtifactDataString(data, 'provider', artifact.source);
    draft.testScore = getArtifactDataString(data, 'score');
    draft.testEvidenceLink = getArtifactDataString(data, 'link', artifact.link ?? '');
  }

  return draft;
};

type ImportSourceType = 'resume' | 'transcript' | 'github' | 'linkedin' | 'kaggle' | 'leetcode';
const importSourceTypes: ImportSourceType[] = ['resume', 'transcript', 'github', 'linkedin', 'kaggle', 'leetcode'];

const normalizeLinkedinUrl = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) return '';
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!parsed.hostname.toLowerCase().endsWith('linkedin.com')) return '';
    const cleanedPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanedPath.startsWith('/in/')) return '';
    return `https://www.linkedin.com${cleanedPath}`;
  } catch {
    return '';
  }
};

const normalizeGithubUrl = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) return '';
  const cleaned = trimmed.replace(/^@+/, '');
  if (!cleaned.includes('://') && !cleaned.includes('/')) return `https://github.com/${cleaned}`;
  try {
    const parsed = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return '';
    const [username] = parsed.pathname.split('/').filter(Boolean);
    return username ? `https://github.com/${username}` : '';
  } catch {
    return '';
  }
};

const normalizeKaggleUrl = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) return '';
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!parsed.hostname.toLowerCase().endsWith('kaggle.com')) return '';
    const [username] = parsed.pathname.split('/').filter(Boolean);
    return username ? `https://www.kaggle.com/${username}` : '';
  } catch {
    return '';
  }
};

const normalizeLeetcodeUrl = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) return '';
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!parsed.hostname.toLowerCase().endsWith('leetcode.com')) return '';
    const segments = parsed.pathname.split('/').filter(Boolean);
    const username = segments[0] === 'u' || segments[0] === 'profile' ? segments[1] : segments[0];
    return username ? `https://leetcode.com/u/${username}` : '';
  } catch {
    return '';
  }
};

const formatAiLiteracyStatus = (status: AiLiteracyStatus): string => {
  if (status === 'not_started') return 'Not Started';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'partial_available') return 'Partial Available';
  if (status === 'needs_attention') return 'Needs Attention';
  return 'Available';
};

export const StudentArtifactRepository = () => {
  const searchParams = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<ArtifactFilter>('all');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [showAddArtifactDialog, setShowAddArtifactDialog] = useState(false);
  const [showArtifactIntroTour, setShowArtifactIntroTour] = useState(false);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmittingArtifact, setIsSubmittingArtifact] = useState(false);
  const [isDeletingArtifact, setIsDeletingArtifact] = useState(false);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [showVerifyArtifactDialog, setShowVerifyArtifactDialog] = useState(false);
  const [verifyingArtifactId, setVerifyingArtifactId] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('');
  const [verificationContactEmail, setVerificationContactEmail] = useState('');
  const [verificationEvidenceUrl, setVerificationEvidenceUrl] = useState('');
  const [verificationSourceNote, setVerificationSourceNote] = useState('');
  const [verificationAttachmentName, setVerificationAttachmentName] = useState('');
  const hasAutoOpenedFromQueryRef = useRef(false);

  // Source extraction state
  const [sourceExtractionLog, setSourceExtractionLog] = useState<SourceExtractionLog>({});
  const [savedProfileLinks, setSavedProfileLinks] = useState<Record<string, string | null>>({});
  const [snackbar, setSnackbar] = useState<SnackbarState>(null);
  const [isTargetsLoading, setIsTargetsLoading] = useState(true);
  const [capabilityTargets, setCapabilityTargets] = useState<CapabilityTargetsPayload | null>(null);
  const [isAiLiteracyLoading, setIsAiLiteracyLoading] = useState(true);
  const [aiLiteracyStatus, setAiLiteracyStatus] = useState<AiLiteracyStatus>('not_started');
  const [aiLiteracyProfileCoverage, setAiLiteracyProfileCoverage] = useState(0);
  const [aiLiteracyRecruiterSafeCoverage, setAiLiteracyRecruiterSafeCoverage] = useState(0);
  const [aiLiteracyDomainsWithSignal, setAiLiteracyDomainsWithSignal] = useState(0);
  const [aiLiteracyTotalDomains, setAiLiteracyTotalDomains] = useState(0);
  const [aiLiteracyLastEvaluatedAt, setAiLiteracyLastEvaluatedAt] = useState<string | null>(null);
  const [hasSelectedCapabilityModel, setHasSelectedCapabilityModel] = useState(false);
  const [isGeneratingAiLiteracy, setIsGeneratingAiLiteracy] = useState(false);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);


  const [draftType, setDraftType] = useState<ArtifactType>('coursework');
  const [draftData, setDraftData] = useState<DraftArtifactForm>({ ...initialDraftArtifactForm });
  const [draftAttachmentName, setDraftAttachmentName] = useState('');
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const verificationDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const calculatedDraftTags = artifactTypeTagPreset[draftType];

  const filteredArtifacts = useMemo(() => {
    if (activeFilter === 'all') return artifacts;
    return artifacts.filter((artifact) => artifact.type === activeFilter);
  }, [activeFilter, artifacts]);
  const verifyingArtifact = useMemo(
    () => (verifyingArtifactId ? artifacts.find((artifact) => artifact.id === verifyingArtifactId) ?? null : null),
    [artifacts, verifyingArtifactId]
  );

  const sourceStatusSummary = useMemo(() => {
    const sourceLabels: Record<ImportSourceType, string> = {
      resume: 'Resume',
      transcript: 'Transcript',
      linkedin: 'LinkedIn',
      github: 'GitHub',
      kaggle: 'Kaggle',
      leetcode: 'LeetCode'
    };
    const normalizedLinks = {
      linkedin: normalizeLinkedinUrl(typeof savedProfileLinks.linkedin === 'string' ? savedProfileLinks.linkedin : null),
      github: normalizeGithubUrl(typeof savedProfileLinks.github === 'string' ? savedProfileLinks.github : null),
      kaggle: normalizeKaggleUrl(typeof savedProfileLinks.kaggle === 'string' ? savedProfileLinks.kaggle : null),
      leetcode: normalizeLeetcodeUrl(typeof savedProfileLinks.leetcode === 'string' ? savedProfileLinks.leetcode : null)
    };

    const needsUpdateSources: string[] = [];
    const failedSources: string[] = [];
    const extractingSources: string[] = [];
    let connectedCount = 0;

    for (const source of importSourceTypes) {
      const entry = sourceExtractionLog[source];
      const hasDocumentConnection =
        source === 'resume' || source === 'transcript'
          ? Boolean(entry?.extracted_from_filename || entry?.storage_file_ref?.path || entry?.storage_file_ref?.bucket)
          : false;
      const hasExternalConnection =
        source === 'linkedin'
          ? normalizedLinks.linkedin.length > 0
          : source === 'github'
            ? normalizedLinks.github.length > 0
            : source === 'kaggle'
              ? normalizedLinks.kaggle.length > 0
              : source === 'leetcode'
                ? normalizedLinks.leetcode.length > 0
              : false;
      const isConnected = hasDocumentConnection || hasExternalConnection;
      if (isConnected) connectedCount += 1;

      if (entry?.status === 'extracting') extractingSources.push(sourceLabels[source]);
      if (entry?.status === 'failed') failedSources.push(sourceLabels[source]);

      if (source === 'linkedin' || source === 'github' || source === 'kaggle' || source === 'leetcode') {
        const extractedFrom = typeof entry?.extracted_from === 'string' ? entry.extracted_from.trim() : '';
        const currentUrl =
          source === 'linkedin'
            ? normalizedLinks.linkedin
            : source === 'github'
              ? normalizedLinks.github
              : source === 'kaggle'
                ? normalizedLinks.kaggle
                : normalizedLinks.leetcode;
        if (currentUrl && (!extractedFrom || extractedFrom !== currentUrl)) needsUpdateSources.push(sourceLabels[source]);
      } else if (source === 'resume' || source === 'transcript') {
        if (hasDocumentConnection && entry?.status !== 'succeeded' && entry?.status !== 'extracting') {
          needsUpdateSources.push(sourceLabels[source]);
        }
      }
    }

    const contextLine =
      failedSources.length > 0
        ? `${failedSources[0]} failed`
        : needsUpdateSources.length > 0
          ? `${needsUpdateSources[0]} needs extraction`
          : extractingSources.length > 0
            ? `${extractingSources[0]} extracting`
            : connectedCount === 0
              ? 'No sources connected yet'
              : 'All connected sources are up to date';
    const attentionCount = failedSources.length + needsUpdateSources.length;
    const attentionLine = attentionCount > 1 ? `${attentionCount} sources need attention` : contextLine;

    return {
      connectedCount,
      extractingCount: extractingSources.length,
      needsUpdateCount: needsUpdateSources.length,
      failedCount: failedSources.length,
      contextLine: attentionCount > 1 ? attentionLine : contextLine
    };
  }, [savedProfileLinks.github, savedProfileLinks.kaggle, savedProfileLinks.leetcode, savedProfileLinks.linkedin, sourceExtractionLog]);

  const hasAnySuccessfulExtraction = useMemo(
    () => Object.values(sourceExtractionLog).some((entry) => entry?.status === 'succeeded'),
    [sourceExtractionLog]
  );
  const isFirstTimeExtractionUser = !isLoadingArtifacts && artifacts.length === 0 && !hasAnySuccessfulExtraction;
  const aiLiteracyLastEvaluatedLabel = useMemo(() => {
    if (!aiLiteracyLastEvaluatedAt) return 'Not evaluated yet';
    const parsed = new Date(aiLiteracyLastEvaluatedAt);
    if (Number.isNaN(parsed.getTime())) return 'Not evaluated yet';
    return parsed.toLocaleString();
  }, [aiLiteracyLastEvaluatedAt]);

  const showFirstArtifactTour = isFirstTimeExtractionUser && !showArtifactIntroTour;

  const loadCapabilityTargets = useCallback(async () => {
    setIsTargetsLoading(true);
    try {
      const response = await fetch('/api/student/capability-profiles', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data?: CapabilityTargetsPayload }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !payload || !payload.ok || !payload.data) {
        throw new Error('capability_targets_fetch_failed');
      }
      setCapabilityTargets(payload.data);
    } catch {
      setCapabilityTargets(null);
    } finally {
      setIsTargetsLoading(false);
    }
  }, []);

  const loadAiLiteracyMap = useCallback(async () => {
    setIsAiLiteracyLoading(true);
    try {
      const response = await fetch('/api/student/ai-literacy-map', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: AiLiteracyPayload }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok || !payload.data.ai_literacy) {
        throw new Error('ai_literacy_fetch_failed');
      }

      const aiLiteracy = payload.data.ai_literacy;
      setAiLiteracyStatus(aiLiteracy.status);
      setAiLiteracyProfileCoverage(aiLiteracy.profile_coverage_percent);
      setAiLiteracyRecruiterSafeCoverage(aiLiteracy.recruiter_safe_coverage_percent);
      setAiLiteracyDomainsWithSignal(aiLiteracy.domains_with_profile_signal);
      setAiLiteracyTotalDomains(aiLiteracy.total_role_relevant_domains);
      setAiLiteracyLastEvaluatedAt(aiLiteracy.last_evaluated_at);
      setHasSelectedCapabilityModel(Boolean(aiLiteracy.has_selected_capability_model));
    } catch {
      setAiLiteracyStatus('not_started');
      setAiLiteracyProfileCoverage(0);
      setAiLiteracyRecruiterSafeCoverage(0);
      setAiLiteracyDomainsWithSignal(0);
      setAiLiteracyTotalDomains(0);
      setAiLiteracyLastEvaluatedAt(null);
      setHasSelectedCapabilityModel(false);
    } finally {
      setIsAiLiteracyLoading(false);
    }
  }, []);

  const loadArtifacts = useCallback(async () => {
    const loadStartedAt = Date.now();
    setIsLoadingArtifacts(true);
    try {
      const response = await fetch('/api/student/artifacts', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: ArtifactsApiPayload }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error('artifacts_fetch_failed');
      }

      const rows = Array.isArray(payload.data.artifacts) ? payload.data.artifacts : [];
      const mapped = rows
        .map((row) => mapApiArtifactToRecord(row))
        .filter((row): row is ArtifactRecord => Boolean(row));

      setArtifacts(mapped);
      setSelectedArtifactId((current) => {
        if (!current) return null;
        return mapped.some((artifact) => artifact.id === current) ? current : null;
      });

      // Populate extraction log and profile links from API response
      if (payload.data.source_extraction_log) {
        setSourceExtractionLog(payload.data.source_extraction_log);
      }
      if (payload.data.profile_links) {
        setSavedProfileLinks(payload.data.profile_links);
      }
    } catch {
      setArtifacts([]);
      setSelectedArtifactId(null);
      setStatusMessage('Unable to load artifacts right now. Try refreshing in a moment.');
    } finally {
      const elapsed = Date.now() - loadStartedAt;
      if (elapsed < minArtifactsSkeletonMs) {
        await new Promise((resolve) => setTimeout(resolve, minArtifactsSkeletonMs - elapsed));
      }
      setIsLoadingArtifacts(false);
    }
  }, []);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts]);

  useEffect(() => {
    void loadCapabilityTargets();
  }, [loadCapabilityTargets]);

  useEffect(() => {
    void loadAiLiteracyMap();
  }, [loadAiLiteracyMap]);

  useEffect(() => {
    if ((capabilityTargets?.active_capability_profiles?.length ?? 0) > 0) {
      setHasSelectedCapabilityModel(true);
    }
  }, [capabilityTargets?.active_capability_profiles?.length]);

  const handleDraftTypeChange = (nextType: ArtifactType) => {
    setDraftType(nextType);
    setDraftAttachmentName('');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const resetArtifactDraftForm = () => {
    setDraftType('coursework');
    setDraftData({ ...initialDraftArtifactForm });
    setDraftAttachmentName('');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const closeArtifactDialog = () => {
    setShowAddArtifactDialog(false);
    setEditingArtifactId(null);
    resetArtifactDraftForm();
  };

  const openAddArtifactDialog = () => {
    setEditingArtifactId(null);
    resetArtifactDraftForm();
    setShowAddArtifactDialog(true);
  };

  const dismissArtifactIntroTour = () => {
    setShowArtifactIntroTour(false);
    try {
      window.localStorage.setItem(artifactIntroTourStorageKey, '1');
    } catch {
      // ignore storage access failures (private mode / sandboxed contexts)
    }

    const nextUrl = new URL(window.location.href);
    if (nextUrl.searchParams.has('tour') || nextUrl.searchParams.has('openExtractSource') || nextUrl.searchParams.has('extractSource')) {
      nextUrl.searchParams.delete('tour');
      nextUrl.searchParams.delete('openExtractSource');
      nextUrl.searchParams.delete('extractSource');
      const search = nextUrl.searchParams.toString();
      window.history.replaceState({}, '', `${nextUrl.pathname}${search.length > 0 ? `?${search}` : ''}${nextUrl.hash}`);
    }
  };

  const openEditArtifactDialog = (artifact: ArtifactRecord) => {
    setEditingArtifactId(artifact.id);
    setDraftType(artifact.type);
    setDraftData(toDraftFormFromArtifact(artifact));
    setDraftAttachmentName(artifact.attachmentName ?? '');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
    setShowAddArtifactDialog(true);
  };

  const closeVerifyArtifactDialog = () => {
    setShowVerifyArtifactDialog(false);
    setVerifyingArtifactId(null);
    setVerificationMethod('');
    setVerificationContactEmail('');
    setVerificationEvidenceUrl('');
    setVerificationSourceNote('');
    setVerificationAttachmentName('');
    if (verificationDocumentInputRef.current) {
      verificationDocumentInputRef.current.value = '';
    }
  };

  const openVerifyArtifactDialog = (artifact: ArtifactRecord) => {
    const config = verificationConfigByType[artifact.type];
    const existingMethod = toTrimmedString(artifact.artifactData.verification_method);
    const existingSource = toTrimmedString(artifact.artifactData.verification_source);
    const existingEvidenceUrl =
      toTrimmedString(artifact.artifactData.link) ??
      toTrimmedString(artifact.artifactData.project_demo_link) ??
      toTrimmedString(artifact.artifactData.testEvidenceLink) ??
      artifact.link ??
      '';
    const existingContactEmail =
      toTrimmedString(artifact.artifactData.mentor_email) ??
      (isValidEmail(toTrimmedString(artifact.artifactData.reference_contact_name) ?? '')
        ? (toTrimmedString(artifact.artifactData.reference_contact_name) ?? '')
        : '');

    setVerifyingArtifactId(artifact.id);
    setVerificationMethod(existingMethod ?? config.methods[0]?.value ?? 'artifact_review');
    setVerificationContactEmail(existingContactEmail);
    setVerificationEvidenceUrl(existingEvidenceUrl);
    setVerificationSourceNote(existingSource ?? '');
    setVerificationAttachmentName('');
    if (verificationDocumentInputRef.current) {
      verificationDocumentInputRef.current.value = '';
    }
    setShowVerifyArtifactDialog(true);
  };

  const handleVerificationDocumentSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setVerificationAttachmentName(file.name);
  };

  const submitArtifactVerification = async () => {
    if (isSubmittingVerification || !verifyingArtifact) return;

    const config = verificationConfigByType[verifyingArtifact.type];
    const selectedFile = verificationDocumentInputRef.current?.files?.[0] ?? null;
    const normalizedMethod = verificationMethod.trim() || config.methods[0]?.value || 'artifact_review';
    const normalizedContactEmail = verificationContactEmail.trim();
    const normalizedEvidenceUrl = verificationEvidenceUrl.trim();
    const normalizedSourceNote = verificationSourceNote.trim();
    const existingEvidenceUrl = toTrimmedString(verifyingArtifact.link) ?? '';

    if (config.requireContactEmail && !isValidEmail(normalizedContactEmail)) {
      setStatusMessage('Enter a valid contact email to submit verification.');
      return;
    }

    if (config.requireEvidenceUrl) {
      const hasValidUrl = isValidHttpUrl(normalizedEvidenceUrl) || isValidHttpUrl(existingEvidenceUrl);
      if (!hasValidUrl) {
        setStatusMessage('Provide a valid evidence URL for this verification method.');
        return;
      }
    }

    if (config.requireContactOrEvidenceUrl) {
      const hasValidEmail = isValidEmail(normalizedContactEmail);
      const hasValidUrl = isValidHttpUrl(normalizedEvidenceUrl) || isValidHttpUrl(existingEvidenceUrl);
      if (!hasValidEmail && !hasValidUrl) {
        setStatusMessage('Provide either a valid contact email or a valid evidence URL.');
        return;
      }
    }

    if (config.requireSyllabusForCoursework) {
      const hasExistingVerificationFile = hasCourseworkVerificationFile(verifyingArtifact.fileRefs);
      const selectedFileExtension = selectedFile?.name.split('.').pop()?.toLowerCase() ?? '';
      const hasValidSyllabusFileExtension = selectedFile ? ['pdf', 'doc', 'docx'].includes(selectedFileExtension) : false;
      if (selectedFile && !hasValidSyllabusFileExtension) {
        setStatusMessage('Coursework syllabus must be a PDF or Word document (.pdf, .doc, .docx).');
        return;
      }
      if (!isTranscriptBackedCoursework(verifyingArtifact.artifactData) && !hasExistingVerificationFile && !selectedFile) {
        setStatusMessage('Manual coursework verification requires a syllabus file upload.');
        return;
      }
    }

    setIsSubmittingVerification(true);
    try {
      let mergedFileRefs = [...verifyingArtifact.fileRefs];

      if (selectedFile) {
        const uploadForm = new FormData();
        uploadForm.set('file', selectedFile);
        uploadForm.set('kind', verifyingArtifact.type === 'coursework' ? 'syllabus' : 'artifact_supporting_file');

        const uploadResponse = await fetch('/api/student/artifacts/files', {
          method: 'POST',
          body: uploadForm
        });
        const uploadPayload = (await uploadResponse.json().catch(() => null)) as
          | { ok: true; data: { file_ref: Record<string, unknown> } }
          | { ok: false; error?: string }
          | null;

        if (!uploadResponse.ok || !uploadPayload || !uploadPayload.ok) {
          setStatusMessage('Could not upload verification file. Try again.');
          return;
        }

        mergedFileRefs = [...mergedFileRefs, uploadPayload.data.file_ref];
      }

      const effectiveEvidenceUrl =
        normalizedEvidenceUrl.length > 0 && isValidHttpUrl(normalizedEvidenceUrl) ? normalizedEvidenceUrl : existingEvidenceUrl;
      const updates: Record<string, unknown> = {
        verification_status: isTranscriptBackedCoursework(verifyingArtifact.artifactData) ? 'verified' : 'pending',
        verification_method: normalizedMethod,
        verification_source:
          normalizedSourceNote.length > 0
            ? normalizedSourceNote
            : effectiveEvidenceUrl.length > 0
              ? effectiveEvidenceUrl
              : normalizedContactEmail.length > 0
                ? normalizedContactEmail
                : 'manual_verification_submission'
      };

      if (effectiveEvidenceUrl.length > 0 && isValidHttpUrl(effectiveEvidenceUrl)) {
        updates.link = effectiveEvidenceUrl;
        if (verifyingArtifact.type === 'project') {
          updates.project_demo_link = effectiveEvidenceUrl;
        }
      }

      if (normalizedContactEmail.length > 0 && isValidEmail(normalizedContactEmail)) {
        updates.reference_contact_name = normalizedContactEmail;
        if (verifyingArtifact.type === 'internship') {
          updates.mentor_email = normalizedContactEmail;
        }
      }

      const response = await fetch('/api/student/artifacts', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          artifact_id: verifyingArtifact.id,
          updates,
          file_refs: mergedFileRefs
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { artifact: ArtifactApiRow } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        const errorCode = payload && !payload.ok ? payload.error : null;
        if (errorCode === 'coursework_syllabus_required') {
          setStatusMessage('Manual coursework verification requires a syllabus file upload.');
          return;
        }
        setStatusMessage('Unable to submit verification right now. Please try again.');
        return;
      }

      const mappedArtifact = mapApiArtifactToRecord(payload.data.artifact);
      if (mappedArtifact) {
        setArtifacts((current) => current.map((artifact) => (artifact.id === mappedArtifact.id ? mappedArtifact : artifact)));
        setSelectedArtifactId(mappedArtifact.id);
      } else {
        await loadArtifacts();
      }
      void loadCapabilityTargets();
      closeVerifyArtifactDialog();
      setStatusMessage('Verification details submitted.');
      setSnackbar({ kind: 'success', message: 'Verification details submitted. Artifact marked for review.' });
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  useEffect(() => {
    const openAddArtifactParam = searchParams.get('openAddArtifact');
    const shouldOpenFromQuery = openAddArtifactParam === 'true' || openAddArtifactParam === '1';
    if (!shouldOpenFromQuery || hasAutoOpenedFromQueryRef.current || showAddArtifactDialog) return;

    hasAutoOpenedFromQueryRef.current = true;
    setEditingArtifactId(null);
    setDraftType('coursework');
    setDraftData({ ...initialDraftArtifactForm });
    setDraftAttachmentName('');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
    setShowAddArtifactDialog(true);
  }, [searchParams, showAddArtifactDialog]);

  useEffect(() => {
    if (isLoadingArtifacts) return;

    const introParam = searchParams.get('tour');
    const forceShowFromQuery = introParam === 'artifacts' || introParam === 'artifact-intro';
    const hasNoArtifacts = artifacts.length === 0;

    if (!forceShowFromQuery && !hasNoArtifacts) return;

    let hasSeenIntroTour = false;
    try {
      hasSeenIntroTour = window.localStorage.getItem(artifactIntroTourStorageKey) === '1';
    } catch {
      hasSeenIntroTour = false;
    }

    if (hasSeenIntroTour && !forceShowFromQuery) return;
    setShowArtifactIntroTour(true);
  }, [artifacts.length, isLoadingArtifacts, searchParams]);

  const generateAiLiteracyMap = async () => {
    if (isGeneratingAiLiteracy) return;
    if (!hasSelectedCapabilityModel) {
      setStatusMessage('Select at least one role target before generating your AI Literacy Map.');
      setSnackbar({ kind: 'info', message: 'Select a role target before generating your AI Literacy Map.' });
      return;
    }

    setIsGeneratingAiLiteracy(true);
    try {
      const response = await fetch('/api/student/ai-literacy-map', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: AiLiteracyPayload }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok || !payload.data.ai_literacy) {
        throw new Error('ai_literacy_generation_failed');
      }

      const aiLiteracy = payload.data.ai_literacy;
      setAiLiteracyStatus(aiLiteracy.status);
      setAiLiteracyProfileCoverage(aiLiteracy.profile_coverage_percent);
      setAiLiteracyRecruiterSafeCoverage(aiLiteracy.recruiter_safe_coverage_percent);
      setAiLiteracyDomainsWithSignal(aiLiteracy.domains_with_profile_signal);
      setAiLiteracyTotalDomains(aiLiteracy.total_role_relevant_domains);
      setAiLiteracyLastEvaluatedAt(aiLiteracy.last_evaluated_at);
      setHasSelectedCapabilityModel(Boolean(aiLiteracy.has_selected_capability_model));
      setStatusMessage('AI Literacy Map generated.');
      setSnackbar({ kind: 'success', message: 'AI Literacy Map generated.' });
    } catch {
      setStatusMessage('Unable to generate AI Literacy Map right now.');
      setSnackbar({ kind: 'error', message: 'Unable to generate AI Literacy Map right now.' });
    } finally {
      setIsGeneratingAiLiteracy(false);
    }
  };

  const updateDraftField = <K extends keyof DraftArtifactForm>(key: K, value: DraftArtifactForm[K]) => {
    setDraftData((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleDocumentSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDraftAttachmentName(file.name);
    setStatusMessage(`Attached document: ${file.name}.`);
  };

  const addArtifact = async () => {
    if (isSubmittingArtifact) return;
    const artifactIdToEdit = editingArtifactId;
    const isEditingExistingArtifact = Boolean(artifactIdToEdit);
    const editingArtifact = artifactIdToEdit ? artifacts.find((artifact) => artifact.id === artifactIdToEdit) ?? null : null;
    const selectedFile = documentInputRef.current?.files?.[0] ?? null;

    let title = '';
    let source = artifactTypeSourcePreset[draftType];
    let description = '';
    let link: string | undefined;
    let referenceContactName: string | undefined;
    let referenceContactRole: string | undefined;
    let referenceQuote: string | undefined;
    const artifactDataPayload: Record<string, unknown> = {};

    if (draftType === 'coursework') {
      const courseCode = draftData.courseCode.trim();
      const courseTitle = draftData.courseTitle.trim();
      const instructorName = draftData.instructorName.trim();
      const impact = draftData.courseImpact.trim();
      const isTranscriptSourcedCoursework = editingArtifact ? isTranscriptBackedCoursework(editingArtifact.artifactData) : false;
      const hasExistingVerificationFile = editingArtifact ? hasCourseworkVerificationFile(editingArtifact.fileRefs) : false;

      if (courseCode.length < 2 || courseTitle.length < 2 || instructorName.length < 2 || impact.length < 10) {
        setStatusMessage('Coursework requires course code, title, instructor name, and an impact statement.');
        return;
      }

      const selectedFileExtension = selectedFile?.name.split('.').pop()?.toLowerCase() ?? '';
      const hasValidSyllabusFileExtension = selectedFile ? ['pdf', 'doc', 'docx'].includes(selectedFileExtension) : false;
      if (selectedFile && !hasValidSyllabusFileExtension) {
        setStatusMessage('Coursework syllabus must be a PDF or Word document (.pdf, .doc, .docx).');
        return;
      }

      if (!isTranscriptSourcedCoursework && !selectedFile && !hasExistingVerificationFile) {
        setStatusMessage('Manual coursework artifacts require a syllabus file for verification.');
        return;
      }

      title = `${courseCode} · ${courseTitle}`;
      source = 'Coursework evidence';
      description = `Instructor: ${instructorName}. Impact: ${impact}`;
      artifactDataPayload.course_code = courseCode;
      artifactDataPayload.course_title = courseTitle;
      artifactDataPayload.instructor_name = instructorName;
      artifactDataPayload.impact_description = impact;
      if (!isTranscriptSourcedCoursework) {
        artifactDataPayload.verification_status = 'pending';
        artifactDataPayload.verification_method = 'syllabus_upload';
        artifactDataPayload.verification_source = 'manual_coursework_submission';
      }
    }

    if (draftType === 'project') {
      const projectTitle = draftData.projectTitle.trim();
      const projectDescription = draftData.projectDescription.trim();
      const projectDemoLink = draftData.projectDemoLink.trim();

      if (projectTitle.length < 2 || projectDescription.length < 20) {
        setStatusMessage('Project artifacts require a title and a strong impact description.');
        return;
      }

      if (!isYouTubeOrLoomUrl(projectDemoLink)) {
        setStatusMessage('Project artifacts require a valid YouTube or Loom demo link.');
        return;
      }

      title = projectTitle;
      source = 'Project evidence';
      description = projectDescription;
      link = projectDemoLink;
      artifactDataPayload.project_demo_link = projectDemoLink;
    }

    if (draftType === 'internship') {
      const company = draftData.internshipCompany.trim();
      const jobTitle = draftData.internshipJobTitle.trim();
      const startDate = draftData.internshipStartDate.trim();
      const endDate = draftData.internshipEndDate.trim();
      const mentorEmail = draftData.internshipMentorEmail.trim();
      const impact = draftData.internshipImpact.trim();

      if (company.length < 2 || jobTitle.length < 2 || startDate.length === 0 || endDate.length === 0 || impact.length < 10) {
        setStatusMessage('Internship artifacts require company, title, start/end dates, and impact statement.');
        return;
      }

      if (!isValidEmail(mentorEmail)) {
        setStatusMessage('Enter a valid mentor or supervisor email for internship verification.');
        return;
      }

      title = `${jobTitle} · ${company}`;
      source = `Internship ${startDate} to ${endDate}`;
      description = impact;
      referenceContactName = mentorEmail;
      referenceContactRole = 'Mentor / Supervisor';
      referenceQuote = impact;
      artifactDataPayload.company = company;
      artifactDataPayload.job_title = jobTitle;
      artifactDataPayload.start_date = startDate;
      artifactDataPayload.end_date = endDate;
      artifactDataPayload.mentor_email = mentorEmail;
      artifactDataPayload.impact_statement = impact;
    }

    if (draftType === 'certification') {
      const certificationName = draftData.certificationName.trim();
      const awardedDate = draftData.certificationAwardedDate.trim();
      if (certificationName.length < 2 || awardedDate.length === 0) {
        setStatusMessage('Certification artifacts require a certification name and awarded date.');
        return;
      }

      title = certificationName;
      source = `Awarded ${awardedDate}`;
      description = `Certification awarded on ${awardedDate}.`;
      artifactDataPayload.certification_name = certificationName;
      artifactDataPayload.awarded_date = awardedDate;
    }

    if (draftType === 'leadership' || draftType === 'club') {
      const organization = draftData.leadershipOrganization.trim();
      const position = draftData.leadershipPosition.trim();
      const impact = draftData.leadershipImpact.trim();
      if (organization.length < 2 || position.length < 2 || impact.length < 10) {
        setStatusMessage(
          draftType === 'club'
            ? 'Club artifacts require organization, role/title, and impact statement.'
            : 'Leadership artifacts require organization, position, and impact statement.'
        );
        return;
      }

      title = `${position} · ${organization}`;
      source = draftType === 'club' ? 'Club participation evidence' : 'Leadership evidence';
      description = impact;
      artifactDataPayload.organization = organization;
      artifactDataPayload.position = position;
      artifactDataPayload.impact_statement = impact;
    }

    if (draftType === 'competition') {
      const competitionName = draftData.competitionName.trim();
      const performance = draftData.competitionPerformance.trim();
      const prompt = draftData.competitionPrompt.trim();
      if (competitionName.length < 2 || performance.length < 2) {
        setStatusMessage('Competition artifacts require competition name and performance details.');
        return;
      }

      title = competitionName;
      source = `Competition result: ${performance}`;
      description =
        prompt.length > 0
          ? `${performance}. ${prompt}`
          : `${performance}. Add the deliverable itself as a separate Project artifact for stronger evidence.`;
      artifactDataPayload.competition_name = competitionName;
      artifactDataPayload.performance = performance;
      artifactDataPayload.deliverable_note = prompt;
    }

    if (draftType === 'research') {
      const researchTitle = draftData.researchTitle.trim();
      const researchArea = draftData.researchArea.trim();
      const advisor = draftData.researchAdvisor.trim();
      const impact = draftData.researchImpact.trim();
      if (researchTitle.length < 2 || impact.length < 10) {
        setStatusMessage('Research artifacts require a title and impact statement.');
        return;
      }

      title = researchTitle;
      source = researchArea.length > 0 ? `Research · ${researchArea}` : 'Research evidence';
      description = advisor.length > 0 ? `Advisor: ${advisor}. Impact: ${impact}` : impact;
      artifactDataPayload.research_title = researchTitle;
      artifactDataPayload.research_area = researchArea;
      artifactDataPayload.advisor = advisor;
      artifactDataPayload.impact_statement = impact;
    }

    if (draftType === 'employment') {
      const company = draftData.jobExperienceCompany.trim();
      const titleValue = draftData.jobExperienceTitle.trim();
      const startDate = draftData.jobExperienceStartDate.trim();
      const endDate = draftData.jobExperienceEndDate.trim();
      const impact = draftData.jobExperienceImpact.trim();
      if (company.length < 2 || titleValue.length < 2 || startDate.length === 0 || endDate.length === 0 || impact.length < 10) {
        setStatusMessage('Employment artifacts require company, role title, start/end dates, and impact statement.');
        return;
      }

      title = `${titleValue} · ${company}`;
      source = `Employment ${startDate} to ${endDate}`;
      description = impact;
      artifactDataPayload.company = company;
      artifactDataPayload.job_title = titleValue;
      artifactDataPayload.start_date = startDate;
      artifactDataPayload.end_date = endDate;
      artifactDataPayload.impact_statement = impact;
    }

    if (draftType === 'test') {
      const testName = draftData.testName.trim();
      const testProvider = draftData.testProvider.trim();
      const testScore = draftData.testScore.trim();
      const evidenceLink = draftData.testEvidenceLink.trim();
      if (testName.length < 2 || testScore.length < 1) {
        setStatusMessage('Test evidence requires assessment name and score/outcome.');
        return;
      }
      if (evidenceLink.length > 0 && !isValidHttpUrl(evidenceLink)) {
        setStatusMessage('Test evidence link must be a valid URL.');
        return;
      }

      title = testName;
      source = testProvider.length > 0 ? testProvider : artifactTypeSourcePreset.test;
      description = `Result: ${testScore}`;
      link = evidenceLink.length > 0 ? evidenceLink : undefined;
      artifactDataPayload.assessment_name = testName;
      artifactDataPayload.provider = testProvider;
      artifactDataPayload.score = testScore;
    }

    const normalizedTitle = title.trim();
    const normalizedSource = source.trim() || artifactTypeSourcePreset[draftType];
    const normalizedDescription = description.trim() || 'Student-linked evidence artifact.';
    const normalizedAttachmentName = draftAttachmentName.trim().length > 0 ? draftAttachmentName.trim() : undefined;

    setIsSubmittingArtifact(true);
    try {
      let fileRefs: Array<Record<string, unknown>> = [];

      if (selectedFile) {
        const uploadForm = new FormData();
        uploadForm.set('file', selectedFile);
        uploadForm.set('kind', draftType === 'coursework' ? 'syllabus' : 'artifact_supporting_file');

        const uploadResponse = await fetch('/api/student/artifacts/files', {
          method: 'POST',
          body: uploadForm
        });
        const uploadPayload = (await uploadResponse.json().catch(() => null)) as
          | { ok: true; data: { file_ref: Record<string, unknown> } }
          | { ok: false; error?: string }
          | null;

        if (!uploadResponse.ok || !uploadPayload || !uploadPayload.ok) {
          setStatusMessage('Could not upload file. Verify storage bucket setup and try again.');
          return;
        }

        fileRefs = [uploadPayload.data.file_ref];
      }

      const artifactData: Record<string, unknown> = {
        title: normalizedTitle,
        source: normalizedSource,
        description: normalizedDescription,
        type: draftType,
        tags: [...calculatedDraftTags],
        ...(link ? { link } : {}),
        ...(normalizedAttachmentName ? { attachment_name: normalizedAttachmentName } : {}),
        ...(referenceContactName ? { reference_contact_name: referenceContactName } : {}),
        ...(referenceContactRole ? { reference_contact_role: referenceContactRole } : {}),
        ...(referenceQuote ? { reference_quote: referenceQuote } : {}),
        ...artifactDataPayload
      };

      const response = await fetch('/api/student/artifacts', {
        method: isEditingExistingArtifact ? 'PATCH' : 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(
          isEditingExistingArtifact
            ? {
                artifact_id: artifactIdToEdit,
                updates: artifactData,
                file_refs: fileRefs
              }
            : {
                artifact_type: draftType,
                artifact_data: artifactData,
                file_refs: fileRefs
              }
        )
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { artifact: ArtifactApiRow } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        const errorCode = payload && !payload.ok ? payload.error : null;
        if (errorCode === 'coursework_syllabus_required') {
          setStatusMessage('Manual coursework artifacts require a syllabus file for verification.');
          return;
        }
        setStatusMessage(isEditingExistingArtifact ? 'Unable to update artifact right now. Please try again.' : 'Unable to save artifact right now. Please try again.');
        return;
      }

      const mappedArtifact = mapApiArtifactToRecord(payload.data.artifact);
      if (mappedArtifact) {
        if (isEditingExistingArtifact) {
          setArtifacts((current) => current.map((artifact) => (artifact.id === mappedArtifact.id ? mappedArtifact : artifact)));
        } else {
          setArtifacts((current) => [mappedArtifact, ...current]);
        }
        setSelectedArtifactId(mappedArtifact.id);
      } else {
        await loadArtifacts();
      }

      closeArtifactDialog();
      void loadCapabilityTargets();
      setStatusMessage(`${isEditingExistingArtifact ? 'Updated' : 'Added'} artifact: ${normalizedTitle}.`);
    } finally {
      setIsSubmittingArtifact(false);
    }
  };

  const submitAddArtifactDialog = () => {
    void addArtifact();
  };

  const deleteEditingArtifact = async () => {
    const artifactIdToDelete = editingArtifactId;
    if (!artifactIdToDelete || isSubmittingArtifact || isDeletingArtifact) return;
    if (!window.confirm('Delete this artifact from your active Evidence Profile view? Version history will be preserved.')) return;

    setIsDeletingArtifact(true);
    try {
      const response = await fetch('/api/student/artifacts', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          artifact_id: artifactIdToDelete
        })
      });

      const payload = (await response.json().catch(() => null)) as { ok: boolean } | null;
      if (!response.ok || !payload || !payload.ok) {
        setStatusMessage('Unable to delete artifact right now. Please try again.');
        return;
      }

      setArtifacts((current) => current.filter((artifact) => artifact.id !== artifactIdToDelete));
      setSelectedArtifactId((current) => (current === artifactIdToDelete ? null : current));
      closeArtifactDialog();
      void loadCapabilityTargets();
      setStatusMessage(null);
      setSnackbar({ kind: 'success', message: 'Artifact deleted.' });
    } finally {
      setIsDeletingArtifact(false);
    }
  };

  const isEditingInDialog = Boolean(editingArtifactId);
  const editingArtifactInDialog = editingArtifactId ? artifacts.find((artifact) => artifact.id === editingArtifactId) ?? null : null;
  const isEditingTranscriptBackedCoursework =
    editingArtifactInDialog?.type === 'coursework' ? isTranscriptBackedCoursework(editingArtifactInDialog.artifactData) : false;
  const courseworkSyllabusFieldLabel = isEditingTranscriptBackedCoursework
    ? 'Syllabus file (optional for transcript-sourced coursework)'
    : 'Syllabus file (required for manual coursework)';
  const verifyingConfig = verifyingArtifact ? verificationConfigByType[verifyingArtifact.type] : null;
  const verifyingArtifactHasCourseworkFile = verifyingArtifact ? hasCourseworkVerificationFile(verifyingArtifact.fileRefs) : false;

  return (
    <section
      aria-labelledby="student-evidence-profile-title"
      className="w-full overflow-x-hidden px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-12 lg:pb-12 xl:pb-10"
    >
      <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2
              id="student-evidence-profile-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Evidence Profile
            </h2>
          </div>
        </div>

        {showArtifactIntroTour ? (
          <div className="mt-4 rounded-2xl border border-[#bfe0d1] bg-[#ecfaf3] p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-sm font-semibold text-[#1b4a3a] dark:text-emerald-100">First-time tour</p>
            <p className="mt-1 text-xs text-[#3e6658] dark:text-slate-300">
              Fastest path: manage your capability sources first, then review generated drafts. You can still add artifacts manually at any time.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/student/profile#capability-sources"
                className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Manage sources
              </Link>
              <Button type="button" size="sm" variant="secondary" onClick={() => openAddArtifactDialog()}>
                <span className="inline-flex items-center gap-2">
                  <PlusIcon />
                  <span>Create first artifact manually</span>
                </span>
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => dismissArtifactIntroTour()}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        {showFirstArtifactTour ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-[#2a5044] dark:text-slate-200">Quick start tour</p>
            <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-400">
              1) Manage sources to run extraction. 2) Review and edit generated artifacts.
              3) Add manual artifacts for any missing evidence.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/student/profile#capability-sources"
                className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Manage sources
              </Link>
              <Button type="button" size="sm" variant="secondary" onClick={() => openAddArtifactDialog()}>
                <span className="inline-flex items-center gap-2">
                  <PlusIcon />
                  <span>Add New Artifact</span>
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <p className="mt-3 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}

        <div id="ai-literacy-map" className="scroll-mt-24" />

        <div className="mt-4 lg:hidden">
          <div className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Evidence vs Target</p>
            <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-400">
              Compare target expectations against your current evidence coverage by capability axis.
            </p>
            <EvidenceVsTargetSummary isLoading={isTargetsLoading} capabilityTargets={capabilityTargets} compact />
          </div>
        </div>

        <div className="mt-4 lg:hidden">
          <div className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">AI Literacy Map</p>
            <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-400">
              Role-aware artifact generated from your evidence profile. Not a ranking score.
            </p>
            {isAiLiteracyLoading ? (
              <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#e4efe9] dark:bg-slate-700/70" />
            ) : aiLiteracyStatus === 'not_started' ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">AI Literacy artifact not started</p>
                <p className="mt-1">
                  {hasSelectedCapabilityModel
                    ? 'Generate your first AI Literacy Map from current evidence.'
                    : 'Select a role target first. AI Literacy generation requires an active capability model.'}
                </p>
                <div className="mt-3">
                  {hasSelectedCapabilityModel ? (
                    <button
                      type="button"
                      onClick={() => void generateAiLiteracyMap()}
                      disabled={isGeneratingAiLiteracy}
                      className="inline-flex h-9 items-center rounded-xl bg-[#12f987] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingAiLiteracy ? 'Generating...' : 'Generate AI Literacy Map'}
                    </button>
                  ) : (
                    <Link
                      href="/student/targets"
                      className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Select role target
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 text-xs text-[#38584f] dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <p className="font-semibold">Status: {formatAiLiteracyStatus(aiLiteracyStatus)}</p>
                <p className="mt-1">
                  Profile Coverage: <span className="font-semibold">{aiLiteracyProfileCoverage}%</span> · Recruiter-Safe:{' '}
                  <span className="font-semibold">{aiLiteracyRecruiterSafeCoverage}%</span>
                </p>
                <p className="mt-1">
                  Domains with signal: <span className="font-semibold">{aiLiteracyDomainsWithSignal}</span> / {aiLiteracyTotalDomains}
                </p>
                <p className="mt-1">Last evaluated: {aiLiteracyLastEvaluatedLabel}</p>
                <button
                  type="button"
                  onClick={() => void generateAiLiteracyMap()}
                  disabled={isGeneratingAiLiteracy || !hasSelectedCapabilityModel}
                  className="mt-2 inline-flex h-8 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {isGeneratingAiLiteracy ? 'Refreshing...' : 'Regenerate'}
                </button>
              </div>
            )}
          </div>
        </div>

        {!isLoadingArtifacts ? (
          <div className="mt-4 lg:hidden">
            <div className="rounded-2xl border border-[#d2e1db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6d64] dark:text-slate-400">Source Status</p>
                  <p className="mt-1 text-xs font-medium text-[#3f6055] dark:text-slate-300">{sourceStatusSummary.contextLine}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Connected</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.connectedCount}</p>
                </div>
                <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Extracting</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.extractingCount}</p>
                </div>
                <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Needs Update</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.needsUpdateCount}</p>
                </div>
                <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Failed</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.failedCount}</p>
                </div>
              </div>
              <Link
                href="/student/profile#capability-sources"
                className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-center text-xs font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Manage sources
              </Link>
              {sourceStatusSummary.connectedCount === 0 ? (
                <Link
                  href="/student/profile#capability-sources"
                  className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-center text-xs font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add a source
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3 lg:hidden">
          <div className="rounded-2xl border border-[#d2e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5a7a70] dark:text-slate-400">
              Filter by evidence type
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === 'all'
                    ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                    : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                All · {artifacts.length}
              </button>
              {artifactTypes.map((type) => {
                const count = artifacts.filter((a) => a.type === type.id).length;
                return (
                  <button
                    key={`mobile-filter-${type.id}`}
                    type="button"
                    onClick={() => setActiveFilter(type.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeFilter === type.id
                        ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                        : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {type.label}
                    {count > 0 ? ` · ${count}` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoadingArtifacts ? (
            <>
              <ArtifactCardSkeleton />
              <ArtifactCardSkeleton />
              <ArtifactCardSkeleton />
            </>
          ) : filteredArtifacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-semibold text-[#2a5044] dark:text-slate-200">No artifacts yet</p>
              <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-400">
                {activeFilter === 'all'
                  ? 'Tap Add New Artifact to capture your first piece of evidence.'
                  : `No ${artifactTypeLabelMap[activeFilter].toLowerCase()} artifacts yet. Switch to All or add one.`}
              </p>
            </div>
          ) : (
            filteredArtifacts.map((artifact) => {
              const isSelected = selectedArtifactId === artifact.id;
              const verificationStatus = getArtifactVerificationStatus(artifact);
              return (
                <article key={artifact.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedArtifactId(artifact.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors active:bg-[#f0faf5] dark:active:bg-slate-800 ${
                      isSelected
                        ? 'border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10'
                        : 'border-[#d5e1db] bg-white dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={`shrink-0 ${artifactTypeToneClass[artifact.type]}`}>{artifactTypeLabelMap[artifact.type]}</Badge>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${verificationToneClass[verificationStatus]}`}>
                          {verificationStatusLabel[verificationStatus]}
                        </span>
                      </div>
                      {artifact.link || artifact.attachmentName ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#2a6b5c] dark:text-emerald-400">
                          {artifact.link ? 'Linked ↗' : 'Doc attached'}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base font-semibold leading-snug text-[#0f2b23] dark:text-slate-100">{artifact.title}</p>
                    <p className="mt-0.5 text-xs text-[#4c6860] dark:text-slate-400">
                      {artifact.source} · {artifact.updatedAt}
                    </p>
                    <p
                      className="mt-2 text-sm leading-5 text-[#48635b] dark:text-slate-300"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {artifact.description}
                    </p>
                    {artifact.versionCount > 1 ? (
                      <p className="mt-1 text-[11px] font-medium text-[#4f6a62] dark:text-slate-400">
                        {artifact.versionCount} versions retained with provenance history.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {artifact.tags.slice(0, 3).map((tag) => (
                        <span key={`${artifact.id}-${tag}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagToneClass[tag]}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                </article>
              );
            })
          )}
        </div>

        <div className="mt-7 hidden gap-4 xl:grid xl:grid-cols-[1.08fr_0.92fr] xl:pb-6">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                        Artifact cards
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">
                        {isLoadingArtifacts ? 'Loading artifacts...' : `${filteredArtifacts.length} artifacts in view`}
                      </h3>
                    </div>
                    <Badge>{isLoadingArtifacts ? 'Loading' : activeFilter === 'all' ? 'All types' : artifactTypeLabelMap[activeFilter]}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5a7a70] dark:text-slate-400">
                      Filter by evidence type
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          activeFilter === 'all'
                            ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                            : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        All · {artifacts.length}
                      </button>
                      {artifactTypes.map((type) => {
                        const count = artifacts.filter((a) => a.type === type.id).length;
                        return (
                          <button
                            key={`desktop-filter-${type.id}`}
                            type="button"
                            onClick={() => setActiveFilter(type.id)}
                            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              activeFilter === type.id
                                ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                                : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                          >
                            {type.label}
                            {count > 0 ? ` · ${count}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              }
            >
            {isLoadingArtifacts ? (
              <div className="space-y-3">
                <ArtifactCardSkeleton />
                <ArtifactCardSkeleton />
                <ArtifactCardSkeleton />
              </div>
            ) : filteredArtifacts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] px-4 py-6 text-sm text-[#4f6a62] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                No artifacts found for your account yet. Use Add New Artifact to create one.
              </p>
            ) : (
              <div className="max-h-[56rem] space-y-3 overflow-y-auto pr-1 xl:max-h-none">
                {filteredArtifacts.map((artifact) => {
                  const isSelected = selectedArtifactId === artifact.id;
                  const verificationStatus = getArtifactVerificationStatus(artifact);

                  return (
                    <article
                      key={artifact.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedArtifactId(artifact.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedArtifactId(artifact.id);
                        }
                      }}
                      className={`rounded-2xl border px-4 py-3 transition-colors ${
                        isSelected
                          ? 'border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10'
                          : 'border-[#d5e1db] bg-[#f9fdfb] dark:border-slate-700 dark:bg-slate-900'
                      } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16d989] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8fcfa] dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-slate-900`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{artifact.title}</p>
                          <p className="mt-0.5 text-xs text-[#4c6860] dark:text-slate-400">
                            {artifact.source} · Updated {artifact.updatedAt}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={artifactTypeToneClass[artifact.type]}>{artifactTypeLabelMap[artifact.type]}</Badge>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${verificationToneClass[verificationStatus]}`}>
                            {verificationStatusLabel[verificationStatus]}
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-[#48635b] dark:text-slate-300">{artifact.description}</p>
                      {artifact.versionCount > 1 ? (
                        <div className="mt-1 text-[11px] text-[#4f6a62] dark:text-slate-400">
                          <p className="font-medium">{artifact.versionCount} versions retained with provenance history.</p>
                          <p className="mt-0.5">
                            {artifact.provenanceVersions
                              .slice(0, 2)
                              .map((version) => `${version.operation} · ${version.createdAt}`)
                              .join(' | ')}
                          </p>
                        </div>
                      ) : null}

                      {artifact.attachmentName ? (
                        <p className="mt-1 text-xs font-medium text-[#3f5d54] dark:text-slate-300">
                          Document attached: {artifact.attachmentName}
                        </p>
                      ) : null}

                      {artifact.referenceQuote ? (
                        <div className="mt-2 rounded-xl border border-[#d3e0da] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                            Reference signal
                          </p>
                          <p className="mt-1 text-xs italic leading-5 text-[#48635b] dark:text-slate-300">
                            &ldquo;{artifact.referenceQuote}&rdquo;
                          </p>
                          <p className="mt-1 text-[11px] text-[#4f6a62] dark:text-slate-400">
                            {artifact.referenceContactName}
                            {artifact.referenceContactRole ? ` · ${artifact.referenceContactRole}` : ''}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {artifact.tags.map((tag) => (
                          <span
                            key={`${artifact.id}-${tag}`}
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagToneClass[tag]}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditArtifactDialog(artifact);
                          }}
                        >
                          Edit artifact
                        </Button>
                        {verificationStatus !== 'verified' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openVerifyArtifactDialog(artifact);
                            }}
                          >
                            {verificationStatus === 'pending' ? 'Update verification' : 'Verify artifact'}
                          </Button>
                        ) : null}
                        {artifact.link ? (
                          <a
                            href={artifact.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Open link
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="space-y-4 xl:space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Evidence vs Target</h3>}
            >
              <p className="text-xs text-[#4f6a62] dark:text-slate-400">
                Compare target expectations against your current evidence coverage by capability axis.
              </p>
              <EvidenceVsTargetSummary isLoading={isTargetsLoading} capabilityTargets={capabilityTargets} />
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">AI Literacy Map</h3>}
            >
              <p className="text-xs text-[#4f6a62] dark:text-slate-400">
                Role-aware artifact generated from your evidence profile. Not a ranking score.
              </p>
              {isAiLiteracyLoading ? (
                <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#e4efe9] dark:bg-slate-700/70" />
              ) : aiLiteracyStatus === 'not_started' ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="font-semibold">AI Literacy artifact not started</p>
                  <p className="mt-1">
                    {hasSelectedCapabilityModel
                      ? 'Generate your first AI Literacy Map from current evidence.'
                      : 'Select a role target first. AI Literacy generation requires an active capability model.'}
                  </p>
                  <div className="mt-3">
                    {hasSelectedCapabilityModel ? (
                      <button
                        type="button"
                        onClick={() => void generateAiLiteracyMap()}
                        disabled={isGeneratingAiLiteracy}
                        className="inline-flex h-9 items-center rounded-xl bg-[#12f987] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isGeneratingAiLiteracy ? 'Generating...' : 'Generate AI Literacy Map'}
                      </button>
                    ) : (
                      <Link
                        href="/student/targets"
                        className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Select role target
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 text-xs text-[#38584f] dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                  <p className="font-semibold">Status: {formatAiLiteracyStatus(aiLiteracyStatus)}</p>
                  <p className="mt-1">
                    Profile Coverage: <span className="font-semibold">{aiLiteracyProfileCoverage}%</span> · Recruiter-Safe:{' '}
                    <span className="font-semibold">{aiLiteracyRecruiterSafeCoverage}%</span>
                  </p>
                  <p className="mt-1">
                    Domains with signal: <span className="font-semibold">{aiLiteracyDomainsWithSignal}</span> / {aiLiteracyTotalDomains}
                  </p>
                  <p className="mt-1">Last evaluated: {aiLiteracyLastEvaluatedLabel}</p>
                  <button
                    type="button"
                    onClick={() => void generateAiLiteracyMap()}
                    disabled={isGeneratingAiLiteracy || !hasSelectedCapabilityModel}
                    className="mt-2 inline-flex h-8 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isGeneratingAiLiteracy ? 'Refreshing...' : 'Regenerate'}
                  </button>
                </div>
              )}
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Source Status</h3>}
            >
              <p className="text-xs text-[#4f6a62] dark:text-slate-400">
                Manage extraction inputs and reruns from your profile source controls.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Connected</p>
                  <p className="mt-1 text-lg font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.connectedCount}</p>
                </div>
                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Extracting</p>
                  <p className="mt-1 text-lg font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.extractingCount}</p>
                </div>
                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Needs Update</p>
                  <p className="mt-1 text-lg font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.needsUpdateCount}</p>
                </div>
                <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Failed</p>
                  <p className="mt-1 text-lg font-semibold text-[#0f2b23] dark:text-slate-100">{sourceStatusSummary.failedCount}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-[#3f6055] dark:text-slate-300">{sourceStatusSummary.contextLine}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/student/profile#capability-sources"
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-center text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Manage sources
                </Link>
                {sourceStatusSummary.connectedCount === 0 ? (
                  <Link
                    href="/student/profile#capability-sources"
                    className="inline-flex h-9 items-center rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Add a source
                  </Link>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openAddArtifactDialog()}
          className="fixed bottom-24 right-6 z-40 inline-flex h-12 items-center rounded-full border border-[#0fd978]/40 bg-[#12f987] px-4 text-sm font-semibold text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] lg:bottom-8 lg:right-8"
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            <span>Add New Artifact</span>
          </span>
        </button>

        {snackbar ? (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-[1300] w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2">
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-[0_18px_30px_-24px_rgba(10,31,26,0.7)] ${
                snackbar.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100'
                  : snackbar.kind === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100'
                    : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-100'
              }`}
              role="status"
              aria-live="polite"
            >
              {snackbar.message}
            </div>
          </div>
        ) : null}

        {showVerifyArtifactDialog && verifyingArtifact && verifyingConfig ? (
          <div className="fixed inset-0 z-[1250]">
            <button
              type="button"
              aria-label="Close verify artifact"
              onClick={closeVerifyArtifactDialog}
              className="absolute inset-0 bg-[#0a1f1a]/45"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border border-[#cfddd6] bg-[#f8fcfa] p-4 pb-24 dark:border-slate-700 dark:bg-slate-900 lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[90vh] lg:w-[min(38rem,calc(100vw-3rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:p-6 lg:pb-6">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#c8d7d1] dark:bg-slate-700" />
              <div className="mt-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-[#0a1f1a] dark:text-slate-100">{verifyingConfig.title}</p>
                  <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-300">{verifyingConfig.helpText}</p>
                  <p className="mt-2 text-xs font-medium text-[#3f6055] dark:text-slate-300">
                    Artifact: <span className="font-semibold">{verifyingArtifact.title}</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close dialog"
                  onClick={closeVerifyArtifactDialog}
                  disabled={isSubmittingVerification}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#bfd2ca] bg-white text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              {verifyingConfig.methods.length > 1 ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Verification method
                  <select
                    value={verificationMethod}
                    onChange={(event) => setVerificationMethod(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {verifyingConfig.methods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {verifyingConfig.requireContactEmail || verifyingConfig.requireContactOrEvidenceUrl ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Contact email
                  <input
                    value={verificationContactEmail}
                    onChange={(event) => setVerificationContactEmail(event.target.value)}
                    placeholder="manager@company.com"
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              ) : null}

              {verifyingConfig.requireEvidenceUrl || verifyingConfig.requireContactOrEvidenceUrl ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Evidence URL
                  <input
                    value={verificationEvidenceUrl}
                    onChange={(event) => setVerificationEvidenceUrl(event.target.value)}
                    placeholder="https://..."
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              ) : null}

              {verifyingConfig.requireSyllabusForCoursework ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Syllabus file
                  <input
                    ref={verificationDocumentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleVerificationDocumentSelect}
                    className="mt-2 w-full rounded-xl border border-dashed border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#3b5a52] file:mr-3 file:rounded-lg file:border file:border-[#bfd2ca] file:bg-[#f5fbf8] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#22473b] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:file:border-slate-500 dark:file:bg-slate-800 dark:file:text-slate-200"
                  />
                  <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[#4f6a62] dark:text-slate-400">
                    {verificationAttachmentName.length > 0
                      ? `Selected file: ${verificationAttachmentName}`
                      : verifyingArtifactHasCourseworkFile
                        ? 'Existing syllabus is already attached. Uploading a new file is optional.'
                        : 'Required for manual coursework verification.'}
                  </span>
                </label>
              ) : (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Supporting file (optional)
                  <input
                    ref={verificationDocumentInputRef}
                    type="file"
                    onChange={handleVerificationDocumentSelect}
                    className="mt-2 w-full rounded-xl border border-dashed border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#3b5a52] file:mr-3 file:rounded-lg file:border file:border-[#bfd2ca] file:bg-[#f5fbf8] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#22473b] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:file:border-slate-500 dark:file:bg-slate-800 dark:file:text-slate-200"
                  />
                  {verificationAttachmentName.length > 0 ? (
                    <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[#4f6a62] dark:text-slate-400">
                      Selected file: {verificationAttachmentName}
                    </span>
                  ) : null}
                </label>
              )}

              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Verification source notes
                <textarea
                  value={verificationSourceNote}
                  onChange={(event) => setVerificationSourceNote(event.target.value)}
                  placeholder="Add context for reviewers (source details, verification instructions, or caveats)."
                  className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeVerifyArtifactDialog} disabled={isSubmittingVerification}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitArtifactVerification()} disabled={isSubmittingVerification}>
                  {isSubmittingVerification ? 'Submitting...' : 'Submit verification'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showAddArtifactDialog ? (
          <div className="fixed inset-0 z-[1200]">
            <button
              type="button"
              aria-label="Close add artifact"
              onClick={closeArtifactDialog}
              className="absolute inset-0 bg-[#0a1f1a]/45"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border border-[#cfddd6] bg-[#f8fcfa] p-4 pb-24 dark:border-slate-700 dark:bg-slate-900 lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[90vh] lg:w-[min(44rem,calc(100vw-3rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:p-6 lg:pb-6">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#c8d7d1] dark:bg-slate-700" />
              <div className="mt-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-[#0a1f1a] dark:text-slate-100">{isEditingInDialog ? 'Edit Artifact' : 'Add New Artifact'}</p>
                  <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-300">
                    {isEditingInDialog ? 'Update this artifact using the same field set as create.' : 'Capture evidence quickly. You can edit details later.'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close dialog"
                  onClick={closeArtifactDialog}
                  disabled={isSubmittingArtifact || isDeletingArtifact}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#bfd2ca] bg-white text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Type
                <select
                  value={draftType}
                  onChange={(event) => handleDraftTypeChange(event.target.value as ArtifactType)}
                  disabled={isEditingInDialog}
                  className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {artifactTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <>
                {draftType === 'coursework' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Course code
                      <input
                        value={draftData.courseCode}
                        onChange={(event) => updateDraftField('courseCode', event.target.value)}
                        placeholder="CS 2450"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Course title
                      <input
                        value={draftData.courseTitle}
                        onChange={(event) => updateDraftField('courseTitle', event.target.value)}
                        placeholder="Database Systems"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Instructor name
                      <input
                        value={draftData.instructorName}
                        onChange={(event) => updateDraftField('instructorName', event.target.value)}
                        placeholder="Dr. Nguyen"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Impact
                      <textarea
                        value={draftData.courseImpact}
                        onChange={(event) => updateDraftField('courseImpact', event.target.value)}
                        placeholder="What skills improved and how this coursework strengthened your readiness."
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">{courseworkSyllabusFieldLabel}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => documentInputRef.current?.click()}>
                          Upload syllabus
                        </Button>
                        {draftAttachmentName ? (
                          <span className="text-xs font-medium text-[#3f5d54] dark:text-slate-300">{draftAttachmentName}</span>
                        ) : (
                          <span className="text-xs text-[#557168] dark:text-slate-400">No syllabus selected</span>
                        )}
                      </div>
                      <input
                        ref={documentInputRef}
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx"
                        onChange={handleDocumentSelect}
                      />
                    </div>
                  </>
                ) : null}

                {draftType === 'project' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Project title
                      <input
                        value={draftData.projectTitle}
                        onChange={(event) => updateDraftField('projectTitle', event.target.value)}
                        placeholder="Realtime ETL Reliability Dashboard"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        Project impact description
                        <span title="Strong descriptions explain what you built, your direct contribution, constraints, and measurable impact.">i</span>
                      </span>
                      <textarea
                        value={draftData.projectDescription}
                        onChange={(event) => updateDraftField('projectDescription', event.target.value)}
                        placeholder="Describe your direct contribution, the challenge, and the measurable outcome."
                        className="mt-2 min-h-24 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      YouTube or Loom demo link
                      <input
                        value={draftData.projectDemoLink}
                        onChange={(event) => updateDraftField('projectDemoLink', event.target.value)}
                        placeholder="https://www.youtube.com/... or https://www.loom.com/..."
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'internship' ? (
                  <>
                    <p className="mt-3 rounded-xl border border-[#d2dfd9] bg-[#f4faf7] px-3 py-2 text-xs text-[#466259] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Internship entries include mentor/supervisor contact info for future verification workflows.
                    </p>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Company
                      <input
                        value={draftData.internshipCompany}
                        onChange={(event) => updateDraftField('internshipCompany', event.target.value)}
                        placeholder="Acme Data"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Job title
                      <input
                        value={draftData.internshipJobTitle}
                        onChange={(event) => updateDraftField('internshipJobTitle', event.target.value)}
                        placeholder="Data Engineering Intern"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Start date
                        <input
                          type="date"
                          value={draftData.internshipStartDate}
                          onChange={(event) => updateDraftField('internshipStartDate', event.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        End date
                        <input
                          type="date"
                          value={draftData.internshipEndDate}
                          onChange={(event) => updateDraftField('internshipEndDate', event.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Mentor or supervisor email
                      <input
                        type="email"
                        value={draftData.internshipMentorEmail}
                        onChange={(event) => updateDraftField('internshipMentorEmail', event.target.value)}
                        placeholder="mentor@company.com"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Impact statement
                      <textarea
                        value={draftData.internshipImpact}
                        onChange={(event) => updateDraftField('internshipImpact', event.target.value)}
                        placeholder="Describe your contributions and outcomes. This will be visible in your artifact history."
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'certification' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Certification name
                      <input
                        value={draftData.certificationName}
                        onChange={(event) => updateDraftField('certificationName', event.target.value)}
                        placeholder="AWS Certified Data Engineer - Associate"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Awarded date
                      <input
                        type="date"
                        value={draftData.certificationAwardedDate}
                        onChange={(event) => updateDraftField('certificationAwardedDate', event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'leadership' || draftType === 'club' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      {draftType === 'club' ? 'Club or organization' : 'Organization'}
                      <input
                        value={draftData.leadershipOrganization}
                        onChange={(event) => updateDraftField('leadershipOrganization', event.target.value)}
                        placeholder={draftType === 'club' ? 'Data Club' : 'Data Club'}
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      {draftType === 'club' ? 'Role or title' : 'Position'}
                      <input
                        value={draftData.leadershipPosition}
                        onChange={(event) => updateDraftField('leadershipPosition', event.target.value)}
                        placeholder={draftType === 'club' ? 'Member / Treasurer / Committee Lead' : 'President / Team Lead'}
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      {draftType === 'club' ? 'Club impact statement' : 'Statement of impact'}
                      <textarea
                        value={draftData.leadershipImpact}
                        onChange={(event) => updateDraftField('leadershipImpact', event.target.value)}
                        placeholder={
                          draftType === 'club'
                            ? 'What did you contribute in this organization and what outcomes came from it?'
                            : 'What did you do in this role and how did you go above and beyond?'
                        }
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'competition' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Competition name
                      <input
                        value={draftData.competitionName}
                        onChange={(event) => updateDraftField('competitionName', event.target.value)}
                        placeholder="Company X Data Hackathon"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Performance
                      <input
                        value={draftData.competitionPerformance}
                        onChange={(event) => updateDraftField('competitionPerformance', event.target.value)}
                        placeholder="Top 10 finalist / 2nd place / Honorable mention"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Deliverable note (optional)
                      <textarea
                        value={draftData.competitionPrompt}
                        onChange={(event) => updateDraftField('competitionPrompt', event.target.value)}
                        placeholder="Mention the deliverable and add it separately as a Project artifact."
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'research' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Research title
                      <input
                        value={draftData.researchTitle}
                        onChange={(event) => updateDraftField('researchTitle', event.target.value)}
                        placeholder="LLM Reliability Evaluation Study"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Research area or lab (optional)
                      <input
                        value={draftData.researchArea}
                        onChange={(event) => updateDraftField('researchArea', event.target.value)}
                        placeholder="Applied ML Lab"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Advisor or PI (optional)
                      <input
                        value={draftData.researchAdvisor}
                        onChange={(event) => updateDraftField('researchAdvisor', event.target.value)}
                        placeholder="Dr. Kim"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Impact statement
                      <textarea
                        value={draftData.researchImpact}
                        onChange={(event) => updateDraftField('researchImpact', event.target.value)}
                        placeholder="What research contribution did you make and what changed because of it?"
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'employment' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Company
                      <input
                        value={draftData.jobExperienceCompany}
                        onChange={(event) => updateDraftField('jobExperienceCompany', event.target.value)}
                        placeholder="Acme Systems"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Job title
                      <input
                        value={draftData.jobExperienceTitle}
                        onChange={(event) => updateDraftField('jobExperienceTitle', event.target.value)}
                        placeholder="Data Analyst"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Start date
                        <input
                          type="date"
                          value={draftData.jobExperienceStartDate}
                          onChange={(event) => updateDraftField('jobExperienceStartDate', event.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        End date
                        <input
                          type="date"
                          value={draftData.jobExperienceEndDate}
                          onChange={(event) => updateDraftField('jobExperienceEndDate', event.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Impact statement
                      <textarea
                        value={draftData.jobExperienceImpact}
                        onChange={(event) => updateDraftField('jobExperienceImpact', event.target.value)}
                        placeholder="What outcomes did you create in this employment experience?"
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                {draftType === 'test' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Assessment name
                      <input
                        value={draftData.testName}
                        onChange={(event) => updateDraftField('testName', event.target.value)}
                        placeholder="SQL Certification Exam"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Provider (optional)
                      <input
                        value={draftData.testProvider}
                        onChange={(event) => updateDraftField('testProvider', event.target.value)}
                        placeholder="HackerRank / Coursera / ETS"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Score or outcome
                      <input
                        value={draftData.testScore}
                        onChange={(event) => updateDraftField('testScore', event.target.value)}
                        placeholder="93rd percentile"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Evidence link (optional)
                      <input
                        value={draftData.testEvidenceLink}
                        onChange={(event) => updateDraftField('testEvidenceLink', event.target.value)}
                        placeholder="https://..."
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </>
                ) : null}

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Capability signal tags</p>
                  <p className="mt-2 text-xs leading-5 text-[#4f6a62] dark:text-slate-300">
                    Calculated automatically by artifact type and evidence content.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {calculatedDraftTags.map((tag) => (
                      <span key={`dialog-draft-${tag}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagToneClass[tag]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitAddArtifactDialog}
                  disabled={isSubmittingArtifact || isDeletingArtifact}
                  className="inline-flex h-10 items-center rounded-xl bg-[#12f987] px-4 text-sm font-semibold text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingArtifact ? 'Saving...' : isEditingInDialog ? 'Save changes' : 'Save artifact'}
                </button>
                {isEditingInDialog ? (
                  <button
                    type="button"
                    onClick={() => void deleteEditingArtifact()}
                    disabled={isDeletingArtifact || isSubmittingArtifact}
                    className="inline-flex h-10 items-center rounded-xl border border-rose-300 bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500 dark:hover:bg-rose-400"
                  >
                    {isDeletingArtifact ? 'Deleting...' : 'Delete'}
                  </button>
                ) : null}
              </div>

              {statusMessage ? (
                <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {statusMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
