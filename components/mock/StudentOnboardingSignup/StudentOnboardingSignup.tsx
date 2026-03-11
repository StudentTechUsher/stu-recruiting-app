import { useMemo, useState } from 'react';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
import { defaultFocusCompanyOptions } from '@/lib/companies/default-focus-companies';
import { defaultFocusRoleOptions } from '@/lib/roles/default-focus-roles';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type RoleTemplate = {
  id: string;
  label: string;
  role: string;
  company: string;
  skillDomain: string;
  summary: string;
};

type StudentArchetype = 'builder' | 'analyst' | 'strategist' | 'operator';
type LearningMode = 'project' | 'coursework' | 'collaborative' | 'independent';
type StudentYear = 'Year 1' | 'Year 2' | 'Year 3' | 'Year 4' | 'Graduate';
type CourseworkSource = 'sis_sync' | 'csv_upload' | 'manual_later';
type ProjectSignal = 'github' | 'portfolio' | 'both' | 'not_yet';

type AgentSuggestion = {
  id: string;
  title: string;
  action: string;
  rationale: string;
  impact: string;
};

type ArchetypeRecommendation = {
  archetypeId: StudentArchetype;
  confidence: 'High' | 'Medium';
  reason: string;
};

type StudentOnboardingCompletePayload = {
  personal_info: {
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    major_track: string;
    student_year: string;
    student_archetype: StudentArchetype;
    target_companies: string[];
    target_roles: string[];
  };
};

const roleTemplates: RoleTemplate[] = [
  {
    id: 'product-analyst',
    label: 'Product Analyst Track',
    role: 'Product Analyst',
    company: 'Shopify',
    skillDomain: 'Product analytics',
    summary: 'Build hypothesis-driven product analysis and stakeholder communication skills.'
  },
  {
    id: 'data-analyst',
    label: 'Data Analyst Track',
    role: 'Data Analyst',
    company: 'HubSpot',
    skillDomain: 'Data analytics',
    summary: 'Focus on SQL, dashboard storytelling, and measurable business recommendations.'
  },
  {
    id: 'associate-consultant',
    label: 'Consulting Track',
    role: 'Associate Consultant',
    company: 'Deloitte',
    skillDomain: 'Business strategy',
    summary: 'Develop structured problem solving and concise executive communication.'
  },
  {
    id: 'software-engineer',
    label: 'Software Engineering Track',
    role: 'Software Engineer',
    company: 'Atlassian',
    skillDomain: 'Engineering systems',
    summary: 'Practice implementation depth, code quality, and delivery reliability.'
  }
];

const roleDomainMap: Record<string, string> = {
  'Software Engineer': 'Engineering systems',
  'Data Analyst': 'Data analytics',
  'Product Analyst': 'Product analytics',
  'Data Engineer': 'Engineering systems',
  'Business Analyst': 'Business strategy',
  'Associate Consultant': 'Business strategy',
  'Product Manager': 'Product analytics',
  'UX Researcher': 'UX research',
  'Solutions Engineer': 'Engineering systems',
  'Operations Analyst': 'Growth and marketing analytics'
};

const studentArchetypes: Array<{ id: StudentArchetype; label: string; detail: string }> = [
  { id: 'builder', label: 'Builder', detail: 'Learns by shipping projects and iterating quickly.' },
  { id: 'analyst', label: 'Analyst', detail: 'Learns by pattern finding, metrics, and structured review.' },
  { id: 'strategist', label: 'Strategist', detail: 'Learns by frameworks, tradeoffs, and business context.' },
  { id: 'operator', label: 'Operator', detail: 'Learns by execution systems, reliability, and follow-through.' }
];

const archetypeToneClass: Record<StudentArchetype, string> = {
  builder:
    'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30',
  analyst:
    'border-sky-200 bg-sky-50/80 hover:bg-sky-100/70 dark:border-sky-900/50 dark:bg-sky-950/30 dark:hover:bg-sky-900/30',
  strategist:
    'border-amber-200 bg-amber-50/80 hover:bg-amber-100/70 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-900/30',
  operator:
    'border-slate-200 bg-slate-50/85 hover:bg-slate-100/75 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
};

const archetypeIconToneClass: Record<StudentArchetype, string> = {
  builder: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  analyst: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  strategist: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  operator: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
};

const ArchetypeIcon = ({ archetypeId, className = 'h-4 w-4' }: { archetypeId: StudentArchetype; className?: string }) => {
  if (archetypeId === 'builder') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 16l5.5-5.5 4 4L20 8" />
        <path d="M15 8h5v5" />
      </svg>
    );
  }

  if (archetypeId === 'analyst') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M12 16V8" />
        <path d="M17 16v-7" />
      </svg>
    );
  }

  if (archetypeId === 'strategist') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M5 5h14v5H5z" />
        <path d="M12 10v9" />
        <path d="M8 19h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 7h12" />
      <path d="M6 12h12" />
      <path d="M6 17h12" />
      <path d="M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  );
};

const learningModes: Array<{ id: LearningMode; label: string }> = [
  { id: 'project', label: 'Project-based learning' },
  { id: 'coursework', label: 'Coursework-first' },
  { id: 'collaborative', label: 'Team collaboration' },
  { id: 'independent', label: 'Independent deep work' }
];

const studentYearOptions: StudentYear[] = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate'];

const courseworkSourceOptions: Array<{ id: CourseworkSource; label: string }> = [
  { id: 'sis_sync', label: 'SIS sync' },
  { id: 'csv_upload', label: 'CSV upload' },
  { id: 'manual_later', label: 'Manual later' }
];

const projectSignalOptions: Array<{ id: ProjectSignal; label: string }> = [
  { id: 'github', label: 'GitHub linked' },
  { id: 'portfolio', label: 'Portfolio linked' },
  { id: 'both', label: 'GitHub + portfolio' },
  { id: 'not_yet', label: 'Not yet' }
];

const pathwayByDomain: Record<string, string[]> = {
  'Data analytics': [
    'SQL diagnostics and data quality checks',
    'Business KPI framing and metric decomposition',
    'Dashboard narrative and insight communication'
  ],
  'Product analytics': [
    'Experiment design and impact measurement',
    'Retention and funnel analysis',
    'Cross-functional recommendation writing'
  ],
  'Business strategy': [
    'Case structuring and hypothesis trees',
    'Market sizing and prioritization tradeoffs',
    'Executive summary presentation drills'
  ],
  'Engineering systems': [
    'Implementation planning and code design reviews',
    'System reliability and testing strategies',
    'Iteration velocity and pull-request quality'
  ],
  'UX research': [
    'Research plan and participant interview strategy',
    'Evidence synthesis and decision frameworks',
    'Usability findings and recommendation storytelling'
  ],
  'Growth and marketing analytics': [
    'Acquisition funnel segmentation',
    'Channel attribution and incrementality basics',
    'Campaign optimization narrative for hiring panels'
  ]
};

const emailRegex = /^[^\s@]+@[^\s@]+\.edu$/i;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeCompanyName = (value: string): string => value.trim().replace(/\s+/g, ' ');
const normalizeRoleName = (value: string): string => value.trim().replace(/\s+/g, ' ');

const buildCompanyOptions = (options?: string[]): string[] => {
  const source = options && options.length > 0 ? options : [...defaultFocusCompanyOptions];
  const deduped = new Map<string, string>();

  for (const option of source) {
    if (typeof option !== 'string') continue;
    const normalized = normalizeCompanyName(option);
    if (normalized.length < 2) continue;
    const key = normalized.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, normalized);
  }

  return Array.from(deduped.values());
};

const buildRoleOptions = (options?: string[]): string[] => {
  const source = options && options.length > 0 ? options : [...defaultFocusRoleOptions];
  const deduped = new Map<string, string>();

  for (const option of source) {
    if (typeof option !== 'string') continue;
    const normalized = normalizeRoleName(option);
    if (normalized.length < 2) continue;
    const key = normalized.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, normalized);
  }

  return Array.from(deduped.values());
};

const getInitialTemplate = (id?: string) => {
  return roleTemplates.find((template) => template.id === id) ?? roleTemplates[0];
};

const inferArchetype = (
  majorTrack: string,
  learningMode: LearningMode | '',
  weeklyCommitment: number
): ArchetypeRecommendation => {
  const major = majorTrack.toLowerCase();
  const containsAny = (keywords: string[]) => keywords.some((keyword) => major.includes(keyword));

  if (containsAny(['computer', 'software', 'engineering', 'cs', 'developer'])) {
    return {
      archetypeId: 'builder',
      confidence: 'High',
      reason: 'Your major focus points toward implementation-heavy work and shipping projects.'
    };
  }

  if (containsAny(['data', 'analytics', 'statistics', 'math', 'econometrics'])) {
    return {
      archetypeId: 'analyst',
      confidence: 'High',
      reason: 'Your academic focus aligns with pattern finding, measurement, and structured analysis.'
    };
  }

  if (containsAny(['business', 'economics', 'finance', 'marketing', 'strategy', 'consult'])) {
    return {
      archetypeId: 'strategist',
      confidence: 'High',
      reason: 'Your major context suggests you learn best through frameworks, tradeoffs, and business context.'
    };
  }

  if (learningMode === 'project') {
    return {
      archetypeId: 'builder',
      confidence: 'Medium',
      reason: 'Project-based learning usually maps to rapid execution and iteration.'
    };
  }

  if (learningMode === 'coursework') {
    return {
      archetypeId: 'analyst',
      confidence: 'Medium',
      reason: 'Coursework-first preference typically favors structured review and methodical analysis.'
    };
  }

  if (learningMode === 'collaborative') {
    return {
      archetypeId: 'operator',
      confidence: 'Medium',
      reason: 'Team-oriented learning often aligns with coordination, reliability, and follow-through.'
    };
  }

  if (learningMode === 'independent' && weeklyCommitment >= 10) {
    return {
      archetypeId: 'operator',
      confidence: 'Medium',
      reason: 'Independent deep-work with high weekly commitment aligns with consistent execution systems.'
    };
  }

  if (weeklyCommitment >= 12) {
    return {
      archetypeId: 'builder',
      confidence: 'Medium',
      reason: 'Higher weekly commitment usually supports project-first momentum and shipping output.'
    };
  }

  return {
    archetypeId: 'strategist',
    confidence: 'Medium',
    reason: 'Based on current inputs, strategist is the safest starting archetype and can be adjusted later.'
  };
};

export interface StudentOnboardingSignupProps {
  defaultTemplateId?: string;
  defaultCampusEmail?: string;
  focusCompanyOptions?: string[];
  focusRoleOptions?: string[];
  onComplete?: (payload: StudentOnboardingCompletePayload) => Promise<void> | void;
}

export const StudentOnboardingSignup = ({
  defaultTemplateId,
  defaultCampusEmail = '',
  focusCompanyOptions,
  focusRoleOptions,
  onComplete
}: StudentOnboardingSignupProps) => {
  const initialTemplate = useMemo(() => getInitialTemplate(defaultTemplateId), [defaultTemplateId]);
  const initialCompanyOptions = useMemo(() => buildCompanyOptions(focusCompanyOptions), [focusCompanyOptions]);
  const initialRoleOptions = useMemo(() => buildRoleOptions(focusRoleOptions), [focusRoleOptions]);
  const { studentOnboardingPreviewFlags } = useFeatureFlags();

  const [campusEmail, setCampusEmail] = useState(defaultCampusEmail);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentYear, setStudentYear] = useState<StudentYear | ''>('');
  const [majorTrack, setMajorTrack] = useState('');
  const [studentArchetype, setStudentArchetype] = useState<StudentArchetype | ''>('');
  const [learningMode, setLearningMode] = useState<LearningMode | ''>('project');
  const [weeklyCommitment, setWeeklyCommitment] = useState(6);

  const [courseworkSource, setCourseworkSource] = useState<CourseworkSource | ''>('manual_later');
  const [projectSignal, setProjectSignal] = useState<ProjectSignal | ''>('both');
  const [projectLink, setProjectLink] = useState('');
  const [certificationCount, setCertificationCount] = useState(0);
  const [leadershipEvidence, setLeadershipEvidence] = useState(false);
  const [testEvidence, setTestEvidence] = useState(false);

  const [availableCompanies, setAvailableCompanies] = useState<string[]>(initialCompanyOptions);
  const [availableRoles, setAvailableRoles] = useState<string[]>(initialRoleOptions);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoleName, setCustomRoleName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [archetypeAgentResult, setArchetypeAgentResult] = useState<ArchetypeRecommendation | null>(null);
  const [showArchetypeAgent, setShowArchetypeAgent] = useState(false);

  const selectedTemplate = initialTemplate;
  const primaryRole = selectedRoles[0] ?? '';
  const primaryCompany = selectedCompanies[0] ?? '';
  const skillDomain = roleDomainMap[primaryRole] ?? selectedTemplate?.skillDomain ?? 'Data analytics';

  const recommendedArchetype = useMemo(() => {
    if (!archetypeAgentResult) return null;
    return studentArchetypes.find((archetype) => archetype.id === archetypeAgentResult.archetypeId) ?? null;
  }, [archetypeAgentResult]);
  const showAiGuidancePanelPreview = studentOnboardingPreviewFlags.aiGuidancePanelPreview;
  const showPersonalizedPathwayPreview = studentOnboardingPreviewFlags.personalizedPathwayPreview;
  const showNextStudentViewsEnabledPreview = studentOnboardingPreviewFlags.nextStudentViewsEnabledPreview;
  const showOnboardingPreviewColumn =
    showAiGuidancePanelPreview || showPersonalizedPathwayPreview || showNextStudentViewsEnabledPreview;
  const isCampusEmailFromSession = defaultCampusEmail.trim().length > 0;

  const campusEmailValid = emailRegex.test(campusEmail.trim());

  const baselineFieldCount = useMemo(() => {
    return [
      campusEmailValid,
      firstName.trim().length > 1,
      lastName.trim().length > 1,
      studentYear !== '',
      majorTrack.trim().length > 1,
      studentArchetype !== ''
    ].filter(Boolean).length;
  }, [campusEmailValid, firstName, lastName, majorTrack, studentArchetype, studentYear]);

  const artifactSignalCount = useMemo(() => {
    let count = 0;

    if (courseworkSource !== '') count += 1;
    if (projectSignal === 'github' || projectSignal === 'portfolio' || projectSignal === 'both') count += 1;
    if (certificationCount > 0) count += 1;
    if (leadershipEvidence) count += 1;
    if (testEvidence) count += 1;

    return count;
  }, [certificationCount, courseworkSource, leadershipEvidence, projectSignal, testEvidence]);

  const baselineReady = baselineFieldCount === 6;
  const artifactsReady = artifactSignalCount >= 2;
  const goalsUnlocked = baselineReady;

  const goalsFieldCount = useMemo(() => {
    return [selectedCompanies.length > 0, selectedRoles.length > 0].filter(Boolean).length;
  }, [selectedCompanies.length, selectedRoles.length]);

  const goalsReady = goalsUnlocked && goalsFieldCount === 2;
  const isCreateAccountDisabled = isCompleting || !baselineReady || !goalsReady;

  const completionScore = useMemo(() => {
    const baselineScore = (baselineFieldCount / 6) * 60;
    const goalScore = goalsUnlocked ? (goalsFieldCount / 2) * 40 : 0;

    return Math.round(clamp(baselineScore + goalScore, 0, 100));
  }, [baselineFieldCount, goalsFieldCount, goalsUnlocked]);

  const personalizationReadiness = clamp(completionScore + (selectedRoles.length >= 2 ? 5 : 0), 0, 100);

  const evidenceTagSignals = useMemo(() => {
    const tags: string[] = [];

    if (projectSignal === 'github' || projectSignal === 'portfolio' || projectSignal === 'both') {
      tags.push('Technical depth');
      tags.push('Applied execution');
    }

    if (leadershipEvidence) tags.push('Collaboration signal');
    if (certificationCount > 0) tags.push('Credential signal');
    if (testEvidence) tags.push('Performance evidence');

    return Array.from(new Set(tags));
  }, [certificationCount, leadershipEvidence, projectSignal, testEvidence]);

  const pathwayRecommendations = useMemo(() => {
    if (!goalsUnlocked) {
      return [
        'Complete learner baseline to unlock role-specific pathway planning.',
        'After unlock, select role + company + domain to generate capability milestones.',
        'Artifact evidence intake will be captured after initial launch.'
      ];
    }

    const domainPathway = pathwayByDomain[skillDomain] ?? pathwayByDomain['Data analytics'];
    const selectedRoleSummary = selectedRoles.length > 0 ? selectedRoles.slice(0, 2).join(', ') : 'Early-career role not set yet';
    const selectedCompanySummary =
      selectedCompanies.length > 0 ? selectedCompanies.slice(0, 2).join(', ') : 'Target company not selected';

    return [
      `Role intent baseline: ${selectedRoleSummary}`,
      ...domainPathway,
      `Employer targeting signal: ${selectedCompanySummary}`
    ];
  }, [goalsUnlocked, selectedCompanies, selectedRoles, skillDomain]);

  const liveAgentSuggestions = useMemo<AgentSuggestion[]>(() => {
    const suggestions: AgentSuggestion[] = [];

    if (!campusEmailValid) {
      suggestions.push({
        id: 'email',
        title: 'Verify campus identity first',
        action: 'Use a valid .edu email',
        rationale: 'This unlocks SIS/course ingestion and university-linked context.',
        impact: 'Artifact repository setup'
      });
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      suggestions.push({
        id: 'identity',
        title: 'Complete your profile identity',
        action: 'Add your first and last name',
        rationale: 'Profile identity improves coaching personalization and employer-facing context.',
        impact: 'Profile quality'
      });
    }

    if (studentArchetype === '') {
      suggestions.push({
        id: 'archetype',
        title: 'Identify how you learn best',
        action: 'Pick your student archetype',
        rationale: 'Archetype helps tune planning style and coaching tone.',
        impact: 'Coaching quality'
      });
    }

    if (goalsUnlocked && selectedCompanies.length === 0) {
      suggestions.push({
        id: 'companies',
        title: 'Select focus employers',
        action: 'Choose a few companies in part 1',
        rationale: 'Employer focus helps scope coaching toward hiring expectations.',
        impact: 'Coaching relevance'
      });
    }

    if (goalsUnlocked && selectedRoles.length === 0) {
      suggestions.push({
        id: 'roles',
        title: 'Select target roles',
        action: 'Choose a few positions in part 2',
        rationale: 'Role focus is required for tailored milestones and practice plans.',
        impact: 'Pathway precision'
      });
    }

    if (selectedCompanies.length > 4 || selectedRoles.length > 4) {
      suggestions.push({
        id: 'focus',
        title: 'Narrow your selection scope',
        action: 'Trim company and role selections to a focused set',
        rationale: 'Smaller focus sets create stronger and more tailored coaching.',
        impact: 'Coaching signal quality'
      });
    }

    if (goalsReady) {
      suggestions.unshift({
        id: 'ready',
        title: 'Onboarding profile is strong',
        action: 'Generate your first capability pathway',
        rationale: 'Enough context is captured to produce high-confidence guidance.',
        impact: 'Dashboard + planner activation'
      });
    }

    return suggestions.slice(0, 5);
  }, [
    campusEmailValid,
    firstName,
    goalsReady,
    goalsUnlocked,
    lastName,
    selectedCompanies.length,
    selectedRoles.length,
    studentArchetype
  ]);

  const toggleCompany = (company: string) => {
    const normalizedKey = company.toLowerCase();
    setSelectedCompanies((current) =>
      current.some((value) => value.toLowerCase() === normalizedKey)
        ? current.filter((value) => value.toLowerCase() !== normalizedKey)
        : [...current, company]
    );
  };

  const toggleRole = (role: string) => {
    const normalizedKey = role.toLowerCase();
    setSelectedRoles((current) =>
      current.some((value) => value.toLowerCase() === normalizedKey)
        ? current.filter((value) => value.toLowerCase() !== normalizedKey)
        : [...current, role]
    );
  };

  const addCustomCompany = () => {
    const normalized = normalizeCompanyName(customCompanyName);
    if (normalized.length < 2) {
      setStatusMessage('Enter a valid company name to add it to your focus list.');
      return;
    }

    const existingCompany =
      availableCompanies.find((company) => company.toLowerCase() === normalized.toLowerCase()) ?? normalized;

    if (!availableCompanies.some((company) => company.toLowerCase() === normalized.toLowerCase())) {
      setAvailableCompanies((current) => [...current, normalized].sort((a, b) => a.localeCompare(b)));
    }

    setSelectedCompanies((current) =>
      current.some((company) => company.toLowerCase() === existingCompany.toLowerCase())
        ? current
        : [...current, existingCompany]
    );
    setCustomCompanyName('');
    setStatusMessage(`Added ${existingCompany} to focus companies.`);
  };

  const addCustomRole = () => {
    const normalized = normalizeRoleName(customRoleName);
    if (normalized.length < 2) {
      setStatusMessage('Enter a valid role name to add it to your focus list.');
      return;
    }

    const existingRole = availableRoles.find((role) => role.toLowerCase() === normalized.toLowerCase()) ?? normalized;

    if (!availableRoles.some((role) => role.toLowerCase() === normalized.toLowerCase())) {
      setAvailableRoles((current) => [...current, normalized].sort((a, b) => a.localeCompare(b)));
    }

    setSelectedRoles((current) =>
      current.some((role) => role.toLowerCase() === existingRole.toLowerCase()) ? current : [...current, existingRole]
    );
    setCustomRoleName('');
    setStatusMessage(`Added ${existingRole} to focus roles.`);
  };

  const runArchetypeAssistant = () => {
    const recommendation = inferArchetype(majorTrack, learningMode, weeklyCommitment);
    const suggestedArchetype = studentArchetypes.find((archetype) => archetype.id === recommendation.archetypeId);

    setArchetypeAgentResult(recommendation);
    setShowArchetypeAgent(true);
    setStatusMessage(`Agent recommendation ready: ${suggestedArchetype?.label ?? 'Archetype'} archetype.`);
  };

  const applyArchetypeRecommendation = () => {
    if (!archetypeAgentResult) {
      setStatusMessage('Run the archetype assistant first to generate a recommendation.');
      return;
    }

    const suggestedArchetype = studentArchetypes.find((archetype) => archetype.id === archetypeAgentResult.archetypeId);
    setStudentArchetype(archetypeAgentResult.archetypeId);
    setStatusMessage(`Applied archetype recommendation: ${suggestedArchetype?.label ?? 'Archetype'}.`);
  };

  const captureIntent = async () => {
    if (!baselineReady) {
      setStatusMessage('Finish learner baseline first so agent recommendations have context.');
      return;
    }

    if (!goalsReady) {
      setStatusMessage('Select at least one company and one role to finalize personalization.');
      return;
    }

    const finalRoleSummary = selectedRoles.slice(0, 2).join(", ");
    const finalCompanySummary = selectedCompanies.slice(0, 2).join(", ");
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!onComplete) {
      setStatusMessage(`Intent captured. Coaching is now focused on ${finalRoleSummary} for ${finalCompanySummary}.`);
      return;
    }

    setIsCompleting(true);
    try {
      await onComplete({
        personal_info: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          email: campusEmail.trim(),
          major_track: majorTrack.trim(),
          student_year: studentYear,
          student_archetype: studentArchetype as StudentArchetype,
          target_companies: selectedCompanies,
          target_roles: selectedRoles
        }
      });
    } catch {
      setStatusMessage("We couldn't finish onboarding right now. Please try again.");
    } finally {
      setIsCompleting(false);
    }

    setStatusMessage(`Intent captured. Coaching is now focused on ${finalRoleSummary} for ${finalCompanySummary}.`);
  };

  return (
    <section aria-labelledby="student-onboarding-signup-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">
              Student onboarding
            </p>
            <h2
              id="student-onboarding-signup-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Set up your profile and capture your career intent
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Sequence matters. Capture learner signals first, then unlock role and employer targeting so
              <strong className="font-bold"> stu.</strong> can generate stronger agentic guidance.
            </p>
          </div>
        </div>

        <div className={`mt-7 ${showOnboardingPreviewColumn ? 'grid gap-4 xl:grid-cols-[1.08fr_0.92fr]' : 'mx-auto max-w-4xl'}`}>
          <Card
            className={`bg-white/95 p-5 dark:bg-slate-900/80 ${showOnboardingPreviewColumn ? '' : 'mx-auto w-full'}`}
            header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Create account and set goals</h3>}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Step 1 · Student baseline
              </p>
              <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Campus email
                <input
                  type="email"
                  value={campusEmail}
                  onChange={(event) => {
                    if (isCampusEmailFromSession) return;
                    setCampusEmail(event.target.value);
                  }}
                  placeholder="name@university.edu"
                  readOnly={isCampusEmailFromSession}
                  className={`mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${
                    isCampusEmailFromSession ? 'cursor-not-allowed bg-[#f3f7f5] dark:bg-slate-800' : ''
                  }`}
                />
                <span
                  className={`mt-1 block text-[11px] ${
                    campusEmail.length === 0 || campusEmailValid
                      ? 'text-[#4f6a62] dark:text-slate-400'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {isCampusEmailFromSession ? (
                    <>
                      Using your signed-in campus email from session.
                    </>
                  ) : (
                    <>
                      Use your campus email ending in <strong>.edu</strong>.
                    </>
                  )}
                </span>
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  First name
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Ex: Alex"
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Last name
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Ex: Rivera"
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Student year
                  <select
                    value={studentYear}
                    onChange={(event) => setStudentYear(event.target.value as StudentYear)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select year</option>
                    {studentYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Major / focus area
                  <input
                    value={majorTrack}
                    onChange={(event) => setMajorTrack(event.target.value)}
                    placeholder="Ex: Information Systems"
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Student archetype</p>
                <div className="mt-2 hidden justify-center">
                  <Button type="button" size="sm" className="gap-1.5" onClick={runArchetypeAssistant}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                      <path d="M12 3l1.8 3.8L18 8.2l-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4.2-1.4L12 3z" />
                    </svg>
                    Need help choosing?
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {studentArchetypes.map((archetype) => {
                    const isActive = studentArchetype === archetype.id;
                    return (
                      <button
                        key={archetype.id}
                        type="button"
                        onClick={() => setStudentArchetype(archetype.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                          isActive
                            ? 'border-[#0fd978] bg-[#e9fef3] ring-1 ring-[#0fd978]/35 dark:border-emerald-500 dark:bg-emerald-500/10'
                            : archetypeToneClass[archetype.id]
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isActive ? 'bg-[#12f987] text-[#0a1f1a]' : archetypeIconToneClass[archetype.id]
                            }`}
                          >
                            <ArchetypeIcon archetypeId={archetype.id} />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-[#11352b] dark:text-slate-100">{archetype.label}</span>
                            <span className="mt-1 block text-[11px] leading-4 text-[#48635b] dark:text-slate-300">{archetype.detail}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {showArchetypeAgent ? (
                  <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#133a30] dark:text-slate-100">Archetype assistant recommendation</p>
                      <Badge className="bg-[#eef6f1] text-[#325148] dark:bg-slate-700 dark:text-slate-200">
                        {archetypeAgentResult ? `${archetypeAgentResult.confidence} confidence` : 'No recommendation'}
                      </Badge>
                    </div>

                    {recommendedArchetype && archetypeAgentResult ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${archetypeIconToneClass[recommendedArchetype.id]}`}>
                            <ArchetypeIcon archetypeId={recommendedArchetype.id} />
                          </span>
                          <p className="text-sm font-semibold text-[#11352b] dark:text-slate-100">{recommendedArchetype.label}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#48635b] dark:text-slate-300">{recommendedArchetype.detail}</p>
                        <p className="mt-1 text-xs leading-5 text-[#48635b] dark:text-slate-300">
                          Why this fit: {archetypeAgentResult.reason}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-[#48635b] dark:text-slate-300">
                        Run the assistant after adding your major, learning mode, or weekly commitment for better precision.
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={applyArchetypeRecommendation} disabled={!archetypeAgentResult}>
                        Use this archetype
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={runArchetypeAssistant}>
                        Refresh recommendation
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Learning mode</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {learningModes.map((mode) => {
                    const isActive = learningMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setLearningMode(mode.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                            : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="mt-3 hidden text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Weekly commitment ({weeklyCommitment} hrs)
                <input
                  type="range"
                  min={2}
                  max={18}
                  value={weeklyCommitment}
                  onChange={(event) => setWeeklyCommitment(Number(event.target.value))}
                  className="mt-2 w-full accent-[#12f987]"
                />
              </label>
            </div>

            <div className="mt-5 hidden border-t border-[#dfe8e3] pt-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Step 2 · Evidence baseline (artifact intake)
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Coursework source
                  <select
                    value={courseworkSource}
                    onChange={(event) => setCourseworkSource(event.target.value as CourseworkSource)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select source</option>
                    {courseworkSourceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Project signal
                  <select
                    value={projectSignal}
                    onChange={(event) => setProjectSignal(event.target.value as ProjectSignal)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select signal</option>
                    {projectSignalOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {projectSignal !== '' && projectSignal !== 'not_yet' ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Project link
                  <input
                    value={projectLink}
                    onChange={(event) => setProjectLink(event.target.value)}
                    placeholder="https://github.com/username or portfolio URL"
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              ) : null}

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Certifications
                  <select
                    value={certificationCount}
                    onChange={(event) => setCertificationCount(Number(event.target.value))}
                    className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={0}>None yet</option>
                    <option value={1}>1 certification</option>
                    <option value={2}>2 certifications</option>
                    <option value={3}>3+ certifications</option>
                  </select>
                </label>

                <label className="mt-7 flex items-center gap-2 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-sm font-medium text-[#1f3f35] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={leadershipEvidence}
                    onChange={(event) => setLeadershipEvidence(event.target.checked)}
                    className="h-4 w-4 accent-[#12f987]"
                  />
                  Clubs / leadership
                </label>

                <label className="mt-7 flex items-center gap-2 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-sm font-medium text-[#1f3f35] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={testEvidence}
                    onChange={(event) => setTestEvidence(event.target.checked)}
                    className="h-4 w-4 accent-[#12f987]"
                  />
                  Test performance evidence
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {evidenceTagSignals.length === 0 ? (
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">No artifact tags yet</Badge>
                ) : (
                  evidenceTagSignals.map((tag) => <Badge key={tag}>{tag}</Badge>)
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[#dfe8e3] pt-4 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Step 2 · Target role and goals
                </p>
                <Badge className={goalsUnlocked ? '' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100'}>
                  {goalsUnlocked ? 'Unlocked' : 'Locked'}
                </Badge>
              </div>

              {!goalsUnlocked ? (
                <p className="mt-2 rounded-xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] px-3 py-2 text-xs text-[#4f6a62] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Complete baseline to unlock your employer and role targeting.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-[#305349] dark:text-slate-300">
                    Select a focused set for best results. A few options in each section usually works best.
                  </p>
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                    selecting too many options may result in Coaching that is too broad and not well tailored to your goals
                  </p>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Part 1 · Focus companies
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableCompanies.map((company) => {
                        const isSelected = selectedCompanies.includes(company);
                        return (
                          <button
                            key={company}
                            type="button"
                            onClick={() => toggleCompany(company)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                                : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                          >
                            {company}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Add another company
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={customCompanyName}
                          onChange={(event) => setCustomCompanyName(event.target.value)}
                          placeholder="Type company name"
                          className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <Button type="button" size="sm" onClick={addCustomCompany} disabled={customCompanyName.trim().length < 2}>
                          Add company
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Part 2 · Focus roles
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableRoles.map((role) => {
                        const isSelected = selectedRoles.some((selectedRole) => selectedRole.toLowerCase() === role.toLowerCase());
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(role)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                                : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Add another role
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={customRoleName}
                          onChange={(event) => setCustomRoleName(event.target.value)}
                          placeholder="Type role title"
                          className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <Button type="button" size="sm" onClick={addCustomRole} disabled={customRoleName.trim().length < 2}>
                          Add role
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Selected companies</p>
                      <p className="mt-1 text-sm font-semibold text-[#133a30] dark:text-slate-100">{selectedCompanies.length}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedCompanies.length > 0 ? (
                          selectedCompanies.slice(0, 4).map((company) => <Badge key={company}>{company}</Badge>)
                        ) : (
                          <span className="text-xs text-[#48635b] dark:text-slate-300">No companies selected</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Selected roles</p>
                      <p className="mt-1 text-sm font-semibold text-[#133a30] dark:text-slate-100">{selectedRoles.length}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedRoles.length > 0 ? (
                          selectedRoles.slice(0, 4).map((role) => <Badge key={role}>{role}</Badge>)
                        ) : (
                          <span className="text-xs text-[#48635b] dark:text-slate-300">No roles selected</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={captureIntent} disabled={isCreateAccountDisabled}>
                {isCompleting ? "Finishing onboarding..." : "Create account and continue"}
              </Button>
              <Badge className="bg-[#eef6f1] text-[#325148] dark:bg-slate-700 dark:text-slate-200">
                Setup completion {completionScore}%
              </Badge>
            </div>

            {statusMessage ? (
              <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {statusMessage}
              </p>
            ) : null}
          </Card>

          {showOnboardingPreviewColumn ? (
            <div className="space-y-4">
              {showAiGuidancePanelPreview ? (
                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">AI guidance panel preview</h3>}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Live agent suggestions</p>
                  <div className="mt-3 space-y-2">
                    {liveAgentSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <p className="text-sm font-semibold text-[#133a30] dark:text-slate-100">{suggestion.title}</p>
                        <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">
                          Action: {suggestion.action}
                        </p>
                        <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">Why: {suggestion.rationale}</p>
                        <Badge className="mt-2 bg-[#eef6f1] text-[#325148] dark:bg-slate-700 dark:text-slate-200">{suggestion.impact}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {showPersonalizedPathwayPreview ? (
                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Personalized pathway preview</h3>}
                >
                  <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Readiness snapshot</p>
                    <p className="mt-2 text-sm text-[#1f4035] dark:text-slate-200">Personalization readiness: {personalizationReadiness}%</p>
                    <div className="mt-2 h-2 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                      <div className="h-full rounded-full bg-[#12f987]" style={{ width: `${personalizationReadiness}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{primaryRole || 'Role pending'}</Badge>
                      <Badge>{primaryCompany || 'Company pending'}</Badge>
                      <Badge>{skillDomain || 'Domain pending'}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Recommended pathway blocks
                    </p>
                    {pathwayRecommendations.map((step, index) => (
                      <div
                        key={`pathway-step-${index}`}
                        className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-sm text-[#1f4035] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#dff8ec] text-[11px] font-semibold text-[#1a5a42] dark:bg-emerald-500/20 dark:text-emerald-100">
                          {index + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {showNextStudentViewsEnabledPreview ? (
                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Next student views enabled</h3>}
                >
                  <div className="space-y-2">
                    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-[#133a30] dark:text-slate-100">Student Dashboard - Capability Overview</p>
                      <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">Needs baseline + goals.</p>
                      <Badge className="mt-2">{baselineReady && goalsReady ? 'Ready' : 'Pending'}</Badge>
                    </div>
                    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-[#133a30] dark:text-slate-100">Artifact Repository</p>
                      <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">Needs at least two artifact signals.</p>
                      <Badge className="mt-2">{artifactsReady ? 'Ready' : 'Pending'}</Badge>
                    </div>
                    <div className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-[#133a30] dark:text-slate-100">Pathway Planner + AI Agent Guidance</p>
                      <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">Needs baseline, evidence, and role intent.</p>
                      <Badge className="mt-2">{goalsReady ? 'Ready' : 'Pending'}</Badge>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
