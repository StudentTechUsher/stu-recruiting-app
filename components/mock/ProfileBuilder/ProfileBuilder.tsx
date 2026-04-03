import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type BuilderMode = 'guided' | 'advanced';
type AgentIntent = 'draft' | 'rebalance' | 'explain';

type CapabilityDimension = {
  id: string;
  title: string;
  description: string;
  baselineWeight: number;
};

type AgentDraft = {
  title: string;
  rationale: string;
  selectedDimensionIds: string[];
  weights: Record<string, number>;
  notes: string;
  cohorts: string[];
};

const capabilityDimensions: CapabilityDimension[] = [
  {
    id: 'problem_solving',
    title: 'Problem solving',
    description: 'Break ambiguous problems into structured decision paths.',
    baselineWeight: 78
  },
  {
    id: 'data_communication',
    title: 'Data communication',
    description: 'Translate analysis into clear recommendations for stakeholders.',
    baselineWeight: 72
  },
  {
    id: 'execution',
    title: 'Execution reliability',
    description: 'Deliver scoped work consistently with low oversight.',
    baselineWeight: 69
  },
  {
    id: 'collaboration',
    title: 'Cross-functional collaboration',
    description: 'Operate effectively with product, engineering, and business teams.',
    baselineWeight: 61
  },
  {
    id: 'business_judgment',
    title: 'Business judgment',
    description: 'Prioritize work based on measurable customer and business impact.',
    baselineWeight: 64
  },
  {
    id: 'tooling_fluency',
    title: 'Tooling fluency',
    description: 'Use analytics and workflow tooling with minimal onboarding friction.',
    baselineWeight: 56
  }
];

const cohortOptions = [
  'Northeastern Product Analyst Cohort',
  'Georgia Tech Data Pathway',
  'Arizona State Consulting Track',
  'Michigan Advanced Analytics Track'
] as const;

const evidenceSignalOptions = [
  'Course performance artifacts',
  'Applied project outcomes',
  'Internship manager feedback',
  'Presentation or communication samples',
  'Team collaboration evidence',
  'Capstone or research publication'
] as const;

const starterSelectedDimensions = ['problem_solving', 'data_communication', 'execution'];

const createWeightMap = () => {
  return capabilityDimensions.reduce<Record<string, number>>((accumulator, dimension) => {
    accumulator[dimension.id] = dimension.baselineWeight;
    return accumulator;
  }, {});
};

const starterThresholds = {
  emergingMax: 54,
  developingMax: 69,
  readyMax: 84
};

const thresholdTooltipCopy: Record<keyof typeof starterThresholds, string> = {
  emergingMax:
    'Highest score still labeled Emerging. Students at this value or below are flagged for foundational support.',
  developingMax:
    'Highest score still labeled Developing. Scores above Emerging max and up to this cutoff stay in growth track.',
  readyMax: 'Highest score still labeled Ready. Scores above this threshold are classified as Standout.'
};

const applyProfileLabel = (base: string) => {
  if (base.toLowerCase().includes('consult')) return 'consulting';
  if (base.toLowerCase().includes('product')) return 'product';
  return 'analytics';
};

const buildAgentDraft = (profileName: string, intent: AgentIntent): AgentDraft => {
  const profileLabel = applyProfileLabel(profileName);

  const analyticsDraft: AgentDraft = {
    title: 'Analytics-first capability model',
    rationale:
      'Prioritizes structured problem solving, communication, and delivery reliability because these correlate with early interview conversion in analytical roles.',
    selectedDimensionIds: ['problem_solving', 'data_communication', 'execution', 'business_judgment'],
    weights: {
      problem_solving: 88,
      data_communication: 82,
      execution: 79,
      business_judgment: 73,
      collaboration: 58,
      tooling_fluency: 62
    },
    notes:
      'Evidence should include structured analysis artifacts, decision memos, and delivered projects with measurable outcomes.',
    cohorts: [cohortOptions[0], cohortOptions[1]]
  };

  const consultingDraft: AgentDraft = {
    title: 'Consulting readiness model',
    rationale:
      'Weights communication, business judgment, and problem decomposition to match consulting interview and client-team expectations.',
    selectedDimensionIds: ['problem_solving', 'data_communication', 'business_judgment', 'collaboration'],
    weights: {
      problem_solving: 84,
      data_communication: 86,
      execution: 66,
      business_judgment: 82,
      collaboration: 76,
      tooling_fluency: 48
    },
    notes:
      'Assess clarity of recommendations, client-facing communication, and case-style reasoning under ambiguity.',
    cohorts: [cohortOptions[2], cohortOptions[3]]
  };

  const productDraft: AgentDraft = {
    title: 'Product analytics model',
    rationale:
      'Balances execution and collaboration with strong communication to support cross-functional product decision making.',
    selectedDimensionIds: ['problem_solving', 'data_communication', 'execution', 'collaboration', 'business_judgment'],
    weights: {
      problem_solving: 80,
      data_communication: 81,
      execution: 78,
      business_judgment: 71,
      collaboration: 76,
      tooling_fluency: 60
    },
    notes: 'Require evidence of prioritization tradeoffs, written synthesis, and iteration velocity across real product constraints.',
    cohorts: [cohortOptions[0], cohortOptions[3]]
  };

  const baseDraft = profileLabel === 'consulting' ? consultingDraft : profileLabel === 'product' ? productDraft : analyticsDraft;

  if (intent === 'rebalance') {
    return {
      ...baseDraft,
      title: `${baseDraft.title} (rebalanced)`
    };
  }

  if (intent === 'explain') {
    return {
      ...baseDraft,
      title: `${baseDraft.title} (explain mode)`
    };
  }

  return baseDraft;
};

const createAgentMessage = (intent: AgentIntent, draft: AgentDraft) => {
  if (intent === 'draft') {
    return `Draft complete: ${draft.title}. I selected ${draft.selectedDimensionIds.length} dimensions and calibrated priorities for faster first-pass deployment.`;
  }

  if (intent === 'rebalance') {
    return `I rebalanced priorities to reduce over-weighting and improve cross-dimension coverage. Ready to apply this ${draft.title.toLowerCase()}.`;
  }

  return `Model explanation: ${draft.rationale}`;
};

export interface ProfileBuilderProps {
  defaultMode?: BuilderMode;
  defaultAgentOpen?: boolean;
}

export const ProfileBuilder = ({ defaultMode = 'guided', defaultAgentOpen = false }: ProfileBuilderProps) => {
  const [builderMode, setBuilderMode] = useState<BuilderMode>(defaultMode);
  const [agentPanelOpen, setAgentPanelOpen] = useState(defaultAgentOpen);
  const [profileName, setProfileName] = useState('Early-Career Data Analyst Profile');
  const [selectedDimensionIds, setSelectedDimensionIds] = useState<string[]>(starterSelectedDimensions);
  const [dimensionWeights, setDimensionWeights] = useState<Record<string, number>>(createWeightMap);
  const [rubricFileName, setRubricFileName] = useState<string | null>(null);
  const [rubricNotes, setRubricNotes] = useState(
    'Candidates should demonstrate evidence of structured analysis, stakeholder communication, and iterative delivery.'
  );
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([cohortOptions[0]]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [thresholds, setThresholds] = useState(starterThresholds);
  const [requiredEvidence, setRequiredEvidence] = useState<string[]>([evidenceSignalOptions[0], evidenceSignalOptions[1]]);
  const [minimumEvidenceCount, setMinimumEvidenceCount] = useState(2);
  const [strictValidation, setStrictValidation] = useState(true);
  const [versionLabel, setVersionLabel] = useState('v1.0.0');
  const [releaseNotes, setReleaseNotes] = useState('Initial profile calibrated for Fall recruiting cohort.');

  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null);
  const [agentMessages, setAgentMessages] = useState<string[]>([
    'I can generate a first draft capability model from your role context and rubric. Choose an action below.'
  ]);

  const rubricInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDimensions = useMemo(
    () => capabilityDimensions.filter((dimension) => selectedDimensionIds.includes(dimension.id)),
    [selectedDimensionIds]
  );

  const priorityTotal = useMemo(() => {
    return selectedDimensions.reduce((sum, dimension) => sum + (dimensionWeights[dimension.id] ?? 0), 0);
  }, [dimensionWeights, selectedDimensions]);

  const normalizedPriorities = useMemo(() => {
    if (priorityTotal === 0) return [];

    return selectedDimensions
      .map((dimension) => {
        const normalized = ((dimensionWeights[dimension.id] ?? 0) / priorityTotal) * 100;
        return {
          id: dimension.id,
          title: dimension.title,
          normalized: Number(normalized.toFixed(1)),
          weight: dimensionWeights[dimension.id] ?? 0
        };
      })
      .sort((first, second) => second.normalized - first.normalized);
  }, [dimensionWeights, priorityTotal, selectedDimensions]);

  const dimensionCompletion = Math.min(selectedDimensions.length / 4, 1);
  const priorityCompletion = selectedDimensions.length > 0 ? 1 : 0;
  const rubricCompletion = rubricFileName || rubricNotes.trim().length > 0 ? 1 : 0;
  const cohortCompletion = selectedCohorts.length > 0 ? 1 : 0;
  const advancedCompletion =
    requiredEvidence.length > 0 && minimumEvidenceCount > 0 && thresholds.emergingMax < thresholds.developingMax
      ? 1
      : 0;

  const readinessScore = Math.round(
    ((dimensionCompletion + priorityCompletion + rubricCompletion + cohortCompletion + advancedCompletion) / 5) * 100
  );

  const readinessLabel = readinessScore >= 80 ? 'Ready to share' : readinessScore >= 55 ? 'In progress' : 'Draft';

  const exportPayload = useMemo(
    () => ({
      profileName,
      mode: builderMode,
      generatedAt: 'Generated on export action',
      dimensions: normalizedPriorities.map((priority, index) => ({
        rank: index + 1,
        dimension: priority.title,
        normalizedPriority: priority.normalized
      })),
      rubric: {
        fileName: rubricFileName,
        notes: rubricNotes
      },
      cohorts: selectedCohorts,
      advancedConfiguration: {
        thresholds,
        requiredEvidence,
        minimumEvidenceCount,
        strictValidation,
        versionLabel,
        releaseNotes
      }
    }),
    [
      builderMode,
      minimumEvidenceCount,
      normalizedPriorities,
      profileName,
      releaseNotes,
      requiredEvidence,
      rubricFileName,
      rubricNotes,
      selectedCohorts,
      strictValidation,
      thresholds,
      versionLabel
    ]
  );

  const toggleDimension = (id: string) => {
    setSelectedDimensionIds((current) => {
      if (current.includes(id)) {
        return current.filter((currentId) => currentId !== id);
      }
      return [...current, id];
    });
  };

  const updateWeight = (id: string, value: number) => {
    setDimensionWeights((current) => ({
      ...current,
      [id]: value
    }));
  };

  const toggleCohort = (cohort: string) => {
    setSelectedCohorts((current) => {
      if (current.includes(cohort)) {
        return current.filter((item) => item !== cohort);
      }
      return [...current, cohort];
    });
  };

  const toggleEvidence = (evidence: string) => {
    setRequiredEvidence((current) => {
      if (current.includes(evidence)) {
        return current.filter((item) => item !== evidence);
      }
      return [...current, evidence];
    });
  };

  const updateThreshold = (key: keyof typeof starterThresholds, value: number) => {
    setThresholds((current) => {
      if (key === 'emergingMax') {
        const emergingMax = Math.min(value, current.developingMax - 1);
        return { ...current, emergingMax };
      }

      if (key === 'developingMax') {
        const developingMax = Math.min(Math.max(value, current.emergingMax + 1), current.readyMax - 1);
        return { ...current, developingMax };
      }

      const readyMax = Math.max(value, current.developingMax + 1);
      return { ...current, readyMax };
    });
  };

  const uploadRubric = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRubricFileName(file.name);
    setStatusMessage(`Rubric uploaded: ${file.name}`);
  };

  const exportProfile = () => {
    const payload = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profileName.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Capability profile exported as JSON.');
  };

  const shareProfile = () => {
    if (selectedCohorts.length === 0) {
      setStatusMessage('Select at least one cohort before sharing.');
      return;
    }
    setStatusMessage(`Profile shared with ${selectedCohorts.length} cohort${selectedCohorts.length > 1 ? 's' : ''}.`);
  };

  const runAgent = (intent: AgentIntent) => {
    const draft = buildAgentDraft(profileName, intent);
    setAgentDraft(draft);
    setAgentMessages((current) => [...current.slice(-2), createAgentMessage(intent, draft)]);

    if (!agentPanelOpen) {
      setAgentPanelOpen(true);
    }
  };

  const applyAgentDraft = () => {
    if (!agentDraft) return;

    setSelectedDimensionIds(agentDraft.selectedDimensionIds);
    setDimensionWeights((current) => ({ ...current, ...agentDraft.weights }));
    setRubricNotes(agentDraft.notes);
    setSelectedCohorts(agentDraft.cohorts);
    setStatusMessage(`Applied AI draft: ${agentDraft.title}.`);
  };

  const saveAdvancedDraft = () => {
    setStatusMessage(`Saved ${versionLabel} as draft configuration.`);
  };

  const publishAdvancedProfile = () => {
    if (selectedCohorts.length === 0) {
      setStatusMessage('Add at least one cohort before publishing.');
      return;
    }
    setStatusMessage(`Published ${versionLabel} profile to ${selectedCohorts.length} cohort${selectedCohorts.length > 1 ? 's' : ''}.`);
  };

  return (
    <section aria-labelledby="profile-builder-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">
              Profile Builder
            </p>
            <h2
              id="profile-builder-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Define capability models
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Translate hiring standards into a reusable capability profile, weight what matters most, then publish to
              candidate cohorts so readiness pathways align before applications open.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Employer-defined standards
          </Badge>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBuilderMode('guided')}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              builderMode === 'guided'
                ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                : 'border-[#c4d5ce] bg-white text-[#2f4d44] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Guided mode
          </button>
          <button
            type="button"
            onClick={() => setBuilderMode('advanced')}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              builderMode === 'advanced'
                ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                : 'border-[#c4d5ce] bg-white text-[#2f4d44] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Advanced configuration
          </button>
          <button
            type="button"
            onClick={() => setAgentPanelOpen((current) => !current)}
            className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm font-semibold text-[#1d4d3c] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {agentPanelOpen ? 'Hide AI agent' : 'Start with AI agent'}
          </button>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[40%_60%]">
          <div className="min-w-0 space-y-4">
            {builderMode === 'guided' ? (
              <>
                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">1. Select competency dimensions</h3>
                      <span className="text-xs font-semibold text-[#4f6a62] dark:text-slate-400">
                        {selectedDimensions.length} selected
                      </span>
                    </div>
                  }
                >
                  <div className="grid gap-2">
                    {capabilityDimensions.map((dimension) => {
                      const isSelected = selectedDimensionIds.includes(dimension.id);

                      return (
                        <button
                          key={dimension.id}
                          type="button"
                          onClick={() => toggleDimension(dimension.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? 'border-[#0fd978] bg-[#e9fef3] dark:border-emerald-500 dark:bg-emerald-500/10'
                              : 'border-[#d3e0da] bg-white hover:bg-[#f4faf7] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{dimension.title}</p>
                          <p className="mt-1 text-xs leading-5 text-[#47635a] dark:text-slate-300">{dimension.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">2. Set relative priorities</h3>}
                >
                  {selectedDimensions.length === 0 ? (
                    <p className="text-sm text-[#4a655d] dark:text-slate-300">Select at least one dimension to set priorities.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDimensions.map((dimension) => {
                        const normalized = normalizedPriorities.find((item) => item.id === dimension.id)?.normalized ?? 0;

                        return (
                          <div
                            key={`priority-${dimension.id}`}
                            className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-[#11352b] dark:text-slate-100">{dimension.title}</p>
                              <span className="text-xs font-semibold text-[#436059] dark:text-slate-300">{normalized}%</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={100}
                              step={2}
                              value={dimensionWeights[dimension.id]}
                              onChange={(event) => updateWeight(dimension.id, Number(event.target.value))}
                              className="w-full accent-[#12f987]"
                              aria-label={`Set priority for ${dimension.title}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">3. Upload hiring rubric</h3>}
                >
                  <input
                    ref={rubricInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={uploadRubric}
                    className="hidden"
                  />
                  <div className="rounded-xl border border-dashed border-[#c5d7cf] bg-[#f7fcf9] p-4 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-[#163b30] dark:text-slate-100">
                      {rubricFileName ? `Uploaded: ${rubricFileName}` : 'No rubric uploaded yet'}
                    </p>
                    <p className="mt-1 text-xs text-[#48635b] dark:text-slate-300">
                      Attach an internal rubric so stu. can map your standards to cohort pathways.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => rubricInputRef.current?.click()}
                    >
                      Upload rubric file
                    </Button>
                  </div>
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Notes
                    <textarea
                      value={rubricNotes}
                      onChange={(event) => setRubricNotes(event.target.value)}
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">4. Share with candidate cohorts</h3>}
                >
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Profile name
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>

                  <div className="space-y-2">
                    {cohortOptions.map((cohort) => {
                      const isSelected = selectedCohorts.includes(cohort);
                      return (
                        <label
                          key={cohort}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <span className="text-sm font-medium text-[#1f3f35] dark:text-slate-200">{cohort}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCohort(cohort)}
                            className="h-4 w-4 accent-[#12f987]"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={exportProfile}>
                      Export profile JSON
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={shareProfile}>
                      Share with cohorts
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">1. Dimension matrix</h3>}
                >
                  <p className="mb-3 text-sm text-[#48635b] dark:text-slate-300">
                    Fine-tune raw weights directly for each selected dimension.
                  </p>
                  {selectedDimensions.length === 0 ? (
                    <p className="text-sm text-[#4a655d] dark:text-slate-300">Select dimensions in guided mode first, then return here.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDimensions.map((dimension) => (
                        <div
                          key={`matrix-${dimension.id}`}
                          className="flex items-center justify-between rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <p className="text-sm font-semibold text-[#123b30] dark:text-slate-100">{dimension.title}</p>
                          <input
                            type="number"
                            min={20}
                            max={100}
                            value={dimensionWeights[dimension.id]}
                            onChange={(event) => updateWeight(dimension.id, Number(event.target.value))}
                            className="h-9 w-20 rounded-lg border border-[#bfd2ca] bg-white px-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            aria-label={`Set weight for ${dimension.title}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">2. Band thresholds</h3>}
                >
                  <div className="space-y-3">
                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-[#133a30] dark:text-slate-100">
                        <span className="inline-flex items-center gap-1.5">
                          <span>Emerging max</span>
                          <span className="group relative">
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c4d5ce] text-[10px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                              aria-label="Explain Emerging max threshold"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-6 z-20 w-[min(16rem,calc(100vw-3rem))] rounded-lg border border-[#d2dfd9] bg-white p-2.5 text-[11px] normal-case font-medium leading-4 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {thresholdTooltipCopy.emergingMax}
                            </span>
                          </span>
                        </span>
                        <span>{thresholds.emergingMax}</span>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={65}
                        value={thresholds.emergingMax}
                        onChange={(event) => updateThreshold('emergingMax', Number(event.target.value))}
                        className="w-full accent-[#12f987]"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-[#133a30] dark:text-slate-100">
                        <span className="inline-flex items-center gap-1.5">
                          <span>Developing max</span>
                          <span className="group relative">
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c4d5ce] text-[10px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                              aria-label="Explain Developing max threshold"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-6 z-20 w-[min(16rem,calc(100vw-3rem))] rounded-lg border border-[#d2dfd9] bg-white p-2.5 text-[11px] normal-case font-medium leading-4 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {thresholdTooltipCopy.developingMax}
                            </span>
                          </span>
                        </span>
                        <span>{thresholds.developingMax}</span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={80}
                        value={thresholds.developingMax}
                        onChange={(event) => updateThreshold('developingMax', Number(event.target.value))}
                        className="w-full accent-[#12f987]"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-[#133a30] dark:text-slate-100">
                        <span className="inline-flex items-center gap-1.5">
                          <span>Ready max</span>
                          <span className="group relative">
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c4d5ce] text-[10px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                              aria-label="Explain Ready max threshold"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-6 z-20 w-[min(16rem,calc(100vw-3rem))] rounded-lg border border-[#d2dfd9] bg-white p-2.5 text-[11px] normal-case font-medium leading-4 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {thresholdTooltipCopy.readyMax}
                            </span>
                          </span>
                        </span>
                        <span>{thresholds.readyMax}</span>
                      </div>
                      <input
                        type="range"
                        min={70}
                        max={92}
                        value={thresholds.readyMax}
                        onChange={(event) => updateThreshold('readyMax', Number(event.target.value))}
                        className="w-full accent-[#12f987]"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                      Emerging: 0-{thresholds.emergingMax}
                    </div>
                    <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                      Developing: {thresholds.emergingMax + 1}-{thresholds.developingMax}
                    </div>
                    <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                      Ready: {thresholds.developingMax + 1}-{thresholds.readyMax}
                    </div>
                    <div className="rounded-lg border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                      Standout: {thresholds.readyMax + 1}-100
                    </div>
                  </div>
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">3. Evidence requirements</h3>
                      <div className="group relative">
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c4d5ce] text-[11px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                          aria-label="How to set evidence requirements"
                        >
                          i
                        </button>
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute left-0 top-7 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-[#d2dfd9] bg-white p-3 text-xs leading-5 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:left-auto sm:right-0 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                        >
                          Select the evidence types you trust for evaluation, then set the minimum count required per
                          candidate. Enable strict validation when missing signals should block a Ready or Standout
                          classification.
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {evidenceSignalOptions.map((signal) => {
                      const isRequired = requiredEvidence.includes(signal);

                      return (
                        <label
                          key={signal}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <span className="text-sm text-[#1f3f35] dark:text-slate-200">{signal}</span>
                          <input
                            type="checkbox"
                            checked={isRequired}
                            onChange={() => toggleEvidence(signal)}
                            className="h-4 w-4 accent-[#12f987]"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-[#d4e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Minimum evidence signals
                      <input
                        type="range"
                        min={1}
                        max={4}
                        value={minimumEvidenceCount}
                        onChange={(event) => setMinimumEvidenceCount(Number(event.target.value))}
                        className="mt-2 w-full accent-[#12f987]"
                      />
                    </label>
                    <p className="mt-1 text-sm text-[#3f5b53] dark:text-slate-300">{minimumEvidenceCount} required signals per candidate.</p>
                    <label className="mt-3 flex items-center justify-between rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-sm font-medium text-[#1f3f35] dark:text-slate-200">Strict validation</span>
                      <input
                        type="checkbox"
                        checked={strictValidation}
                        onChange={(event) => setStrictValidation(event.target.checked)}
                        className="h-4 w-4 accent-[#12f987]"
                      />
                    </label>
                  </div>
                </Card>

                <Card
                  className="bg-white/95 p-5 dark:bg-slate-900/80"
                  header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">4. Versioning & release</h3>}
                >
                  <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Version label
                    <input
                      value={versionLabel}
                      onChange={(event) => setVersionLabel(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>

                  <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                    Release notes
                    <textarea
                      value={releaseNotes}
                      onChange={(event) => setReleaseNotes(event.target.value)}
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={saveAdvancedDraft}>
                      Save draft version
                    </Button>
                    <Button type="button" size="sm" onClick={publishAdvancedProfile}>
                      Publish profile
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </div>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
            {agentPanelOpen ? (
              <Card
                className="bg-white/95 dark:bg-slate-900/80"
                header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">AI capability agent</h3>}
              >
                <p className="text-sm text-[#47635a] dark:text-slate-300">
                  Use an in-program recruiting agent to draft and explain capability models before manual tuning.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => runAgent('draft')}>
                    Generate first draft
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => runAgent('rebalance')}>
                    Rebalance priorities
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => runAgent('explain')}>
                    Explain model choices
                  </Button>
                </div>

                <div className="mt-4 space-y-2 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                  {agentMessages.map((message, index) => (
                    <p key={`agent-msg-${index}`} className="text-xs leading-5 text-[#3f5b53] dark:text-slate-300">
                      {message}
                    </p>
                  ))}
                </div>

                {agentDraft ? (
                  <div className="mt-4 rounded-xl border border-[#d4e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{agentDraft.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#48635b] dark:text-slate-300">{agentDraft.rationale}</p>
                    <Button type="button" size="sm" className="mt-3" onClick={applyAgentDraft}>
                      Apply AI recommendations
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            <Card
              className="bg-white/95 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Profile status</h3>}
            >
              <div className="rounded-xl border border-[#d2dfd9] bg-[#f6fcf8] p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Completion
                </p>
                <p className="mt-1 text-3xl font-semibold text-[#0f2b23] dark:text-slate-100">{readinessScore}%</p>
                <p className="mt-1 text-sm font-medium text-[#3f5b53] dark:text-slate-300">{readinessLabel}</p>
                <div className="mt-3 h-2 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                  <div className="h-full rounded-full bg-[#12f987]" style={{ width: `${readinessScore}%` }} />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#d2dfd9] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Priority order
                </p>
                <div className="mt-2 space-y-2">
                  {normalizedPriorities.length === 0 ? (
                    <p className="text-xs text-[#4a655d] dark:text-slate-300">No priorities set.</p>
                  ) : (
                    normalizedPriorities.map((priority) => (
                      <div key={priority.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[#1e3d33] dark:text-slate-200">{priority.title}</span>
                        <span className="font-semibold text-[#0f2b23] dark:text-slate-100">{priority.normalized}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#d2dfd9] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Cohort coverage
                </p>
                <p className="mt-2 text-sm text-[#3f5b53] dark:text-slate-300">
                  {selectedCohorts.length === 0
                    ? 'No cohorts selected yet.'
                    : `${selectedCohorts.length} cohort${selectedCohorts.length > 1 ? 's' : ''} will receive this profile.`}
                </p>
              </div>

              {statusMessage ? (
                <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {statusMessage}
                </p>
              ) : null}
            </Card>

            <Card
              className="bg-white/95 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Export preview</h3>}
            >
              <pre className="max-h-80 overflow-auto rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 text-[11px] leading-5 text-[#375349] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
{JSON.stringify(exportPayload, null, 2)}
              </pre>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
