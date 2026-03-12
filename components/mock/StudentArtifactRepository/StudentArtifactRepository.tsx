import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type ArtifactType =
  | 'coursework'
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
  created_at: string;
  updated_at: string;
};

type ArtifactsApiPayload = {
  artifacts?: ArtifactApiRow[];
};

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
  { id: 'project', label: 'Project' },
  { id: 'internship', label: 'Internship' },
  { id: 'certification', label: 'Certification' },
  { id: 'leadership', label: 'Club / leadership' },
  { id: 'competition', label: 'Competition' },
  { id: 'research', label: 'Research' },
  { id: 'employment', label: 'Employment' },
  { id: 'test', label: 'Test evidence' }
];

const artifactTagOptions: ArtifactTag[] = [
  'Technical depth',
  'Applied execution',
  'Collaboration signal',
  'Systems thinking',
  'Communication signal',
  'Reliability signal'
];

const artifactTypeLabelMap: Record<ArtifactType, string> = {
  coursework: 'Coursework',
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
  coursework: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  project: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  internship: 'bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-100',
  certification: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100',
  leadership: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  competition: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-100',
  research: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100',
  employment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100',
  test: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
};

const minArtifactsSkeletonMs = 350;

const tagToneClass: Record<ArtifactTag, string> = {
  'Technical depth': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  'Applied execution': 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-100',
  'Collaboration signal': 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  'Systems thinking': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100',
  'Communication signal': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100',
  'Reliability signal': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
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

const ArtifactDetailSkeleton = () => (
  <>
    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="h-4 w-2/3 rounded bg-[#e6f1ec] dark:bg-slate-700" />
      <div className="mt-2 h-3 w-1/2 rounded bg-[#e6f1ec] dark:bg-slate-700" />
    </div>
    <div className="mt-4 h-3 w-full rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-2 h-3 w-5/6 rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-2 h-3 w-4/6 rounded bg-[#e6f1ec] dark:bg-slate-700" />
    <div className="mt-4 flex gap-2">
      <div className="h-5 w-20 rounded-full bg-[#e6f1ec] dark:bg-slate-700" />
      <div className="h-5 w-24 rounded-full bg-[#e6f1ec] dark:bg-slate-700" />
      <div className="h-5 w-16 rounded-full bg-[#e6f1ec] dark:bg-slate-700" />
    </div>
  </>
);

const mapApiArtifactToRecord = (row: ArtifactApiRow): ArtifactRecord | null => {
  const data = toRecord(row.artifact_data);
  const typeCandidate = toTrimmedString(row.artifact_type) ?? toTrimmedString(data.type);
  if (typeCandidate === 'transcript') return null;
  const artifactType: ArtifactType = isArtifactType(typeCandidate) ? typeCandidate : 'project';

  const title = toTrimmedString(data.title) ?? `${artifactTypeLabelMap[artifactType]} artifact`;
  const source = toTrimmedString(data.source) ?? artifactTypeSourcePreset[artifactType];
  const description = toTrimmedString(data.description) ?? 'Student-linked evidence artifact.';

  return {
    id: row.artifact_id,
    title,
    type: artifactType,
    artifactData: data,
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

export const StudentArtifactRepository = () => {
  const searchParams = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<ArtifactFilter>('all');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [showMobileDetailSheet, setShowMobileDetailSheet] = useState(false);
  const [showAddArtifactDialog, setShowAddArtifactDialog] = useState(false);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmittingArtifact, setIsSubmittingArtifact] = useState(false);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const hasAutoOpenedFromQueryRef = useRef(false);

  const [draftType, setDraftType] = useState<ArtifactType>('coursework');
  const [draftData, setDraftData] = useState<DraftArtifactForm>({ ...initialDraftArtifactForm });
  const [draftAttachmentName, setDraftAttachmentName] = useState('');
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const calculatedDraftTags = artifactTypeTagPreset[draftType];

  const filteredArtifacts = useMemo(() => {
    if (activeFilter === 'all') return artifacts;
    return artifacts.filter((artifact) => artifact.type === activeFilter);
  }, [activeFilter, artifacts]);

  const selectedArtifact = useMemo(() => {
    if (!selectedArtifactId) return filteredArtifacts[0] ?? artifacts[0] ?? null;
    return artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? filteredArtifacts[0] ?? artifacts[0] ?? null;
  }, [artifacts, filteredArtifacts, selectedArtifactId]);

  const signalCoverage = useMemo(() => {
    return artifactTagOptions
      .map((tag) => ({
        tag,
        count: artifacts.filter((artifact) => artifact.tags.includes(tag)).length
      }))
      .sort((first, second) => second.count - first.count);
  }, [artifacts]);

  const maxTagCount = useMemo(() => {
    return Math.max(...signalCoverage.map((item) => item.count), 1);
  }, [signalCoverage]);

  const showFirstArtifactTour = !isLoadingArtifacts && artifacts.length === 0;

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
      setSelectedArtifactId(mapped[0]?.id ?? null);
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

  const openEditArtifactDialog = () => {
    if (!selectedArtifact) return;

    setEditingArtifactId(selectedArtifact.id);
    setDraftType(selectedArtifact.type);
    setDraftData(toDraftFormFromArtifact(selectedArtifact));
    setDraftAttachmentName(selectedArtifact.attachmentName ?? '');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
    setShowAddArtifactDialog(true);
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

      if (courseCode.length < 2 || courseTitle.length < 2 || instructorName.length < 2 || impact.length < 10) {
        setStatusMessage('Coursework requires course code, title, instructor name, and an impact statement.');
        return;
      }

      title = `${courseCode} · ${courseTitle}`;
      source = 'Coursework evidence';
      description = `Instructor: ${instructorName}. Impact: ${impact}`;
      artifactDataPayload.course_code = courseCode;
      artifactDataPayload.course_title = courseTitle;
      artifactDataPayload.instructor_name = instructorName;
      artifactDataPayload.impact_description = impact;
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

    if (draftType === 'leadership') {
      const organization = draftData.leadershipOrganization.trim();
      const position = draftData.leadershipPosition.trim();
      const impact = draftData.leadershipImpact.trim();
      if (organization.length < 2 || position.length < 2 || impact.length < 10) {
        setStatusMessage('Leadership artifacts require organization, position, and impact statement.');
        return;
      }

      title = `${position} · ${organization}`;
      source = 'Leadership evidence';
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
      const selectedFile = documentInputRef.current?.files?.[0];

      if (selectedFile) {
        const uploadForm = new FormData();
        uploadForm.set('file', selectedFile);

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

      setShowMobileDetailSheet(false);
      closeArtifactDialog();
      setStatusMessage(`${isEditingExistingArtifact ? 'Updated' : 'Added'} artifact: ${normalizedTitle}.`);
    } finally {
      setIsSubmittingArtifact(false);
    }
  };

  const submitAddArtifactDialog = () => {
    void addArtifact();
  };

  const isEditingInDialog = Boolean(editingArtifactId);

  return (
    <section aria-labelledby="student-artifact-repository-title" className="w-full overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2
              id="student-artifact-repository-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Artifact Repository
            </h2>
            <p className="mt-2 text-sm text-[#4f6a62] dark:text-slate-300">
              Click Add New Artifact to add evidence that strengthens your profile.
            </p>
          </div>
        </div>

        {showFirstArtifactTour ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-[#2a5044] dark:text-slate-200">Quick start tour</p>
            <p className="mt-1 text-xs text-[#4f6a62] dark:text-slate-400">
              1) Click Add New Artifact. 2) Choose evidence type and add title, source, and a short description.
              3) Repeat for projects, internships, certifications, leadership, competition, and test evidence.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => openAddArtifactDialog()}>
                <span className="inline-flex items-center gap-2">
                  <PlusIcon />
                  <span>Add New Artifact</span>
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5a7a70] dark:text-slate-400">
            Filter by evidence type
          </p>
        </div>

        <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
          <div className="flex gap-2 pb-2 lg:flex-wrap lg:pb-0">
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
                  key={type.id}
                  type="button"
                  onClick={() => setActiveFilter(type.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeFilter === type.id
                      ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                      : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {type.label}{count > 0 ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {statusMessage ? (
          <p className="mt-3 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}

        {!isLoadingArtifacts && artifacts.length > 0 ? (
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
            <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
              {signalCoverage.map((signal) => (
                <div
                  key={`mobile-cov-${signal.tag}`}
                  className="w-28 shrink-0 rounded-xl border border-[#d4e1db] bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-[9px] font-semibold leading-tight text-[#4f6a62] dark:text-slate-400">{signal.tag}</p>
                    <span className="shrink-0 text-[10px] font-bold text-[#0f2b23] dark:text-slate-100">{signal.count}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-[#12f987]"
                      style={{ width: signal.count === 0 ? '0%' : `${Math.max((signal.count / maxTagCount) * 100, 14)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3 lg:hidden">
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
            filteredArtifacts.map((artifact) => (
              <article key={artifact.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedArtifactId(artifact.id);
                    setShowMobileDetailSheet(true);
                  }}
                  className="w-full rounded-2xl border border-[#d5e1db] bg-white px-4 py-4 text-left transition-colors active:bg-[#f0faf5] dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge className={`shrink-0 ${artifactTypeToneClass[artifact.type]}`}>{artifactTypeLabelMap[artifact.type]}</Badge>
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
                  <p className="mt-2 text-sm leading-5 text-[#48635b] dark:text-slate-300"
                     style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {artifact.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {artifact.tags.slice(0, 3).map((tag) => (
                      <span key={`${artifact.id}-${tag}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagToneClass[tag]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              </article>
            ))
          )}
        </div>

        <div className="mt-7 hidden gap-4 xl:grid xl:grid-cols-[1.08fr_0.92fr]">
          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80 xl:h-full xl:flex xl:flex-col xl:[&>div:last-child]:min-h-0 xl:[&>div:last-child]:flex-1 xl:[&>div:last-child]:overflow-hidden"
            header={
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
              <div className="max-h-[56rem] min-h-0 space-y-3 overflow-y-auto pr-1 xl:h-full xl:max-h-none">
                {filteredArtifacts.map((artifact) => {
                  const isSelected = selectedArtifact?.id === artifact.id;

                  return (
                    <article
                      key={artifact.id}
                      className={`rounded-2xl border px-4 py-3 transition-colors ${
                        isSelected
                          ? 'border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10'
                          : 'border-[#d5e1db] bg-[#f9fdfb] dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{artifact.title}</p>
                          <p className="mt-0.5 text-xs text-[#4c6860] dark:text-slate-400">
                            {artifact.source} · Updated {artifact.updatedAt}
                          </p>
                        </div>
                        <Badge className={artifactTypeToneClass[artifact.type]}>{artifactTypeLabelMap[artifact.type]}</Badge>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-[#48635b] dark:text-slate-300">{artifact.description}</p>

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
                        <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedArtifactId(artifact.id)}>
                          {isSelected ? 'Viewing details' : 'View details'}
                        </Button>
                        {artifact.link ? (
                          <a
                            href={artifact.link}
                            target="_blank"
                            rel="noreferrer"
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

          <div className="space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Artifact detail</h3>
                  {selectedArtifact && !isLoadingArtifacts ? (
                    <Button type="button" variant="secondary" size="sm" onClick={openEditArtifactDialog}>
                      Edit artifact
                    </Button>
                  ) : null}
                </div>
              }
            >
              {isLoadingArtifacts ? (
                <ArtifactDetailSkeleton />
              ) : selectedArtifact ? (
                <>
                  <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#15382f] dark:text-slate-100">{selectedArtifact.title}</p>
                      <Badge className={artifactTypeToneClass[selectedArtifact.type]}>{artifactTypeLabelMap[selectedArtifact.type]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-300">
                      {selectedArtifact.source} · Updated {selectedArtifact.updatedAt}
                    </p>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#48635b] dark:text-slate-300">{selectedArtifact.description}</p>

                  {selectedArtifact.attachmentName ? (
                    <p className="mt-2 text-xs font-medium text-[#3f5d54] dark:text-slate-300">
                      Document attached: {selectedArtifact.attachmentName}
                    </p>
                  ) : null}

                  {selectedArtifact.referenceQuote ? (
                    <div className="mt-3 rounded-xl border border-[#d3e0da] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Reference signal
                      </p>
                      <p className="mt-1 text-xs italic leading-5 text-[#48635b] dark:text-slate-300">
                        &ldquo;{selectedArtifact.referenceQuote}&rdquo;
                      </p>
                      <p className="mt-1 text-[11px] text-[#4f6a62] dark:text-slate-400">
                        {selectedArtifact.referenceContactName}
                        {selectedArtifact.referenceContactRole ? ` · ${selectedArtifact.referenceContactRole}` : ''}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedArtifact.tags.map((tag) => (
                      <span key={`detail-${tag}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagToneClass[tag]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#4a655d] dark:text-slate-300">Select an artifact card to inspect details.</p>
              )}
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Signal coverage summary</h3>}
            >
              <div className="mb-3 inline-flex items-center rounded-full border border-[#f3cf8a] bg-[#fff7e7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a5300] dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                Coming Soon
              </div>
              <div className="space-y-2">
                {signalCoverage.map((signal) => {
                  const width = Math.max((signal.count / maxTagCount) * 100, signal.count === 0 ? 0 : 14);

                  return (
                    <div key={`coverage-${signal.tag}`}>
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#4a655d] dark:text-slate-300">
                        <span>{signal.tag}</span>
                        <span>{signal.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                        <div className="h-full rounded-full bg-[#12f987]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openAddArtifactDialog()}
          className="fixed bottom-24 right-4 z-40 inline-flex h-12 items-center rounded-full border border-[#0fd978]/40 bg-[#12f987] px-4 text-sm font-semibold text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] sm:bottom-6 sm:right-6"
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            <span>Add New Artifact</span>
          </span>
        </button>

        {showMobileDetailSheet && selectedArtifact ? (
          <div className="fixed inset-0 z-[1200] lg:hidden">
            <button
              type="button"
              aria-label="Close artifact details"
              onClick={() => setShowMobileDetailSheet(false)}
              className="absolute inset-0 bg-[#0a1f1a]/45"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[#cfddd6] bg-[#f8fcfa] pb-10 dark:border-slate-700 dark:bg-slate-900">
              <div className="sticky top-0 z-10 rounded-t-3xl bg-[#f8fcfa] px-5 pt-4 dark:bg-slate-900">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-[#c8d7d1] dark:bg-slate-700" />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <Badge className={artifactTypeToneClass[selectedArtifact.type]}>{artifactTypeLabelMap[selectedArtifact.type]}</Badge>
                  <button
                    type="button"
                    onClick={() => setShowMobileDetailSheet(false)}
                    className="text-xs font-semibold text-[#4f6a62] dark:text-slate-400"
                  >
                    Done
                  </button>
                </div>
                <h3 className="mt-3 break-words text-xl font-semibold leading-tight text-[#0f2b23] dark:text-slate-100">
                  {selectedArtifact.title}
                </h3>
                <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-400">
                  {selectedArtifact.source} · Updated {selectedArtifact.updatedAt}
                </p>
                <div className="mt-4 border-b border-[#dde8e3] dark:border-slate-700" />
              </div>

              <div className="px-5 pt-4">
                <p className="text-sm leading-6 text-[#3a5a52] dark:text-slate-300">{selectedArtifact.description}</p>

                {selectedArtifact.attachmentName ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#d4e1db] bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[#4f6a62] dark:text-slate-400">
                      <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs font-medium text-[#3f5d54] dark:text-slate-300">{selectedArtifact.attachmentName}</p>
                  </div>
                ) : null}

                {selectedArtifact.referenceQuote ? (
                  <div className="mt-4 rounded-xl border border-[#d3e0da] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4f6a62] dark:text-slate-400">Reference signal</p>
                    <p className="mt-2 text-sm italic leading-6 text-[#2d4f47] dark:text-slate-200">&ldquo;{selectedArtifact.referenceQuote}&rdquo;</p>
                    <p className="mt-2 text-xs font-medium text-[#4f6a62] dark:text-slate-400">
                      {selectedArtifact.referenceContactName}
                      {selectedArtifact.referenceContactRole ? ` · ${selectedArtifact.referenceContactRole}` : ''}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4f6a62] dark:text-slate-400">Capability signals</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedArtifact.tags.map((tag) => (
                      <span key={`detail-mobile-${tag}`} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tagToneClass[tag]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedArtifact.link ? (
                  <a
                    href={selectedArtifact.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-[#12f987] text-sm font-semibold text-[#0a1f1a] shadow-[0_8px_20px_-12px_rgba(10,31,26,0.5)]"
                  >
                    Open linked resource ↗
                  </a>
                ) : null}
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
                  onClick={closeArtifactDialog}
                  className="text-xs font-semibold text-[#4f6a62] dark:text-slate-400"
                >
                  Close
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
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Syllabus file (optional)
                      </p>
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
                        accept=".pdf,.doc,.docx,.txt,.rtf,.md"
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

                {draftType === 'leadership' ? (
                  <>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Organization
                      <input
                        value={draftData.leadershipOrganization}
                        onChange={(event) => updateDraftField('leadershipOrganization', event.target.value)}
                        placeholder="Data Club"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Position
                      <input
                        value={draftData.leadershipPosition}
                        onChange={(event) => updateDraftField('leadershipPosition', event.target.value)}
                        placeholder="President / Team Lead"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Statement of impact
                      <textarea
                        value={draftData.leadershipImpact}
                        onChange={(event) => updateDraftField('leadershipImpact', event.target.value)}
                        placeholder="What did you do in this role and how did you go above and beyond?"
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
                  disabled={isSubmittingArtifact}
                  className="inline-flex h-10 items-center rounded-xl bg-[#12f987] px-4 text-sm font-semibold text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingArtifact ? 'Saving...' : isEditingInDialog ? 'Save changes' : 'Save artifact'}
                </button>
                <button
                  type="button"
                  onClick={closeArtifactDialog}
                  className="inline-flex h-10 items-center rounded-xl border border-[#bfd2ca] bg-white px-4 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
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
