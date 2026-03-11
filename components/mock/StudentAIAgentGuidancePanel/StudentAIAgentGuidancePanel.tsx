import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type MessageRole = 'student' | 'agent';
type TraceStatus = 'queued' | 'running' | 'complete';

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
};

type AgentRecommendation = {
  id: string;
  title: string;
  expectedLift: number;
  effort: string;
  actionLabel: string;
  actionOutcome: string;
  rationale: string;
  evidence: string[];
};

type PlanTraceStep = {
  id: string;
  title: string;
  tool: string;
  status: TraceStatus;
  latencyMs: number;
  summary: string;
  rationale: string;
};

type AgentScenario = {
  reply: string;
  confidence: number;
  recommendations: AgentRecommendation[];
  traceSteps: PlanTraceStep[];
};

const quickPrompts = [
  'How do I boost my alignment score?',
  'Which artifact should I add this week?',
  'Should I opt in to share my signal with Company X?',
  'What should I put in my graduation timeline next?'
];

const statusBadgeClass: Record<TraceStatus, string> = {
  queued: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  running: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100'
};

const traceStatusLabel: Record<TraceStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete'
};

const makeMessageId = () => `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const timestamp = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

const boostScenario = (targetProfileLabel: string): AgentScenario => ({
  reply: `Your fastest lift for ${targetProfileLabel} is improving execution reliability evidence. I recommend one artifact action, one opportunity action, and one credibility action this week.`,
  confidence: 84,
  recommendations: [
    {
      id: 'boost-1',
      title: 'Upload a reliability-focused project artifact',
      expectedLift: 4,
      effort: '2-3 hours',
      actionLabel: 'Open artifact upload',
      actionOutcome: 'Added a reliability artifact task to your queue.',
      rationale: 'Execution reliability is below target for your selected role and employers.',
      evidence: ['Execution reliability signal is below target band', 'Company X emphasizes reliability above average']
    },
    {
      id: 'boost-2',
      title: 'Sign up for Company X annual hackathon',
      expectedLift: 3,
      effort: '1 hour signup + event',
      actionLabel: 'Add event to plan',
      actionOutcome: 'Hackathon registration and prep checklist added.',
      rationale: 'This event creates applied execution evidence tied to your target employers.',
      evidence: ['Event maps to applied execution + collaboration', 'Your current portfolio is light on team-delivery evidence']
    },
    {
      id: 'boost-3',
      title: 'Complete SQL Practitioner credential',
      expectedLift: 2,
      effort: '4 weeks',
      actionLabel: 'Schedule credential',
      actionOutcome: 'Credential milestone added to your graduation timeline.',
      rationale: 'This increases technical depth confidence and strengthens your baseline signal.',
      evidence: ['Technical depth still has room before target readiness', 'Credential provides verifiable external evidence']
    }
  ],
  traceSteps: [
    {
      id: 'boost-trace-1',
      title: 'Interpret query intent',
      tool: 'IntentRouter',
      status: 'complete',
      latencyMs: 108,
      summary: 'Classified request as alignment-improvement coaching.',
      rationale: 'Directly maps to a score-lift optimization flow.'
    },
    {
      id: 'boost-trace-2',
      title: 'Evaluate capability gaps',
      tool: 'CapabilityGapAnalyzer',
      status: 'complete',
      latencyMs: 322,
      summary: 'Ranked current dimensions by contribution to alignment gap.',
      rationale: 'Largest weighted gap appears in execution reliability.'
    },
    {
      id: 'boost-trace-3',
      title: 'Simulate action impact',
      tool: 'PathwayImpactSimulator',
      status: 'complete',
      latencyMs: 414,
      summary: 'Estimated likely alignment lift for candidate actions.',
      rationale: 'Prioritized actions with highest lift per effort unit.'
    },
    {
      id: 'boost-trace-4',
      title: 'Compose coach response',
      tool: 'ResponsePlanner',
      status: 'complete',
      latencyMs: 181,
      summary: 'Generated 3 actionable steps with rationale surface.',
      rationale: 'Returned transparent recommendations instead of opaque scoring advice.'
    }
  ]
});

const artifactScenario = (targetProfileLabel: string): AgentScenario => ({
  reply: `For ${targetProfileLabel}, add one technical artifact and one collaboration artifact this week. That pair usually gives the best signal-density improvement.`,
  confidence: 81,
  recommendations: [
    {
      id: 'artifact-1',
      title: 'Upload project postmortem document',
      expectedLift: 3,
      effort: '90 minutes',
      actionLabel: 'Add document task',
      actionOutcome: 'Postmortem artifact task added to this week plan.',
      rationale: 'Postmortems show execution reliability and systems thinking under constraints.',
      evidence: ['Current artifacts are heavy on outcomes but light on process', 'Reliability narrative is currently thin']
    },
    {
      id: 'artifact-2',
      title: 'Link GitHub repo with README quality notes',
      expectedLift: 2,
      effort: '60 minutes',
      actionLabel: 'Open GitHub checklist',
      actionOutcome: 'GitHub quality checklist added to artifact workflow.',
      rationale: 'Readable repos improve both technical depth and communication signal.',
      evidence: ['No recent repository evidence in current profile', 'Employer emphasis includes applied project depth']
    },
    {
      id: 'artifact-3',
      title: 'Upload club leadership evidence',
      expectedLift: 2,
      effort: '45 minutes',
      actionLabel: 'Add leadership entry',
      actionOutcome: 'Leadership artifact draft created.',
      rationale: 'Balanced evidence improves confidence in collaboration and delivery reliability.',
      evidence: ['Collaboration signal confidence is lower than technical confidence', 'Balanced signal mix improves ranking stability']
    }
  ],
  traceSteps: [
    {
      id: 'artifact-trace-1',
      title: 'Interpret query intent',
      tool: 'IntentRouter',
      status: 'complete',
      latencyMs: 96,
      summary: 'Classified request as artifact-prioritization guidance.',
      rationale: 'Requested artifact-level direction, not broad pathway planning.'
    },
    {
      id: 'artifact-trace-2',
      title: 'Assess evidence coverage',
      tool: 'EvidenceCoverageScanner',
      status: 'complete',
      latencyMs: 344,
      summary: 'Measured signal depth across technical, collaboration, reliability.',
      rationale: 'Detected strongest opportunity in reliability documentation.'
    },
    {
      id: 'artifact-trace-3',
      title: 'Rank upload options',
      tool: 'SignalLiftRanker',
      status: 'complete',
      latencyMs: 280,
      summary: 'Ranked artifacts by expected lift and effort.',
      rationale: 'Selected mixed evidence recommendations to avoid one-dimensional profile growth.'
    }
  ]
});

const optInScenario = (targetProfileLabel: string): AgentScenario => ({
  reply: `You can opt in now for ${targetProfileLabel}. Your signal is already competitive, and sharing now improves your chance of early conversations while you continue improving.`,
  confidence: 79,
  recommendations: [
    {
      id: 'optin-1',
      title: 'Opt in to share readiness with Company X',
      expectedLift: 1,
      effort: '5 minutes',
      actionLabel: 'Enable signal sharing',
      actionOutcome: 'Signal sharing toggled on for Company X.',
      rationale: 'You are within competitive range; visibility is the bottleneck.',
      evidence: ['Alignment band is currently competitive or stronger', 'Company X has early-conversation pathways enabled']
    },
    {
      id: 'optin-2',
      title: 'Attach one fresh execution artifact before outreach',
      expectedLift: 2,
      effort: '1-2 hours',
      actionLabel: 'Prepare supporting evidence',
      actionOutcome: 'Pre-outreach artifact reminder added.',
      rationale: 'Fresh evidence increases recruiter confidence at point of view.',
      evidence: ['Recent artifact freshness is below preferred recency window', 'Execution reliability remains a weighted dimension']
    },
    {
      id: 'optin-3',
      title: 'Set availability window for early calls',
      expectedLift: 1,
      effort: '10 minutes',
      actionLabel: 'Set availability',
      actionOutcome: 'Availability block saved in outreach preferences.',
      rationale: 'Fast response windows increase probability of first-touch conversion.',
      evidence: ['Early conversation response time influences pipeline progression']
    }
  ],
  traceSteps: [
    {
      id: 'optin-trace-1',
      title: 'Interpret query intent',
      tool: 'IntentRouter',
      status: 'complete',
      latencyMs: 102,
      summary: 'Classified request as opt-in timing decision.',
      rationale: 'Question explicitly asks whether to share signal now.'
    },
    {
      id: 'optin-trace-2',
      title: 'Evaluate readiness + visibility',
      tool: 'ReadinessVisibilityEvaluator',
      status: 'complete',
      latencyMs: 358,
      summary: 'Compared current alignment band against opt-in threshold policy.',
      rationale: 'Current score supports opt-in with recommended evidence reinforcement.'
    },
    {
      id: 'optin-trace-3',
      title: 'Compose decision guidance',
      tool: 'DecisionNarrator',
      status: 'complete',
      latencyMs: 149,
      summary: 'Returned yes/now recommendation with risk controls.',
      rationale: 'Balanced immediate visibility with supporting evidence action.'
    }
  ]
});

const timelineScenario = (targetProfileLabel: string): AgentScenario => ({
  reply: `For your graduation timeline toward ${targetProfileLabel}, front-load one foundation course now, then sequence one project and one credential before your final year.`,
  confidence: 82,
  recommendations: [
    {
      id: 'timeline-1',
      title: 'Move pipeline project into your next academic year',
      expectedLift: 4,
      effort: 'Schedule update + project sprint',
      actionLabel: 'Update graduation timeline',
      actionOutcome: 'Pipeline project milestone moved to next year lane.',
      rationale: 'Project evidence early gives more time for iteration and validation.',
      evidence: ['Earlier project placement improves downstream portfolio quality', 'Role target rewards applied execution trajectory']
    },
    {
      id: 'timeline-2',
      title: 'Add one certification before internship cycle',
      expectedLift: 2,
      effort: '4 weeks',
      actionLabel: 'Add certification milestone',
      actionOutcome: 'Certification milestone inserted before internship period.',
      rationale: 'Credential timing increases readiness at internship application windows.',
      evidence: ['Certification is currently missing from planned path', 'Internship recruiters often filter for baseline verification']
    },
    {
      id: 'timeline-3',
      title: 'Schedule one team event each year',
      expectedLift: 2,
      effort: 'Quarterly',
      actionLabel: 'Add yearly team milestones',
      actionOutcome: 'Yearly collaboration milestones added to planner.',
      rationale: 'Consistent collaboration evidence stabilizes signal over time.',
      evidence: ['Current timeline under-represents collaboration artifacts', 'Employers value longitudinal delivery behavior']
    }
  ],
  traceSteps: [
    {
      id: 'timeline-trace-1',
      title: 'Interpret query intent',
      tool: 'IntentRouter',
      status: 'complete',
      latencyMs: 109,
      summary: 'Classified request as timeline sequencing advice.',
      rationale: 'Question asks for path planning order.'
    },
    {
      id: 'timeline-trace-2',
      title: 'Simulate graduation path',
      tool: 'TimelineImpactSimulator',
      status: 'complete',
      latencyMs: 390,
      summary: 'Modeled sequencing outcomes from current year to graduation.',
      rationale: 'Estimated sequence with best combined readiness and recency effects.'
    },
    {
      id: 'timeline-trace-3',
      title: 'Generate milestone actions',
      tool: 'MilestoneActionPlanner',
      status: 'complete',
      latencyMs: 203,
      summary: 'Returned timeline actions with lift + rationale surfaces.',
      rationale: 'Provided directly schedulable milestones, not generic advice.'
    }
  ]
});

const createScenario = (query: string, targetProfileLabel: string): AgentScenario => {
  const normalized = query.toLowerCase();

  if (normalized.includes('opt in') || normalized.includes('share') || normalized.includes('company')) {
    return optInScenario(targetProfileLabel);
  }

  if (normalized.includes('artifact') || normalized.includes('evidence') || normalized.includes('github') || normalized.includes('portfolio')) {
    return artifactScenario(targetProfileLabel);
  }

  if (normalized.includes('timeline') || normalized.includes('year') || normalized.includes('schedule') || normalized.includes('graduation')) {
    return timelineScenario(targetProfileLabel);
  }

  return boostScenario(targetProfileLabel);
};

export interface StudentAIAgentGuidancePanelProps {
  targetProfileLabel?: string;
  defaultPrompt?: string;
}

export const StudentAIAgentGuidancePanel = ({
  targetProfileLabel = 'Entry-Level Data Engineer',
  defaultPrompt = 'How do I boost my alignment score?'
}: StudentAIAgentGuidancePanelProps) => {
  const initialScenario = useMemo(() => createScenario(defaultPrompt, targetProfileLabel), [defaultPrompt, targetProfileLabel]);
  const [activeScenario, setActiveScenario] = useState<AgentScenario>(initialScenario);
  const [query, setQuery] = useState('');
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<string[]>([]);
  const [expandedRecommendationIds, setExpandedRecommendationIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Ask a question to get a plan trace with recommended actions.');

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: makeMessageId(),
      role: 'agent',
      content: `I am your coaching agent for ${targetProfileLabel}. Ask for score lift strategies, artifact priorities, or timeline sequencing.`,
      timestamp: timestamp()
    },
    {
      id: makeMessageId(),
      role: 'student',
      content: defaultPrompt,
      timestamp: timestamp()
    },
    {
      id: makeMessageId(),
      role: 'agent',
      content: initialScenario.reply,
      timestamp: timestamp()
    }
  ]);

  const runQuery = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) return;

    const nextScenario = createScenario(trimmed, targetProfileLabel);
    const studentMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'student',
      content: trimmed,
      timestamp: timestamp()
    };

    const agentMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'agent',
      content: nextScenario.reply,
      timestamp: timestamp()
    };

    setMessages((current) => [...current, studentMessage, agentMessage]);
    setActiveScenario(nextScenario);
    setAcceptedRecommendationIds([]);
    setExpandedRecommendationIds([]);
    setQuery('');
    setStatusMessage(`Returned ${nextScenario.recommendations.length} actions with ${nextScenario.confidence}% confidence.`);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runQuery(query);
  };

  const applyRecommendation = (recommendation: AgentRecommendation) => {
    setAcceptedRecommendationIds((current) => {
      if (current.includes(recommendation.id)) return current;
      return [...current, recommendation.id];
    });
    setStatusMessage(recommendation.actionOutcome);
  };

  const toggleRationale = (recommendationId: string) => {
    setExpandedRecommendationIds((current) => {
      if (current.includes(recommendationId)) {
        return current.filter((id) => id !== recommendationId);
      }
      return [...current, recommendationId];
    });
  };

  return (
    <section aria-labelledby="student-ai-guidance-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">AI agent guidance panel</p>
            <h2
              id="student-ai-guidance-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Chat coaching with visible plan trace
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Ask questions like “How do I boost my alignment score?” and get actionable recommendations plus rationale
              surfaces showing how the agent formed each suggestion.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Mastra-style chat + trace
          </Badge>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80 xl:h-full xl:flex xl:flex-col xl:[&>div:last-child]:min-h-0 xl:[&>div:last-child]:flex-1 xl:[&>div:last-child]:overflow-hidden"
            header={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Agent chat</h3>
                <Badge className="bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100">
                  Confidence {activeScenario.confidence}%
                </Badge>
              </div>
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => runQuery(prompt)}
                    className="rounded-full border border-[#c4d5ce] bg-white px-3 py-1 text-xs font-semibold text-[#365148] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[92%] rounded-2xl border px-3 py-2 ${
                      message.role === 'student'
                        ? 'ml-auto border-[#bde5cd] bg-[#ebfff4] text-[#0d382d] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : 'mr-auto border-[#d4e1db] bg-white text-[#14382f] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{message.role === 'student' ? 'You' : 'Agent'}</p>
                    <p className="mt-1 text-sm leading-6">{message.content}</p>
                    <p className="mt-1 text-[10px] opacity-70">{message.timestamp}</p>
                  </article>
                ))}
              </div>

              <form className="mt-3 flex items-start gap-2" onSubmit={handleSubmit}>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask the agent how to improve your readiness signal..."
                  className="min-h-20 flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button type="submit" className="shrink-0">
                  Ask agent
                </Button>
              </form>

              <p className="mt-3 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {statusMessage}
              </p>
            </div>
          </Card>

          <div className="space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Actionable suggestions</h3>}
            >
              <div className="space-y-3">
                {activeScenario.recommendations.map((recommendation) => {
                  const isAccepted = acceptedRecommendationIds.includes(recommendation.id);
                  const rationaleOpen = expandedRecommendationIds.includes(recommendation.id);

                  return (
                    <article
                      key={recommendation.id}
                      className="rounded-2xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{recommendation.title}</p>
                        <Badge className="bg-[#dcfff0] text-[#0a402d] dark:bg-emerald-500/20 dark:text-emerald-100">
                          +{recommendation.expectedLift}%
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">Estimated effort: {recommendation.effort}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={isAccepted ? 'secondary' : 'primary'} onClick={() => applyRecommendation(recommendation)}>
                          {isAccepted ? 'Added' : recommendation.actionLabel}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => toggleRationale(recommendation.id)}>
                          {rationaleOpen ? 'Hide why' : 'Show why'}
                        </Button>
                      </div>
                      {rationaleOpen ? (
                        <div className="mt-2 rounded-xl border border-[#cfe0d9] bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                          <p className="text-xs font-semibold text-[#355149] dark:text-slate-200">Rationale</p>
                          <p className="mt-1 text-xs leading-5 text-[#4c6860] dark:text-slate-300">{recommendation.rationale}</p>
                          <p className="mt-2 text-xs font-semibold text-[#355149] dark:text-slate-200">Evidence</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#4c6860] dark:text-slate-300">
                            {recommendation.evidence.map((item) => (
                              <li key={`${recommendation.id}-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Plan trace</h3>}
            >
              <div className="space-y-2">
                {activeScenario.traceSteps.map((step) => (
                  <article
                    key={step.id}
                    className="rounded-2xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{step.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100">{step.tool}</Badge>
                        <Badge className={statusBadgeClass[step.status]}>{traceStatusLabel[step.status]}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">{step.summary}</p>
                    <p className="mt-1 text-[11px] text-[#54736a] dark:text-slate-400">Why: {step.rationale}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#355149] dark:text-slate-300">Latency: {step.latencyMs}ms</p>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
