import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import defaultCandidateAvatar from '../../../public/images/Gemini_Generated_Image_2jzqqj2jzqqj2jzq.png';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const GaugeComponent = dynamic(() => import('react-gauge-component'), {
  ssr: false,
  loading: () => <div className="h-[74px] w-full" aria-hidden="true" />
});

type CapabilityKey = 'problemSolving' | 'dataCommunication' | 'executionReliability' | 'collaboration' | 'businessJudgment';

type CandidateSortKey =
  | 'alignment_desc'
  | 'alignment_asc'
  | 'problem_solving_desc'
  | 'communication_desc';

type CapabilityScores = Record<CapabilityKey, number>;

type VideoSignal = {
  label: string;
  duration: string;
  url: string;
};

type ReferenceContact = {
  fullName: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  quote: string;
};

type QualitativeSignals = {
  introVideo: VideoSignal;
  projectDemoVideo: VideoSignal;
  references: ReferenceContact[];
};

type Candidate = {
  id: string;
  fullName: string;
  anonymousLabel: string;
  university: string;
  targetRole: string;
  alignmentScore: number;
  capabilities: CapabilityScores;
  qualitativeSignals: QualitativeSignals;
  topQualifyingReason: string;
  inviteDraftMessage: string;
};

const ALL_UNIVERSITIES = 'All universities';
const ALL_ROLES = 'All target roles';
const DEFAULT_CALENDAR_LINK = 'https://cal.com/stu/intro-call';

const capabilityDimensions = [
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'dataCommunication', label: 'Data communication' },
  { key: 'executionReliability', label: 'Execution reliability' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'businessJudgment', label: 'Business judgment' }
] as const;

const sortOptions: Array<{ value: CandidateSortKey; label: string }> = [
  { value: 'alignment_desc', label: 'Highest alignment score' },
  { value: 'alignment_asc', label: 'Lowest alignment score' },
  { value: 'problem_solving_desc', label: 'Strongest problem solving' },
  { value: 'communication_desc', label: 'Strongest data communication' }
];

const getQualitativeSignals = (
  introUrl: string,
  projectDemoUrl: string,
  references: ReferenceContact[]
): QualitativeSignals => ({
  introVideo: {
    label: 'Get to know you',
    duration: '1:30',
    url: introUrl
  },
  projectDemoVideo: {
    label: 'Project demo',
    duration: '3:45',
    url: projectDemoUrl
  },
  references
});

const candidatePool: Candidate[] = [
  {
    id: 'cand-1',
    fullName: 'Avery Park',
    anonymousLabel: 'Candidate 1042',
    university: 'Brigham Young University',
    targetRole: 'Product Analyst',
    alignmentScore: 91,
    capabilities: {
      problemSolving: 93,
      dataCommunication: 89,
      executionReliability: 88,
      collaboration: 86,
      businessJudgment: 87
    },
    topQualifyingReason: "Avery recently achieved first place in the Marriott School's annual case competition, demonstrating strong analytical thinking and executive-level presentation skills under pressure.",
    inviteDraftMessage: "Hi Avery, saw you recently won a case competition! Would love to hear more about your experience and explore what's next for you.",
    qualitativeSignals: getQualitativeSignals('https://videos.stu.dev/avery-park-intro', 'https://videos.stu.dev/avery-park-project-demo', [
      {
        fullName: 'Nicole Jensen',
        role: 'Capstone Faculty Advisor',
        organization: 'Brigham Young University',
        email: 'nicole.jensen@byu.edu',
        phone: '(801) 555-0102',
        quote: 'Avery translates ambiguous project requirements into clean experiments and clearly communicates tradeoffs.'
      },
      {
        fullName: 'Ethan Roberts',
        role: 'Product Manager Intern Supervisor',
        organization: 'Acme Growth Labs',
        email: 'ethan.roberts@acmegrowth.com',
        phone: '(312) 555-0144',
        quote: 'Avery ran weekly updates with design and analytics and consistently surfaced the right decision risks early.'
      },
      {
        fullName: 'Maya Collins',
        role: 'Student Org President Mentor',
        organization: 'AIS Chapter at BYU',
        email: 'maya.collins@alumni.byu.edu',
        phone: '(385) 555-0188',
        quote: 'When deadlines stacked up, Avery still kept the team organized and delivered polished client-ready work.'
      }
    ])
  },
  {
    id: 'cand-2',
    fullName: 'Jordan Kim',
    anonymousLabel: 'Candidate 1187',
    university: 'Georgia Tech',
    targetRole: 'Data Analyst',
    alignmentScore: 87,
    capabilities: {
      problemSolving: 90,
      dataCommunication: 82,
      executionReliability: 85,
      collaboration: 78,
      businessJudgment: 80
    },
    topQualifyingReason: "Jordan independently built and validated a forecasting pipeline that their team moved directly into production — a level of ownership that's rare at this career stage.",
    inviteDraftMessage: "Hi Jordan, heard you built a forecasting pipeline that went all the way to production. That kind of ownership stands out. Would love to connect.",
    qualitativeSignals: getQualitativeSignals('https://videos.stu.dev/jordan-kim-intro', 'https://videos.stu.dev/jordan-kim-project-demo', [
      {
        fullName: 'Priya Narang',
        role: 'Analytics Professor',
        organization: 'Georgia Tech',
        email: 'priya.narang@gatech.edu',
        phone: '(404) 555-0120',
        quote: 'Jordan presents technical findings in a way non-technical stakeholders immediately understand.'
      },
      {
        fullName: 'Liam Baker',
        role: 'Data Science Internship Lead',
        organization: 'Vertex Retail',
        email: 'liam.baker@vertexretail.com',
        phone: '(770) 555-0197',
        quote: 'Jordan independently built and validated a forecasting pipeline that our team moved into production.'
      }
    ])
  },
  {
    id: 'cand-3',
    fullName: 'Taylor Singh',
    anonymousLabel: 'Candidate 1221',
    university: 'Arizona State University',
    targetRole: 'Associate Consultant',
    alignmentScore: 76,
    capabilities: {
      problemSolving: 79,
      dataCommunication: 75,
      executionReliability: 74,
      collaboration: 77,
      businessJudgment: 71
    },
    topQualifyingReason: "Taylor stays composed under pressure and consistently improves deliverables after feedback — a combination that signals fast growth in a consulting environment.",
    inviteDraftMessage: "Hi Taylor, your track record of staying composed under pressure while continuously refining your work is exactly what we look for. Would love to chat.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/taylor-singh-intro',
      'https://videos.stu.dev/taylor-singh-project-demo',
      [
        {
          fullName: 'Rachel Monroe',
          role: 'Consulting Practicum Coach',
          organization: 'Arizona State University',
          email: 'rachel.monroe@asu.edu',
          phone: '(480) 555-0129',
          quote: 'Taylor is steady under pressure and consistently improves recommendations after feedback.'
        },
        {
          fullName: 'Carlos Medina',
          role: 'Operations Manager',
          organization: 'Southwest Logistics',
          email: 'carlos.medina@swlogistics.com',
          phone: '(602) 555-0163',
          quote: 'Taylor quickly learned our constraints and produced a practical workflow redesign we still use.'
        }
      ]
    )
  },
  {
    id: 'cand-4',
    fullName: 'Riley Carter',
    anonymousLabel: 'Candidate 1274',
    university: 'University of Michigan',
    targetRole: 'Data Analyst',
    alignmentScore: 72,
    capabilities: {
      problemSolving: 74,
      dataCommunication: 70,
      executionReliability: 73,
      collaboration: 69,
      businessJudgment: 68
    },
    topQualifyingReason: "Riley took full ownership of dashboard QA and documented issues in a way that directly accelerated release decisions — showing strong process instincts.",
    inviteDraftMessage: "Hi Riley, taking ownership of dashboard QA and turning that into faster release decisions is impressive work. Would love to learn more.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/riley-carter-intro',
      'https://videos.stu.dev/riley-carter-project-demo',
      [
        {
          fullName: 'Devon Price',
          role: 'Course Instructor',
          organization: 'University of Michigan',
          email: 'devon.price@umich.edu',
          phone: '(734) 555-0106',
          quote: 'Riley asks the right clarifying questions and reliably follows through on team deliverables.'
        },
        {
          fullName: 'Samira Khan',
          role: 'BI Manager',
          organization: 'BlueLake Energy',
          email: 'samira.khan@bluelakeenergy.com',
          phone: '(313) 555-0172',
          quote: 'Riley took ownership of dashboard QA and documented issues in a way that sped up release decisions.'
        }
      ]
    )
  },
  {
    id: 'cand-5',
    fullName: 'Morgan Nguyen',
    anonymousLabel: 'Candidate 1346',
    university: 'Purdue University',
    targetRole: 'Product Analyst',
    alignmentScore: 84,
    capabilities: {
      problemSolving: 83,
      dataCommunication: 85,
      executionReliability: 82,
      collaboration: 81,
      businessJudgment: 78
    },
    topQualifyingReason: "Morgan connects user evidence to concrete roadmap decisions without overcomplicating the discussion — a rare blend of research skill and product judgment.",
    inviteDraftMessage: "Hi Morgan, translating user research directly into roadmap decisions is a skill most candidates struggle with — you seem to have it. Would love to connect.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/morgan-nguyen-intro',
      'https://videos.stu.dev/morgan-nguyen-project-demo',
      [
        {
          fullName: 'Alyssa Turner',
          role: 'Product Strategy Lecturer',
          organization: 'Purdue University',
          email: 'alyssa.turner@purdue.edu',
          phone: '(765) 555-0134',
          quote: 'Morgan can connect user evidence to concrete roadmap decisions without overcomplicating the discussion.'
        },
        {
          fullName: 'Noah Patel',
          role: 'Associate Product Director',
          organization: 'BrightPath Tech',
          email: 'noah.patel@brightpath.com',
          phone: '(317) 555-0175',
          quote: 'Morgan led customer interview synthesis and surfaced a decision-ready recommendation for our PM team.'
        },
        {
          fullName: 'Elena Ruiz',
          role: 'Peer Team Lead',
          organization: 'Purdue Product Lab',
          email: 'elena.ruiz@purdue.edu',
          phone: '(574) 555-0108',
          quote: 'Morgan is a dependable collaborator who helps teams stay focused on outcomes and deadlines.'
        }
      ]
    )
  },
  {
    id: 'cand-6',
    fullName: 'Casey Brooks',
    anonymousLabel: 'Candidate 1410',
    university: 'University of Texas at Austin',
    targetRole: 'Associate Consultant',
    alignmentScore: 66,
    capabilities: {
      problemSolving: 68,
      dataCommunication: 64,
      executionReliability: 67,
      collaboration: 70,
      businessJudgment: 63
    },
    topQualifyingReason: "Casey structures ambiguous client requests into clear, actionable tasks — a practical skill that makes a tangible difference on fast-moving consulting engagements.",
    inviteDraftMessage: "Hi Casey, structuring ambiguous client requests into clear deliverables is harder than it sounds. Your approach stood out. Would love to chat.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/casey-brooks-intro',
      'https://videos.stu.dev/casey-brooks-project-demo',
      [
        {
          fullName: 'Jacob Reed',
          role: 'Consulting Program Mentor',
          organization: 'University of Texas at Austin',
          email: 'jacob.reed@utexas.edu',
          phone: '(512) 555-0141',
          quote: 'Casey learns quickly and does a solid job structuring ambiguous client requests into clear tasks.'
        },
        {
          fullName: 'Imani Walker',
          role: 'Operations Analyst Manager',
          organization: 'Lone Star Health',
          email: 'imani.walker@lonestarhealth.com',
          phone: '(214) 555-0191',
          quote: 'Casey is detail-oriented and consistently ships dependable analysis under tight timelines.'
        }
      ]
    )
  },
  {
    id: 'cand-7',
    fullName: 'Skyler Adams',
    anonymousLabel: 'Candidate 1492',
    university: 'Northeastern University',
    targetRole: 'Data Analyst',
    alignmentScore: 89,
    capabilities: {
      problemSolving: 88,
      dataCommunication: 86,
      executionReliability: 87,
      collaboration: 83,
      businessJudgment: 84
    },
    topQualifyingReason: "Skyler combines deep statistical judgment with clear stakeholder communication — an increasingly rare pairing that accelerates team decision-making.",
    inviteDraftMessage: "Hi Skyler, the combination of statistical depth and clear stakeholder communication is rare — and we noticed. Would love to explore a potential fit.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/skyler-adams-intro',
      'https://videos.stu.dev/skyler-adams-project-demo',
      [
        {
          fullName: 'Naomi Lee',
          role: 'Data Systems Professor',
          organization: 'Northeastern University',
          email: 'naomi.lee@northeastern.edu',
          phone: '(617) 555-0128',
          quote: 'Skyler combines strong statistical judgment with excellent communication in stakeholder-facing settings.'
        },
        {
          fullName: 'Connor Walsh',
          role: 'Senior Analytics Manager',
          organization: 'Harbor Insights',
          email: 'connor.walsh@harborinsights.com',
          phone: '(857) 555-0177',
          quote: 'Skyler owned an attribution model rollout and handled feedback from product and marketing effectively.'
        }
      ]
    )
  },
  {
    id: 'cand-8',
    fullName: 'Drew Morales',
    anonymousLabel: 'Candidate 1563',
    university: 'Georgia Tech',
    targetRole: 'Product Analyst',
    alignmentScore: 79,
    capabilities: {
      problemSolving: 81,
      dataCommunication: 80,
      executionReliability: 77,
      collaboration: 75,
      businessJudgment: 74
    },
    topQualifyingReason: "Drew translated customer interview notes into sprint-ready roadmap recommendations for a real product team — demonstrating strong, practical product instincts.",
    inviteDraftMessage: "Hi Drew, turning customer interviews into sprint-ready recommendations shows real product thinking. Would love to learn more about your work.",
    qualitativeSignals: getQualitativeSignals(
      'https://videos.stu.dev/drew-morales-intro',
      'https://videos.stu.dev/drew-morales-project-demo',
      [
        {
          fullName: 'Sophie Carter',
          role: 'Product Analytics Faculty',
          organization: 'Georgia Tech',
          email: 'sophie.carter@gatech.edu',
          phone: '(404) 555-0156',
          quote: 'Drew communicates clearly and stays focused on measurable outcomes when project scope changes.'
        },
        {
          fullName: 'Ben Alvarez',
          role: 'Associate Product Manager',
          organization: 'Orbit Labs',
          email: 'ben.alvarez@orbitlabs.com',
          phone: '(678) 555-0186',
          quote: 'Drew translated customer interview notes into roadmap-ready recommendations for our summer sprint.'
        }
      ]
    )
  }
];

const getAlignmentBand = (alignmentScore: number) => {
  if (alignmentScore >= 85) return 'Standout';
  if (alignmentScore >= 70) return 'Ready';
  if (alignmentScore >= 55) return 'Developing';
  return 'Emerging';
};

const bandClassMap: Record<string, string> = {
  Standout: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  Ready: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-100',
  Developing: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  Emerging: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100'
};


const alignmentMetadataTagsByBand: Record<string, string[]> = {
  Standout: [
    'Annual Case Study Competition Finalist',
    '10+ Project Artifacts',
    "President of BYU's AIS Chapter",
    '+5 Additional Hiring Signals'
  ],
  Ready: ['7+ Project Artifacts', 'Cross-functional capstone completed', 'Leadership in student teams'],
  Developing: ['Core artifacts submitted', 'Competency progression trend', 'Mentorship engagement active'],
  Emerging: ['Baseline evidence captured', 'Initial capability profile set', 'Next-step pathway assigned']
};

type RecommendationProfile = {
  actionLabel: string;
  summary: string;
  outcomes: Array<{ label: string; value: string }>;
  nextStep: string;
};

const recommendationProfileByBand: Record<string, RecommendationProfile> = {
  Standout: {
    actionLabel: 'Fast-track to structured interview',
    summary:
      'End-of-cycle calibration places this candidate in the highest-confidence cohort for early interview success.',
    outcomes: [
      { label: 'Interview conversion forecast', value: '74%' },
      { label: 'Onboarding friction delta', value: '-24%' },
      { label: 'Early-performance ramp', value: '+19%' }
    ],
    nextStep: 'Send interview invite this week and prioritize manager-panel scheduling.'
  },
  Ready: {
    actionLabel: 'Advance to shortlist this cycle',
    summary:
      'Signal quality is strong enough for shortlist inclusion, with targeted validation needed in structured interviews.',
    outcomes: [
      { label: 'Interview conversion forecast', value: '62%' },
      { label: 'Onboarding friction delta', value: '-14%' },
      { label: 'Early-performance ramp', value: '+11%' }
    ],
    nextStep: 'Move forward to first-round interview and validate the top two capability gaps.'
  },
  Developing: {
    actionLabel: 'Hold for next recruiting window',
    summary:
      'Current signal is improving, but calibration confidence suggests waiting for additional validated artifacts.',
    outcomes: [
      { label: 'Interview conversion forecast', value: '46%' },
      { label: 'Onboarding friction delta', value: '-5%' },
      { label: 'Early-performance ramp', value: '+4%' }
    ],
    nextStep: 'Keep in nurture queue and reassess after additional project and leadership evidence is added.'
  },
  Emerging: {
    actionLabel: 'Do not advance this cycle',
    summary: 'Signal density is below threshold for this role; development milestones should be completed before outreach.',
    outcomes: [
      { label: 'Interview conversion forecast', value: '33%' },
      { label: 'Onboarding friction delta', value: '+4%' },
      { label: 'Early-performance ramp', value: '-3%' }
    ],
    nextStep: 'Route to development plan and revisit after baseline capability milestones are completed.'
  }
};

export interface CandidateExplorerProps {
  defaultAnonymized?: boolean;
  candidateAvatarSrc?: string;
  embedded?: boolean;
}

const AlignmentGauge = ({ score }: { score: number }) => {
  return (
    <div className="w-28 shrink-0">
      <div className="h-[74px] w-full">
        <GaugeComponent
          type="semicircle"
          value={score}
          minValue={0}
          maxValue={100}
          marginInPercent={{ top: 0.04, bottom: 0.00, left: 0.07, right: 0.07 }}
          arc={{
            width: 0.22,
            padding: 0.005,
            cornerRadius: 4,
            subArcs: [
              { limit: 55, color: '#f43f5e' },
              { limit: 70, color: '#f59e0b' },
              { limit: 85, color: '#14b8a6' },
              { limit: 100, color: '#12f987' }
            ]
          }}
          pointer={{
            type: 'needle',
            length: 0.75,
            width: 12,
            animate: false,
            strokeWidth: 0,
            baseColor: '#dbeee5'
          }}
          labels={{
            valueLabel: {
              matchColorWithArc: false,
              style: {
                fontSize: '30px',
                fontWeight: '700',
                fill: '#000000',
                textShadow: 'none'
              }
            },
            tickLabels: {
              hideMinMax: true,
              ticks: [],
              defaultTickLineConfig: { hide: true },
              defaultTickValueConfig: { hide: true }
            }
          }}
        />
      </div>
    </div>
  );
};

export const CandidateExplorer = ({
  defaultAnonymized = false,
  candidateAvatarSrc = defaultCandidateAvatar.src,
  embedded = false
}: CandidateExplorerProps) => {
  const [selectedUniversity, setSelectedUniversity] = useState(ALL_UNIVERSITIES);
  const [selectedRole, setSelectedRole] = useState(ALL_ROLES);
  const [sortKey, setSortKey] = useState<CandidateSortKey>('alignment_desc');
  const [anonymizedPreview, setAnonymizedPreview] = useState(defaultAnonymized);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(candidatePool[0]?.id ?? null);
  const [flaggedCandidateIds, setFlaggedCandidateIds] = useState<string[]>([]);
  const [invitedCandidateIds, setInvitedCandidateIds] = useState<string[]>([]);
  const [calendarSentCandidateIds, setCalendarSentCandidateIds] = useState<string[]>([]);

  const [inviteMessageDraftByCandidateId, setInviteMessageDraftByCandidateId] = useState<Record<string, string>>({});
  const [calendarLinksByCandidateId, setCalendarLinksByCandidateId] = useState<Record<string, string>>({});
  const [calendarDraftByCandidateId, setCalendarDraftByCandidateId] = useState<Record<string, string>>({});
  const [notesByCandidateId, setNotesByCandidateId] = useState<Record<string, string[]>>({});
  const [noteDraftByCandidateId, setNoteDraftByCandidateId] = useState<Record<string, string>>({});
  const [activityByCandidateId, setActivityByCandidateId] = useState<Record<string, string[]>>({});

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const universities = useMemo(() => {
    return [ALL_UNIVERSITIES, ...new Set(candidatePool.map((candidate) => candidate.university))];
  }, []);

  const targetRoles = useMemo(() => {
    return [ALL_ROLES, ...new Set(candidatePool.map((candidate) => candidate.targetRole))];
  }, []);

  const filteredCandidates = useMemo(() => {
    const filtered = candidatePool.filter((candidate) => {
      const universityMatch = selectedUniversity === ALL_UNIVERSITIES || candidate.university === selectedUniversity;
      const roleMatch = selectedRole === ALL_ROLES || candidate.targetRole === selectedRole;
      return universityMatch && roleMatch;
    });

    const sorted = [...filtered];

    switch (sortKey) {
      case 'alignment_asc':
        sorted.sort((first, second) => first.alignmentScore - second.alignmentScore);
        break;
      case 'problem_solving_desc':
        sorted.sort((first, second) => second.capabilities.problemSolving - first.capabilities.problemSolving);
        break;
      case 'communication_desc':
        sorted.sort((first, second) => second.capabilities.dataCommunication - first.capabilities.dataCommunication);
        break;
      case 'alignment_desc':
      default:
        sorted.sort((first, second) => second.alignmentScore - first.alignmentScore);
        break;
    }

    return sorted;
  }, [selectedRole, selectedUniversity, sortKey]);

  const selectedCandidate = useMemo(() => {
    if (filteredCandidates.length === 0) return null;
    if (!selectedCandidateId) return filteredCandidates[0];

    return filteredCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? filteredCandidates[0];
  }, [filteredCandidates, selectedCandidateId]);
  const selectedCandidateBand = selectedCandidate ? getAlignmentBand(selectedCandidate.alignmentScore) : undefined;
  const selectedCandidateMetadataTags = selectedCandidateBand ? alignmentMetadataTagsByBand[selectedCandidateBand] ?? [] : [];
  const selectedRecommendationProfile = selectedCandidateBand
    ? recommendationProfileByBand[selectedCandidateBand]
    : undefined;
  const selectedCandidateQualitativeSignals = selectedCandidate?.qualitativeSignals;

  const calendarLinkDraft = selectedCandidate
    ? (calendarDraftByCandidateId[selectedCandidate.id] ?? calendarLinksByCandidateId[selectedCandidate.id] ?? DEFAULT_CALENDAR_LINK)
    : DEFAULT_CALENDAR_LINK;

  const noteDraft = selectedCandidate ? (noteDraftByCandidateId[selectedCandidate.id] ?? '') : '';
  const sectionClassName = embedded ? 'w-full' : 'w-full px-6 py-12 lg:px-8';
  const surfaceClassName = embedded
    ? 'rounded-[30px] border border-[#cfddd6] bg-[#f8fcfa] p-5 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75'
    : 'rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75';

  const appendActivity = (candidateId: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const nextEntry = `${timestamp} · ${message}`;

    setActivityByCandidateId((current) => ({
      ...current,
      [candidateId]: [nextEntry, ...(current[candidateId] ?? [])].slice(0, 8)
    }));
  };

  const getDisplayName = (candidate: Candidate) => {
    return anonymizedPreview ? candidate.anonymousLabel : candidate.fullName;
  };

  const getInviteMessage = (candidate: Candidate) => {
    return inviteMessageDraftByCandidateId[candidate.id] ?? candidate.inviteDraftMessage;
  };

  const inviteCandidate = (candidate: Candidate, customMessage?: string) => {
    if (!invitedCandidateIds.includes(candidate.id)) {
      setInvitedCandidateIds((current) => [...current, candidate.id]);
    }

    const message = customMessage ?? getInviteMessage(candidate);
    const preview = message.length > 60 ? `${message.slice(0, 60)}…` : message;
    appendActivity(candidate.id, `Invite sent: "${preview}"`);
    setStatusMessage(`Invite sent to ${getDisplayName(candidate)}.`);
  };

  const toggleFlagCandidate = () => {
    if (!selectedCandidate) return;

    const isFlagged = flaggedCandidateIds.includes(selectedCandidate.id);

    if (isFlagged) {
      setFlaggedCandidateIds((current) => current.filter((candidateId) => candidateId !== selectedCandidate.id));
      appendActivity(selectedCandidate.id, 'Removed early reach-out flag');
      setStatusMessage(`Removed reach-out flag for ${getDisplayName(selectedCandidate)}.`);
      return;
    }

    setFlaggedCandidateIds((current) => [...current, selectedCandidate.id]);
    appendActivity(selectedCandidate.id, 'Flagged for early reach-out');
    setStatusMessage(`Flagged ${getDisplayName(selectedCandidate)} for early reach-out.`);
  };

  const sendCalendarLink = () => {
    if (!selectedCandidate) return;

    const cleanLink = calendarLinkDraft.trim();

    if (cleanLink.length === 0) {
      setStatusMessage('Add a calendar URL before sending.');
      return;
    }

    if (!/^https?:\/\//i.test(cleanLink)) {
      setStatusMessage('Calendar link must start with http:// or https://');
      return;
    }

    setCalendarLinksByCandidateId((current) => ({
      ...current,
      [selectedCandidate.id]: cleanLink
    }));
    setCalendarDraftByCandidateId((current) => ({
      ...current,
      [selectedCandidate.id]: cleanLink
    }));

    if (!calendarSentCandidateIds.includes(selectedCandidate.id)) {
      setCalendarSentCandidateIds((current) => [...current, selectedCandidate.id]);
    }

    appendActivity(selectedCandidate.id, `Sent calendar link (${cleanLink})`);
    setStatusMessage(`Calendar link sent to ${getDisplayName(selectedCandidate)}.`);
  };

  const saveHiringTeamNote = () => {
    if (!selectedCandidate) return;

    const cleanNote = noteDraft.trim();

    if (cleanNote.length === 0) {
      setStatusMessage('Write a hiring team note before saving.');
      return;
    }

    setNotesByCandidateId((current) => ({
      ...current,
      [selectedCandidate.id]: [cleanNote, ...(current[selectedCandidate.id] ?? [])]
    }));

    appendActivity(selectedCandidate.id, 'Added hiring team note');
    setStatusMessage(`Saved hiring team note for ${getDisplayName(selectedCandidate)}.`);
    setNoteDraftByCandidateId((current) => ({
      ...current,
      [selectedCandidate.id]: ''
    }));
  };

  const openVideoSignal = (candidate: Candidate, video: VideoSignal) => {
    if (typeof window !== 'undefined') {
      window.open(video.url, '_blank', 'noopener,noreferrer');
    }

    appendActivity(candidate.id, `Opened ${video.label} video`);
    setStatusMessage(`${video.label} opened for ${getDisplayName(candidate)}.`);
  };

  const contactReference = async (candidate: Candidate, reference: ReferenceContact) => {
    const contactLine = `${reference.fullName} · ${reference.email} · ${reference.phone}`;
    let copied = false;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(contactLine);
        copied = true;
      } catch {
        copied = false;
      }
    }

    appendActivity(candidate.id, `Opened reference contact: ${reference.fullName}`);
    setStatusMessage(
      copied
        ? `Copied reference contact for ${reference.fullName}.`
        : `Reference contact ready: ${reference.fullName} · ${reference.email}`
    );
  };

  return (
    <section aria-labelledby="candidate-explorer-title" className={sectionClassName}>
      <div className={surfaceClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">
              Candidate Explorer
            </p>
            <h2
              id="candidate-explorer-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Explore aligned talent before applications open
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Recruiters can sort candidate signals, compare capability breakdowns, and trigger early-conversation
              workflows from one unified pipeline screen, including intro and project videos plus quick reference
              outreach.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Signal before applications
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
            University
            <select
              value={selectedUniversity}
              onChange={(event) => setSelectedUniversity(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {universities.map((university) => (
                <option key={university} value={university}>
                  {university}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
            Target role
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {targetRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
            Sort by
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as CandidateSortKey)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex h-11 items-center gap-2 self-end rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm font-semibold text-[#1f4035] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={anonymizedPreview}
              onChange={(event) => setAnonymizedPreview(event.target.checked)}
              className="h-4 w-4 accent-[#12f987]"
            />
            Anonymized preview
          </label>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card
            className="min-w-0 bg-white/95 p-5 dark:bg-slate-900/80 xl:h-full xl:flex xl:flex-col xl:[&>div:last-child]:min-h-0 xl:[&>div:last-child]:flex-1 xl:[&>div:last-child]:overflow-hidden"
            header={
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                    Candidate list
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">
                    {filteredCandidates.length} candidates in view
                  </h3>
                </div>
                <Badge>{sortOptions.find((option) => option.value === sortKey)?.label ?? 'Sorted'}</Badge>
              </div>
            }
          >
            {filteredCandidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] px-4 py-6 text-sm text-[#4f6a62] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                No candidates match this filter set. Adjust university, role, or sort to continue exploring.
              </p>
            ) : (
              <div className="max-h-[52rem] min-h-0 space-y-3 overflow-y-auto pr-1 xl:h-full xl:max-h-none">
                {filteredCandidates.map((candidate) => {
                  const isSelected = selectedCandidate?.id === candidate.id;
                  const isInvited = invitedCandidateIds.includes(candidate.id);
                  const isFlagged = flaggedCandidateIds.includes(candidate.id);
                  const band = getAlignmentBand(candidate.alignmentScore);
                  const inviteMessage = getInviteMessage(candidate);

                  return (
                    <article
                      key={candidate.id}
                      className={`rounded-2xl border px-4 py-3 transition-colors ${
                        isSelected
                          ? 'border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10'
                          : 'border-[#d5e1db] bg-[#f9fdfb] dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      {/* Row 1: Name + band badge */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{getDisplayName(candidate)}</p>
                          <p className="mt-0.5 text-xs text-[#4c6860] dark:text-slate-400">
                            {candidate.targetRole} · {anonymizedPreview ? 'University hidden in preview' : candidate.university}
                          </p>
                        </div>
                        <Badge className={bandClassMap[band]}>{band}</Badge>
                      </div>

                      {/* Row 2: Gauge + top qualifying reason */}
                      <div className="mt-3 flex items-start gap-3">
                        <AlignmentGauge score={candidate.alignmentScore} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                            Top qualifying reason
                          </p>
                          <p className="mt-1 text-xs leading-[1.55] text-[#1f3d34] dark:text-slate-200">
                            {candidate.topQualifyingReason}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Editable invite message */}
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                          Recommended invite message
                        </p>
                        <textarea
                          value={inviteMessage}
                          onChange={(event) => {
                            setInviteMessageDraftByCandidateId((current) => ({
                              ...current,
                              [candidate.id]: event.target.value
                            }));
                          }}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[#d7e3dd] bg-white px-2.5 py-2 text-xs leading-[1.6] text-[#1a3d33] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        />
                      </div>

                      {/* Row 4: Actions */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => inviteCandidate(candidate, inviteMessage)}
                        >
                          {isInvited ? 'Re-send invite' : 'Send invite'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCandidateId(candidate.id)}
                        >
                          {isSelected ? 'Viewing details' : 'View details'}
                        </Button>
                        {isFlagged ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                            Reach-out flagged
                          </Badge>
                        ) : null}
                        {isInvited ? (
                          <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100">
                            Invited
                          </Badge>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card
              className="bg-white/95 dark:bg-slate-900/80"
              header={
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                    Candidate detail
                  </p>
                  {selectedCandidate ? (
                    <div className="mt-1 flex items-center gap-3">
                      <img
                        src={candidateAvatarSrc}
                        alt={anonymizedPreview ? 'Selected candidate profile avatar' : `${selectedCandidate.fullName} profile avatar`}
                        className="h-11 w-11 rounded-xl border border-[#cfe0d8] object-cover shadow-[0_8px_20px_-14px_rgba(10,31,26,0.75)] dark:border-slate-700"
                      />
                      <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">{getDisplayName(selectedCandidate)}</h3>
                    </div>
                  ) : (
                    <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">No candidate selected</h3>
                  )}
                </div>
              }
            >
              {selectedCandidate ? (
                <>
                  <div className="rounded-xl border border-[#cce0d5] bg-[#f3fbf7] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3f5f54] dark:text-slate-400">
                        End-of-cycle recommendation
                      </p>
                      <Badge className={bandClassMap[selectedCandidateBand ?? 'Ready']}>{selectedCandidateBand}</Badge>
                    </div>
                    <h4 className="mt-2 text-lg font-semibold text-[#12392f] dark:text-slate-100">
                      {selectedRecommendationProfile?.actionLabel}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#45635a] dark:text-slate-300">
                      {selectedRecommendationProfile?.summary}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {selectedRecommendationProfile?.outcomes.map((outcome) => (
                        <article
                          key={`${selectedCandidate.id}-${outcome.label}`}
                          className="rounded-lg border border-[#d5e3dc] bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <p className="text-[10px] uppercase tracking-[0.07em] text-[#58736a] dark:text-slate-400">{outcome.label}</p>
                          <p className="mt-1 text-sm font-semibold text-[#153d31] dark:text-slate-100">{outcome.value}</p>
                        </article>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#3f5b53] dark:text-slate-300">
                      <span className="font-semibold text-[#173f33] dark:text-slate-200">Next action:</span>{' '}
                      {selectedRecommendationProfile?.nextStep}
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3f5f54] dark:text-slate-400">
                        Supporting alignment signal
                      </p>
                      <p className="text-sm font-semibold text-[#15382f] dark:text-slate-100">Score {selectedCandidate.alignmentScore}</p>
                    </div>
                    <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-300">
                      {selectedCandidate.targetRole} ·{' '}
                      {anonymizedPreview ? 'Identity and university masked while preview mode is on.' : selectedCandidate.university}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCandidateMetadataTags.map((tag) => (
                        <Badge
                          key={`${selectedCandidate.id}-${tag}`}
                          className="bg-[#eaf7f2] text-[#1f4a3c] ring-1 ring-[#c4ddd1] dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {selectedCandidateQualitativeSignals ? (
                    <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3f5f54] dark:text-slate-400">
                        Beyond the resume
                      </p>
                      <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-300">
                        Structured qualitative signal layered on top of capability scoring.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[selectedCandidateQualitativeSignals.introVideo, selectedCandidateQualitativeSignals.projectDemoVideo].map((video) => (
                          <article
                            key={`${selectedCandidate.id}-${video.label}`}
                            className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <p className="text-sm font-semibold text-[#12392f] dark:text-slate-100">{video.label}</p>
                            <p className="mt-0.5 text-xs text-[#4a665e] dark:text-slate-300">Duration {video.duration}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="mt-2 w-full"
                              onClick={() => openVideoSignal(selectedCandidate, video)}
                            >
                              Open video
                            </Button>
                          </article>
                        ))}
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                          Reference contacts
                        </p>
                        {selectedCandidateQualitativeSignals.references.map((reference) => (
                          <article
                            key={`${selectedCandidate.id}-${reference.email}`}
                            className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <p className="text-sm font-semibold text-[#12392f] dark:text-slate-100">{reference.fullName}</p>
                            <p className="text-xs text-[#4a665e] dark:text-slate-300">
                              {reference.role} · {reference.organization}
                            </p>
                            <p className="mt-2 text-xs italic leading-5 text-[#36544b] dark:text-slate-300">
                              &quot;{reference.quote}&quot;
                            </p>
                            <p className="mt-2 text-xs text-[#4a665e] dark:text-slate-300">
                              {anonymizedPreview ? 'Reveal candidate identity to access contact info.' : `${reference.email} · ${reference.phone}`}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="mt-2 w-full"
                              disabled={anonymizedPreview}
                              onClick={() => {
                                void contactReference(selectedCandidate, reference);
                              }}
                            >
                              {anonymizedPreview ? 'Identity hidden' : 'Copy reference contact'}
                            </Button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Supporting capability detail
                    </p>
                    <div className="space-y-2">
                      {capabilityDimensions.map((dimension) => {
                        const score = selectedCandidate.capabilities[dimension.key];

                        return (
                          <div
                            key={`detail-${dimension.key}`}
                            className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#436059] dark:text-slate-300">
                              <span>{dimension.label}</span>
                              <span className="font-semibold text-[#123b30] dark:text-slate-100">{score}</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                              <div className="h-full rounded-full bg-[#12f987]" style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button type="button" className="mt-4 w-full" onClick={() => inviteCandidate(selectedCandidate)}>
                    {invitedCandidateIds.includes(selectedCandidate.id)
                      ? 'Invite sent — send again'
                      : 'Send invite to early conversation'}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[#4a655d] dark:text-slate-300">Choose a candidate from the list to view details and actions.</p>
              )}
            </Card>

            <Card
              className="bg-white/95 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Recruiter actions</h3>}
            >
              {selectedCandidate ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={toggleFlagCandidate}>
                      {flaggedCandidateIds.includes(selectedCandidate.id)
                        ? 'Remove early reach-out flag'
                        : 'Flag for early reach-out'}
                    </Button>
                    {calendarSentCandidateIds.includes(selectedCandidate.id) ? (
                      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100">Calendar sent</Badge>
                    ) : null}
                  </div>

                  <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Send calendar link
                    <div className="mt-2 flex gap-2">
                      <input
                        value={calendarLinkDraft}
                        onChange={(event) => {
                          if (!selectedCandidate) return;
                          setCalendarDraftByCandidateId((current) => ({
                            ...current,
                            [selectedCandidate.id]: event.target.value
                          }));
                        }}
                        className="h-10 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        placeholder="https://calendar.example.com/recruiter"
                      />
                      <Button type="button" size="sm" onClick={sendCalendarLink}>
                        Send
                      </Button>
                    </div>
                  </label>

                  <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Hiring team notes
                    <textarea
                      value={noteDraft}
                      onChange={(event) => {
                        if (!selectedCandidate) return;
                        setNoteDraftByCandidateId((current) => ({
                          ...current,
                          [selectedCandidate.id]: event.target.value
                        }));
                      }}
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Attach notes from interviewers, panel feedback, or competency concerns."
                    />
                  </label>

                  <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={saveHiringTeamNote}>
                    Save note
                  </Button>

                  <div className="mt-4 space-y-2 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Saved notes</p>
                    {(notesByCandidateId[selectedCandidate.id] ?? []).length === 0 ? (
                      <p className="text-xs text-[#4a655d] dark:text-slate-300">No notes attached yet.</p>
                    ) : (
                      (notesByCandidateId[selectedCandidate.id] ?? []).map((note, index) => (
                        <p key={`${selectedCandidate.id}-note-${index}`} className="text-xs leading-5 text-[#3f5b53] dark:text-slate-300">
                          {note}
                        </p>
                      ))
                    )}
                  </div>

                  {statusMessage ? (
                    <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {statusMessage}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[#4a655d] dark:text-slate-300">Select a candidate to enable recruiter action flows.</p>
              )}
            </Card>

            <Card
              className="bg-white/95 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Activity log</h3>}
            >
              {selectedCandidate ? (
                <div className="space-y-2">
                  {(activityByCandidateId[selectedCandidate.id] ?? []).length === 0 ? (
                    <p className="text-xs text-[#4a655d] dark:text-slate-300">No recruiter actions captured for this candidate yet.</p>
                  ) : (
                    (activityByCandidateId[selectedCandidate.id] ?? []).map((entry, index) => (
                      <p
                        key={`${selectedCandidate.id}-activity-${index}`}
                        className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-xs leading-5 text-[#3f5b53] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {entry}
                      </p>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#4a655d] dark:text-slate-300">Activity appears after a candidate is selected.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
