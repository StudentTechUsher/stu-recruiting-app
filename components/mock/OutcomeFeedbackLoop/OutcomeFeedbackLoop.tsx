import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type OutcomeStage = 'Interview' | 'Offer' | 'Hire';
type PerformanceTag = 'Pending' | 'Exceeds' | 'Strong' | 'Mixed' | 'Concern';

type CapabilityWeightKey =
  | 'problemSolving'
  | 'dataCommunication'
  | 'executionReliability'
  | 'collaboration'
  | 'businessJudgment';

type CapabilitySignals = Record<CapabilityWeightKey, number>;
type CalibrationWeights = Record<CapabilityWeightKey, number>;

type OutcomeCandidate = {
  id: string;
  fullName: string;
  university: string;
  targetRole: string;
  alignmentScore: number;
  stage: OutcomeStage;
  performanceTag: PerformanceTag;
  updatedAt: string;
  signals: CapabilitySignals;
};

type OutcomeEvent = {
  id: string;
  candidateId: string;
  candidateName: string;
  stage: OutcomeStage;
  performanceTag: PerformanceTag;
  timestamp: string;
};

type CalibrationEvent = {
  id: string;
  timestamp: string;
  summary: string;
};

type TrendPoint = {
  period: string;
  offerRate: number;
  hireRate: number;
  qualityRate: number;
  calibrationError: number;
};

const stageOrder: Record<OutcomeStage, number> = {
  Interview: 1,
  Offer: 2,
  Hire: 3
};

const stageOptions: OutcomeStage[] = ['Interview', 'Offer', 'Hire'];
const performanceTagOptions: PerformanceTag[] = ['Pending', 'Exceeds', 'Strong', 'Mixed', 'Concern'];
const highPerformanceTags: PerformanceTag[] = ['Exceeds', 'Strong'];

const capabilityDimensions: Array<{ key: CapabilityWeightKey; label: string }> = [
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'dataCommunication', label: 'Data communication' },
  { key: 'executionReliability', label: 'Execution reliability' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'businessJudgment', label: 'Business judgment' }
];

const defaultCalibrationWeights: CalibrationWeights = {
  problemSolving: 28,
  dataCommunication: 24,
  executionReliability: 20,
  collaboration: 14,
  businessJudgment: 14
};

const initialCandidates: OutcomeCandidate[] = [
  {
    id: 'oc-1',
    fullName: 'Avery Park',
    university: 'Northeastern University',
    targetRole: 'Product Analyst',
    alignmentScore: 91,
    stage: 'Hire',
    performanceTag: 'Exceeds',
    updatedAt: 'Jan 25, 2026',
    signals: {
      problemSolving: 94,
      dataCommunication: 90,
      executionReliability: 88,
      collaboration: 86,
      businessJudgment: 89
    }
  },
  {
    id: 'oc-2',
    fullName: 'Jordan Kim',
    university: 'Georgia Tech',
    targetRole: 'Data Analyst',
    alignmentScore: 87,
    stage: 'Offer',
    performanceTag: 'Pending',
    updatedAt: 'Feb 1, 2026',
    signals: {
      problemSolving: 89,
      dataCommunication: 84,
      executionReliability: 85,
      collaboration: 79,
      businessJudgment: 81
    }
  },
  {
    id: 'oc-3',
    fullName: 'Taylor Singh',
    university: 'Arizona State University',
    targetRole: 'Associate Consultant',
    alignmentScore: 76,
    stage: 'Interview',
    performanceTag: 'Pending',
    updatedAt: 'Feb 4, 2026',
    signals: {
      problemSolving: 79,
      dataCommunication: 76,
      executionReliability: 74,
      collaboration: 77,
      businessJudgment: 72
    }
  },
  {
    id: 'oc-4',
    fullName: 'Riley Carter',
    university: 'University of Michigan',
    targetRole: 'Data Analyst',
    alignmentScore: 72,
    stage: 'Hire',
    performanceTag: 'Strong',
    updatedAt: 'Jan 19, 2026',
    signals: {
      problemSolving: 75,
      dataCommunication: 73,
      executionReliability: 76,
      collaboration: 70,
      businessJudgment: 71
    }
  },
  {
    id: 'oc-5',
    fullName: 'Morgan Nguyen',
    university: 'Purdue University',
    targetRole: 'Product Analyst',
    alignmentScore: 84,
    stage: 'Hire',
    performanceTag: 'Mixed',
    updatedAt: 'Jan 28, 2026',
    signals: {
      problemSolving: 83,
      dataCommunication: 66,
      executionReliability: 67,
      collaboration: 60,
      businessJudgment: 92
    }
  },
  {
    id: 'oc-6',
    fullName: 'Drew Morales',
    university: 'Georgia Tech',
    targetRole: 'Product Analyst',
    alignmentScore: 79,
    stage: 'Offer',
    performanceTag: 'Pending',
    updatedAt: 'Feb 6, 2026',
    signals: {
      problemSolving: 82,
      dataCommunication: 80,
      executionReliability: 78,
      collaboration: 76,
      businessJudgment: 74
    }
  }
];

const historicalTrend: TrendPoint[] = [
  { period: 'Q1', offerRate: 31, hireRate: 12, qualityRate: 54, calibrationError: 21 },
  { period: 'Q2', offerRate: 35, hireRate: 14, qualityRate: 58, calibrationError: 18 },
  { period: 'Q3', offerRate: 38, hireRate: 16, qualityRate: 62, calibrationError: 15 },
  { period: 'Q4', offerRate: 41, hireRate: 18, qualityRate: 66, calibrationError: 13 }
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const tagBadgeClassMap: Record<PerformanceTag, string> = {
  Pending: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  Exceeds: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  Strong: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-100',
  Mixed: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  Concern: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100'
};

const stageBadgeClassMap: Record<OutcomeStage, string> = {
  Interview: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  Offer: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100',
  Hire: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100'
};

const normalizeWeightMap = (weights: CalibrationWeights) => {
  const keys = capabilityDimensions.map((dimension) => dimension.key);
  const total = keys.reduce((sum, key) => sum + weights[key], 0);

  if (total <= 0) return weights;

  const normalized = keys.map((key) => ({
    key,
    value: Math.max(4, Math.round((weights[key] / total) * 100))
  }));

  let delta = 100 - normalized.reduce((sum, item) => sum + item.value, 0);
  const sorted = [...normalized].sort((first, second) => second.value - first.value);
  let index = 0;

  while (delta !== 0 && index < 400) {
    const target = sorted[index % sorted.length];
    if (delta > 0 || target.value > 4) {
      target.value += delta > 0 ? 1 : -1;
      delta += delta > 0 ? -1 : 1;
    }
    index += 1;
  }

  return normalized.reduce<CalibrationWeights>((next, item) => {
    next[item.key] = item.value;
    return next;
  }, {} as CalibrationWeights);
};

const createTimestamp = () => {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const OutcomeFeedbackLoop = () => {
  const [outcomes, setOutcomes] = useState(initialCandidates);
  const [selectedCandidateId, setSelectedCandidateId] = useState(initialCandidates[0]?.id ?? null);
  const [stageDraftByCandidateId, setStageDraftByCandidateId] = useState<Record<string, OutcomeStage>>({});
  const [performanceDraftByCandidateId, setPerformanceDraftByCandidateId] = useState<Record<string, PerformanceTag>>({});
  const [calibrationWeights, setCalibrationWeights] = useState(defaultCalibrationWeights);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [outcomeEvents, setOutcomeEvents] = useState<OutcomeEvent[]>([]);
  const [calibrationEvents, setCalibrationEvents] = useState<CalibrationEvent[]>([
    {
      id: 'cal-1',
      timestamp: 'Jan 10, 2026',
      summary: 'Applied baseline weights for Winter recruiting cycle.'
    }
  ]);

  const selectedCandidate = useMemo(() => {
    if (outcomes.length === 0) return null;
    if (!selectedCandidateId) return outcomes[0];
    return outcomes.find((candidate) => candidate.id === selectedCandidateId) ?? outcomes[0];
  }, [outcomes, selectedCandidateId]);

  const stageDraft = selectedCandidate ? (stageDraftByCandidateId[selectedCandidate.id] ?? selectedCandidate.stage) : 'Interview';
  const performanceDraft = selectedCandidate
    ? (performanceDraftByCandidateId[selectedCandidate.id] ?? selectedCandidate.performanceTag)
    : 'Pending';

  const conversionMetrics = useMemo(() => {
    const interviewed = outcomes.length;
    const offered = outcomes.filter((candidate) => stageOrder[candidate.stage] >= stageOrder.Offer).length;
    const hired = outcomes.filter((candidate) => stageOrder[candidate.stage] >= stageOrder.Hire).length;
    const highPerformance = outcomes.filter(
      (candidate) => stageOrder[candidate.stage] >= stageOrder.Hire && highPerformanceTags.includes(candidate.performanceTag)
    ).length;

    return {
      interviewed,
      offered,
      hired,
      highPerformance,
      offerRate: interviewed === 0 ? 0 : Math.round((offered / interviewed) * 100),
      hireRate: interviewed === 0 ? 0 : Math.round((hired / interviewed) * 100),
      qualityRate: hired === 0 ? 0 : Math.round((highPerformance / hired) * 100)
    };
  }, [outcomes]);

  const weightTotal = useMemo(() => {
    return capabilityDimensions.reduce((sum, dimension) => sum + calibrationWeights[dimension.key], 0);
  }, [calibrationWeights]);

  const weightDrift = useMemo(() => {
    return capabilityDimensions.reduce((sum, dimension) => {
      return sum + Math.abs(calibrationWeights[dimension.key] - defaultCalibrationWeights[dimension.key]);
    }, 0);
  }, [calibrationWeights]);

  const currentTrend = useMemo<TrendPoint>(() => {
    const calibrationError = clamp(
      Math.round(14 + weightDrift * 0.35 - conversionMetrics.qualityRate * 0.08 + conversionMetrics.hireRate * 0.05),
      6,
      26
    );

    return {
      period: 'Now',
      offerRate: conversionMetrics.offerRate,
      hireRate: conversionMetrics.hireRate,
      qualityRate: conversionMetrics.qualityRate,
      calibrationError
    };
  }, [conversionMetrics.hireRate, conversionMetrics.offerRate, conversionMetrics.qualityRate, weightDrift]);

  const trendSeries = useMemo(() => {
    return [...historicalTrend, currentTrend];
  }, [currentTrend]);

  const trendBaseline = historicalTrend[historicalTrend.length - 1];
  const hireRateDelta = currentTrend.hireRate - trendBaseline.hireRate;
  const qualityRateDelta = currentTrend.qualityRate - trendBaseline.qualityRate;
  const calibrationErrorDelta = currentTrend.calibrationError - trendBaseline.calibrationError;

  const maxCalibrationError = useMemo(() => {
    return Math.max(...trendSeries.map((point) => point.calibrationError), 20);
  }, [trendSeries]);

  const calibrationSuggestions = useMemo(() => {
    const hiredCandidates = outcomes.filter((candidate) => stageOrder[candidate.stage] >= stageOrder.Hire);
    const highOutcomeCandidates = hiredCandidates.filter((candidate) => highPerformanceTags.includes(candidate.performanceTag));

    return capabilityDimensions.map((dimension) => {
      const hiredAverage =
        hiredCandidates.length === 0
          ? 0
          : hiredCandidates.reduce((sum, candidate) => sum + candidate.signals[dimension.key], 0) / hiredCandidates.length;

      const highOutcomeAverage =
        highOutcomeCandidates.length === 0
          ? 0
          : highOutcomeCandidates.reduce((sum, candidate) => sum + candidate.signals[dimension.key], 0) /
            highOutcomeCandidates.length;

      const delta = Math.round(highOutcomeAverage - hiredAverage);
      const recommendedDelta = delta >= 3 ? 2 : delta <= -3 ? -2 : 0;
      const suggestedShift = `${recommendedDelta > 0 ? '+' : ''}${recommendedDelta}`;

      return {
        key: dimension.key,
        label: dimension.label,
        recommendedDelta,
        suggestedShift,
        reason:
          delta >= 3
            ? 'High-performer hires over-index on this signal.'
            : delta <= -3
              ? 'High-performer outcomes are weaker here than cohort baseline.'
              : 'Current signal strength is close to your hired baseline.'
      };
    });
  }, [outcomes]);

  const logOutcomeUpdate = () => {
    if (!selectedCandidate) return;

    const timestamp = createTimestamp();

    setOutcomes((current) =>
      current.map((candidate) =>
        candidate.id === selectedCandidate.id
          ? {
              ...candidate,
              stage: stageDraft,
              performanceTag: performanceDraft,
              updatedAt: timestamp
            }
          : candidate
      )
    );

    setOutcomeEvents((current) => [
      {
        id: `evt-${Date.now()}`,
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.fullName,
        stage: stageDraft,
        performanceTag: performanceDraft,
        timestamp
      },
      ...current
    ]);

    setStatusMessage(`Logged ${stageDraft.toLowerCase()} outcome for ${selectedCandidate.fullName}.`);
  };

  const normalizeWeights = () => {
    setCalibrationWeights((current) => normalizeWeightMap(current));
    setStatusMessage('Normalized calibration weights to total 100%.');
  };

  const applySingleRecommendation = (key: CapabilityWeightKey) => {
    const recommendation = calibrationSuggestions.find((item) => item.key === key);
    if (!recommendation) return;

    if (recommendation.recommendedDelta === 0) {
      setStatusMessage(`No adjustment needed for ${recommendation.label} based on current outcomes.`);
      return;
    }

    setCalibrationWeights((current) => {
      const nextValue = clamp(current[key] + recommendation.recommendedDelta, 4, 45);
      return normalizeWeightMap({
        ...current,
        [key]: nextValue
      });
    });

    setStatusMessage(`Applied ${recommendation.suggestedShift} recommendation to ${recommendation.label} and normalized weights.`);
  };

  const applyAllRecommendations = () => {
    const recommendationByKey = calibrationSuggestions.reduce<Record<CapabilityWeightKey, number>>((accumulator, item) => {
      accumulator[item.key] = item.recommendedDelta;
      return accumulator;
    }, {} as Record<CapabilityWeightKey, number>);

    setCalibrationWeights((current) => {
      const nextWeights = capabilityDimensions.reduce<CalibrationWeights>((accumulator, dimension) => {
        const delta = recommendationByKey[dimension.key] ?? 0;
        accumulator[dimension.key] = clamp(current[dimension.key] + delta, 4, 45);
        return accumulator;
      }, {} as CalibrationWeights);

      return normalizeWeightMap(nextWeights);
    });

    const changedCount = calibrationSuggestions.filter((item) => item.recommendedDelta !== 0).length;
    setStatusMessage(
      changedCount === 0
        ? 'No recommendation adjustments are currently needed.'
        : `Applied ${changedCount} adjustment recommendation${changedCount > 1 ? 's' : ''} and normalized weights.`
    );
  };

  const applyCalibration = () => {
    const timestamp = createTimestamp();
    setCalibrationEvents((current) => [
      {
        id: `cal-${Date.now()}`,
        timestamp,
        summary: 'Applied updated model weights for next cohort scoring cycle.'
      },
      ...current
    ]);
    setStatusMessage('Calibration applied. Future alignment scoring now uses the updated weight model.');
  };

  return (
    <section aria-labelledby="outcome-feedback-loop-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">
              Outcome Feedback Loop
            </p>
            <h2
              id="outcome-feedback-loop-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Calibrate capability models against real hiring outcomes
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Log interviews, offers, hires, and post-hire performance outcomes, then tune model weights so each cohort
              reflects what predicts actual success.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Outcome-driven calibration
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Interviewed</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{conversionMetrics.interviewed}</p>
          </div>
          <div className="rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Offered</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{conversionMetrics.offered}</p>
            <p className="text-xs font-medium text-[#48645b] dark:text-slate-300">{conversionMetrics.offerRate}% of interviewed</p>
          </div>
          <div className="rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Hired</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{conversionMetrics.hired}</p>
            <p className="text-xs font-medium text-[#48645b] dark:text-slate-300">{conversionMetrics.hireRate}% of interviewed</p>
          </div>
          <div className="rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">High Performance</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{conversionMetrics.highPerformance}</p>
            <p className="text-xs font-medium text-[#48645b] dark:text-slate-300">{conversionMetrics.qualityRate}% of hires</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Outcome logger</h3>}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Interview - Offer - Hire - Performance tag
              </p>

              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Candidate
                <select
                  value={selectedCandidate?.id ?? ''}
                  onChange={(event) => setSelectedCandidateId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {outcomes.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} · {candidate.targetRole}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCandidate ? (
                <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{selectedCandidate.fullName}</p>
                  <p className="mt-1 text-xs text-[#48645b] dark:text-slate-300">
                    {selectedCandidate.targetRole} · {selectedCandidate.university} · Alignment {selectedCandidate.alignmentScore}
                  </p>
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Pipeline stage</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {stageOptions.map((stage) => {
                    const isActive = stageDraft === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => {
                          if (!selectedCandidate) return;
                          setStageDraftByCandidateId((current) => ({
                            ...current,
                            [selectedCandidate.id]: stage
                          }));
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                            : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Performance tag</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {performanceTagOptions.map((tag) => {
                    const isActive = performanceDraft === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!selectedCandidate) return;
                          setPerformanceDraftByCandidateId((current) => ({
                            ...current,
                            [selectedCandidate.id]: tag
                          }));
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                            : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button type="button" className="mt-4" onClick={logOutcomeUpdate}>
                Log outcome update
              </Button>

              {statusMessage ? (
                <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {statusMessage}
                </p>
              ) : null}
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Logged outcomes</h3>}
            >
              <div className="space-y-2">
                {(outcomeEvents.length === 0 ? outcomes.slice(0, 4) : outcomeEvents).map((entry) => {
                  const isSeededEntry = 'fullName' in entry;
                  const candidateName = isSeededEntry ? entry.fullName : entry.candidateName;
                  const stage = entry.stage;
                  const performanceTag = entry.performanceTag;
                  const timestamp = isSeededEntry ? entry.updatedAt : entry.timestamp;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#15382f] dark:text-slate-100">{candidateName}</p>
                        <p className="text-xs text-[#4f6a62] dark:text-slate-400">{timestamp}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={stageBadgeClassMap[stage]}>{stage}</Badge>
                        <Badge className={tagBadgeClassMap[performanceTag]}>{performanceTag}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Calibration panel</h3>}
            >
              <p className="text-sm text-[#48635b] dark:text-slate-300">
                Adjust model weights based on outcomes. Guidance is shown directly under each dimension so you can
                calibrate where it matters most.
              </p>

              <div className="mt-4 space-y-3">
                {capabilityDimensions.map((dimension) => {
                  const value = calibrationWeights[dimension.key];
                  const normalized = weightTotal === 0 ? 0 : Math.round((value / weightTotal) * 100);
                  const recommendation = calibrationSuggestions.find((item) => item.key === dimension.key);

                  return (
                    <div
                      key={dimension.key}
                      className="rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#436059] dark:text-slate-300">
                        <span>{dimension.label}</span>
                        <span>
                          {value}% ({normalized}% normalized)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={45}
                        value={value}
                        onChange={(event) =>
                          setCalibrationWeights((current) => ({
                            ...current,
                            [dimension.key]: Number(event.target.value)
                          }))
                        }
                        className="w-full accent-[#12f987]"
                        aria-label={`Adjust weight for ${dimension.label}`}
                      />
                      {recommendation ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] leading-4 text-[#4c6860] dark:text-slate-300">{recommendation.reason}</p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-semibold ${
                                recommendation.suggestedShift === '+0'
                                  ? 'text-[#466359] dark:text-slate-300'
                                  : recommendation.suggestedShift.startsWith('+')
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              Suggested shift {recommendation.suggestedShift}
                            </span>
                            <button
                              type="button"
                              onClick={() => applySingleRecommendation(dimension.key)}
                              disabled={recommendation.recommendedDelta === 0}
                              className="rounded-lg border border-[#bfd2ca] bg-white px-2 py-1 text-[11px] font-semibold text-[#1e4035] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-xs font-semibold text-[#48645b] dark:text-slate-300">Current weight total: {weightTotal}%</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={applyAllRecommendations}>
                  Apply all adjustment recommendations
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={normalizeWeights}>
                  Normalize to 100%
                </Button>
                <Button type="button" size="sm" onClick={applyCalibration}>
                  Apply calibration
                </Button>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Calibration history
                </p>
                {calibrationEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[#d4e1db] bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-xs font-medium text-[#183b31] dark:text-slate-100">{event.summary}</p>
                    <p className="mt-0.5 text-[11px] text-[#4c6860] dark:text-slate-400">{event.timestamp}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80"
            header={
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Offer and hire rate over time</h3>
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c4d5ce] text-[11px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                    aria-label="How to read offer and hire rate trend"
                  >
                    i
                  </button>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-7 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-[#d2dfd9] bg-white p-3 text-xs leading-5 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:left-auto sm:right-0 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Each period compares offer and hire rates as a share of interviewed candidates. If hire growth
                    lags offer growth, the model is surfacing prospects who enter process but do not close.
                  </div>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-5 gap-2">
              {trendSeries.map((point) => (
                <div key={`conversion-${point.period}`} className="flex flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1 rounded-xl border border-[#d4e1db] bg-[#f7fcf9] px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <span className="w-3 rounded-t bg-[#8ee6b7]" style={{ height: `${point.offerRate}%` }} />
                    <span className="w-3 rounded-t bg-[#12f987]" style={{ height: `${point.hireRate}%` }} />
                  </div>
                  <p className="text-[11px] font-semibold text-[#4a665d] dark:text-slate-300">{point.period}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#456158] dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8ee6b7]" />
                Offer rate
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#12f987]" />
                Hire rate
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-[#456158] dark:text-slate-300">
              Hire rate vs Q4: {hireRateDelta > 0 ? '+' : ''}
              {hireRateDelta} points
            </p>
          </Card>

          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80"
            header={
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Quality and calibration error trend</h3>
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c4d5ce] text-[11px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                    aria-label="How to read quality and calibration error trend"
                  >
                    i
                  </button>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-7 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-[#d2dfd9] bg-white p-3 text-xs leading-5 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:left-auto sm:right-0 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Quality tracks high-performance outcomes after hiring, while calibration error shows gap between
                    predicted readiness and observed results. The goal is quality up, error down.
                  </div>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-5 gap-2">
              {trendSeries.map((point) => (
                <div key={`quality-${point.period}`} className="flex flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1 rounded-xl border border-[#d4e1db] bg-[#f7fcf9] px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <span className="w-3 rounded-t bg-[#4ade80]" style={{ height: `${point.qualityRate}%` }} />
                    <span
                      className="w-3 rounded-t bg-slate-400 dark:bg-slate-500"
                      style={{ height: `${Math.round((point.calibrationError / maxCalibrationError) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-[#4a665d] dark:text-slate-300">{point.period}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#456158] dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
                High-performance quality rate
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                Calibration error (lower is better)
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-[#456158] dark:text-slate-300">
              Quality vs Q4: {qualityRateDelta > 0 ? '+' : ''}
              {qualityRateDelta} points · Error vs Q4: {calibrationErrorDelta > 0 ? '+' : ''}
              {calibrationErrorDelta} points
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
};
