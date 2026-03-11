import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

const ALL_UNIVERSITIES = 'All universities';
const ALL_TARGET_ROLES = 'All target roles';

const capabilityDimensions = [
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'dataCommunication', label: 'Data communication' },
  { key: 'execution', label: 'Execution reliability' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'businessJudgment', label: 'Business judgment' }
] as const;

type CapabilityDimensionKey = (typeof capabilityDimensions)[number]['key'];
type DimensionScores = Record<CapabilityDimensionKey, number>;
type CapabilityBand = 'Emerging' | 'Developing' | 'Ready' | 'Standout';
type PipelineDrawerView = 'all' | 'readyPlus' | 'highScore' | 'topSignal';
type RecommendationAction = 'openAll' | 'openReadyPlus' | 'openHighScore' | 'openTopSignal' | 'resetFilters' | 'focusReadyBands';

type AgentRecommendation = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  action: RecommendationAction;
};

const capabilityBands: CapabilityBand[] = ['Emerging', 'Developing', 'Ready', 'Standout'];

const alignmentBands = [
  { id: 'a-1', label: '0-54', min: 0, max: 54 },
  { id: 'a-2', label: '55-64', min: 55, max: 64 },
  { id: 'a-3', label: '65-74', min: 65, max: 74 },
  { id: 'a-4', label: '75-84', min: 75, max: 84 },
  { id: 'a-5', label: '85-100', min: 85, max: 100 }
] as const;

type StudentSignal = {
  id: string;
  university: string;
  targetRole: string;
  capabilityBand: CapabilityBand;
  alignmentScore: number;
  optedIn: boolean;
  dimensions: DimensionScores;
};

const defaultStudentPool: StudentSignal[] = [
  {
    id: 'stu-1',
    university: 'Arizona State University',
    targetRole: 'Data Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 82,
    optedIn: true,
    dimensions: {
      problemSolving: 84,
      dataCommunication: 78,
      execution: 80,
      collaboration: 74,
      businessJudgment: 77
    }
  },
  {
    id: 'stu-2',
    university: 'Arizona State University',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Developing',
    alignmentScore: 67,
    optedIn: true,
    dimensions: {
      problemSolving: 68,
      dataCommunication: 62,
      execution: 69,
      collaboration: 71,
      businessJudgment: 64
    }
  },
  {
    id: 'stu-3',
    university: 'Northeastern University',
    targetRole: 'Product Analyst',
    capabilityBand: 'Standout',
    alignmentScore: 91,
    optedIn: true,
    dimensions: {
      problemSolving: 92,
      dataCommunication: 88,
      execution: 90,
      collaboration: 87,
      businessJudgment: 89
    }
  },
  {
    id: 'stu-4',
    university: 'Northeastern University',
    targetRole: 'Data Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 79,
    optedIn: true,
    dimensions: {
      problemSolving: 80,
      dataCommunication: 76,
      execution: 78,
      collaboration: 73,
      businessJudgment: 75
    }
  },
  {
    id: 'stu-5',
    university: 'Georgia Tech',
    targetRole: 'Data Analyst',
    capabilityBand: 'Standout',
    alignmentScore: 94,
    optedIn: true,
    dimensions: {
      problemSolving: 95,
      dataCommunication: 89,
      execution: 93,
      collaboration: 85,
      businessJudgment: 90
    }
  },
  {
    id: 'stu-6',
    university: 'Georgia Tech',
    targetRole: 'Product Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 83,
    optedIn: true,
    dimensions: {
      problemSolving: 84,
      dataCommunication: 81,
      execution: 82,
      collaboration: 76,
      businessJudgment: 79
    }
  },
  {
    id: 'stu-7',
    university: 'University of Michigan',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Developing',
    alignmentScore: 63,
    optedIn: true,
    dimensions: {
      problemSolving: 65,
      dataCommunication: 58,
      execution: 62,
      collaboration: 68,
      businessJudgment: 61
    }
  },
  {
    id: 'stu-8',
    university: 'University of Michigan',
    targetRole: 'Product Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 76,
    optedIn: true,
    dimensions: {
      problemSolving: 77,
      dataCommunication: 74,
      execution: 75,
      collaboration: 72,
      businessJudgment: 73
    }
  },
  {
    id: 'stu-9',
    university: 'University of Texas at Austin',
    targetRole: 'Data Analyst',
    capabilityBand: 'Developing',
    alignmentScore: 70,
    optedIn: true,
    dimensions: {
      problemSolving: 72,
      dataCommunication: 68,
      execution: 71,
      collaboration: 66,
      businessJudgment: 69
    }
  },
  {
    id: 'stu-10',
    university: 'University of Texas at Austin',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Emerging',
    alignmentScore: 53,
    optedIn: true,
    dimensions: {
      problemSolving: 56,
      dataCommunication: 50,
      execution: 52,
      collaboration: 58,
      businessJudgment: 51
    }
  },
  {
    id: 'stu-11',
    university: 'Purdue University',
    targetRole: 'Data Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 80,
    optedIn: true,
    dimensions: {
      problemSolving: 81,
      dataCommunication: 77,
      execution: 80,
      collaboration: 73,
      businessJudgment: 76
    }
  },
  {
    id: 'stu-12',
    university: 'Purdue University',
    targetRole: 'Product Analyst',
    capabilityBand: 'Developing',
    alignmentScore: 64,
    optedIn: true,
    dimensions: {
      problemSolving: 66,
      dataCommunication: 61,
      execution: 64,
      collaboration: 65,
      businessJudgment: 62
    }
  },
  {
    id: 'stu-13',
    university: 'Arizona State University',
    targetRole: 'Product Analyst',
    capabilityBand: 'Developing',
    alignmentScore: 66,
    optedIn: true,
    dimensions: {
      problemSolving: 67,
      dataCommunication: 64,
      execution: 65,
      collaboration: 67,
      businessJudgment: 63
    }
  },
  {
    id: 'stu-14',
    university: 'Northeastern University',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Ready',
    alignmentScore: 78,
    optedIn: true,
    dimensions: {
      problemSolving: 79,
      dataCommunication: 75,
      execution: 77,
      collaboration: 79,
      businessJudgment: 74
    }
  },
  {
    id: 'stu-15',
    university: 'University of Michigan',
    targetRole: 'Data Analyst',
    capabilityBand: 'Emerging',
    alignmentScore: 55,
    optedIn: true,
    dimensions: {
      problemSolving: 57,
      dataCommunication: 53,
      execution: 54,
      collaboration: 59,
      businessJudgment: 52
    }
  },
  {
    id: 'stu-16',
    university: 'Georgia Tech',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Ready',
    alignmentScore: 84,
    optedIn: true,
    dimensions: {
      problemSolving: 85,
      dataCommunication: 79,
      execution: 84,
      collaboration: 80,
      businessJudgment: 82
    }
  },
  {
    id: 'stu-17',
    university: 'University of Texas at Austin',
    targetRole: 'Product Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 75,
    optedIn: true,
    dimensions: {
      problemSolving: 76,
      dataCommunication: 73,
      execution: 74,
      collaboration: 71,
      businessJudgment: 72
    }
  },
  {
    id: 'stu-18',
    university: 'Purdue University',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Standout',
    alignmentScore: 88,
    optedIn: true,
    dimensions: {
      problemSolving: 89,
      dataCommunication: 84,
      execution: 88,
      collaboration: 86,
      businessJudgment: 85
    }
  },
  {
    id: 'stu-19',
    university: 'Georgia Tech',
    targetRole: 'Data Analyst',
    capabilityBand: 'Developing',
    alignmentScore: 69,
    optedIn: true,
    dimensions: {
      problemSolving: 71,
      dataCommunication: 66,
      execution: 70,
      collaboration: 64,
      businessJudgment: 68
    }
  },
  {
    id: 'stu-20',
    university: 'University of Texas at Austin',
    targetRole: 'Data Analyst',
    capabilityBand: 'Ready',
    alignmentScore: 77,
    optedIn: false,
    dimensions: {
      problemSolving: 78,
      dataCommunication: 74,
      execution: 76,
      collaboration: 72,
      businessJudgment: 73
    }
  },
  {
    id: 'stu-21',
    university: 'Arizona State University',
    targetRole: 'Associate Consultant',
    capabilityBand: 'Emerging',
    alignmentScore: 52,
    optedIn: false,
    dimensions: {
      problemSolving: 55,
      dataCommunication: 49,
      execution: 51,
      collaboration: 57,
      businessJudgment: 50
    }
  },
  {
    id: 'stu-22',
    university: 'Northeastern University',
    targetRole: 'Product Analyst',
    capabilityBand: 'Standout',
    alignmentScore: 90,
    optedIn: false,
    dimensions: {
      problemSolving: 91,
      dataCommunication: 87,
      execution: 89,
      collaboration: 86,
      businessJudgment: 88
    }
  }
];

const heatmapRows: Array<{
  id: string;
  label: string;
  multipliers: Record<CapabilityDimensionKey, number>;
}> = [
  {
    id: 'hm-1',
    label: 'Coursework rigor',
    multipliers: {
      problemSolving: 1.04,
      dataCommunication: 0.92,
      execution: 0.96,
      collaboration: 0.84,
      businessJudgment: 0.88
    }
  },
  {
    id: 'hm-2',
    label: 'Applied project depth',
    multipliers: {
      problemSolving: 1.01,
      dataCommunication: 0.98,
      execution: 1.05,
      collaboration: 0.9,
      businessJudgment: 0.94
    }
  },
  {
    id: 'hm-3',
    label: 'Internship outcomes',
    multipliers: {
      problemSolving: 0.95,
      dataCommunication: 0.97,
      execution: 1.08,
      collaboration: 0.98,
      businessJudgment: 1.06
    }
  },
  {
    id: 'hm-4',
    label: 'Team leadership signals',
    multipliers: {
      problemSolving: 0.86,
      dataCommunication: 0.92,
      execution: 0.9,
      collaboration: 1.12,
      businessJudgment: 1.02
    }
  },
  {
    id: 'hm-5',
    label: 'Communication artifacts',
    multipliers: {
      problemSolving: 0.82,
      dataCommunication: 1.14,
      execution: 0.87,
      collaboration: 1.05,
      businessJudgment: 0.96
    }
  }
];

const capabilityBandCountOrder: CapabilityBand[] = ['Standout', 'Ready', 'Developing', 'Emerging'];

const pipelineDrawerCopy: Record<
  PipelineDrawerView,
  { title: string; description: string; emptyText: string; actionLabel: string }
> = {
  all: {
    title: 'Current filtered pipeline',
    description: 'All opted-in students in the current filter cut.',
    emptyText: 'No students match the current filters.',
    actionLabel: 'View students'
  },
  readyPlus: {
    title: 'Ready + Standout segment',
    description: 'Students already in the top two capability bands for this filter cut.',
    emptyText: 'No students are in Ready or Standout under current filters.',
    actionLabel: 'View Ready+'
  },
  highScore: {
    title: 'Above-average alignment segment',
    description: 'Students at or above the current average alignment score.',
    emptyText: 'No students are at or above the current average score.',
    actionLabel: 'View above avg'
  },
  topSignal: {
    title: 'Top-signal segment',
    description: 'Students whose strongest capability matches the current top signal dimension.',
    emptyText: 'No students match the current top signal dimension.',
    actionLabel: 'View top signal'
  }
};

const createZeroScores = (): DimensionScores =>
  capabilityDimensions.reduce((accumulator, dimension) => {
    accumulator[dimension.key] = 0;
    return accumulator;
  }, {} as DimensionScores);

const clampScore = (value: number) => Math.max(0, Math.min(99, value));

const getPrimaryDimensionKey = (dimensions: DimensionScores): CapabilityDimensionKey => {
  return capabilityDimensions
    .map((dimension) => dimension.key)
    .sort((first, second) => dimensions[second] - dimensions[first])[0];
};

const getTopCapabilityLabels = (dimensions: DimensionScores, count = 2): string[] => {
  return capabilityDimensions
    .slice()
    .sort((first, second) => dimensions[second.key] - dimensions[first.key])
    .slice(0, count)
    .map((dimension) => dimension.label);
};

const getCandidateLabel = (id: string) => {
  const numericId = id.replace('stu-', 'S-');
  return `Candidate ${numericId}`;
};

const getHeatCellClassName = (score: number) => {
  if (score >= 85) return 'bg-[#12f987] text-[#0a1f1a]';
  if (score >= 75) return 'bg-[#7ef8be] text-[#0a1f1a]';
  if (score >= 65) return 'bg-[#baf6db] text-[#12342b]';
  if (score >= 55) return 'bg-[#e3f7ed] text-[#2d4a42]';
  if (score >= 1) return 'bg-[#f4faf7] text-[#4f6a62] dark:bg-slate-800 dark:text-slate-300';
  return 'bg-[#f3f5f4] text-[#6a7f78] dark:bg-slate-800/70 dark:text-slate-500';
};

export interface EmployerDashboardPipelineOverviewProps {
  pool?: StudentSignal[];
}

export const EmployerDashboardPipelineOverview = ({ pool = defaultStudentPool }: EmployerDashboardPipelineOverviewProps) => {
  const optedInPool = useMemo(() => pool.filter((student) => student.optedIn), [pool]);

  const universities = useMemo(
    () => [ALL_UNIVERSITIES, ...Array.from(new Set(optedInPool.map((student) => student.university)))],
    [optedInPool]
  );
  const targetRoles = useMemo(
    () => [ALL_TARGET_ROLES, ...Array.from(new Set(optedInPool.map((student) => student.targetRole)))],
    [optedInPool]
  );

  const [selectedUniversity, setSelectedUniversity] = useState(ALL_UNIVERSITIES);
  const [selectedRole, setSelectedRole] = useState(ALL_TARGET_ROLES);
  const [selectedBands, setSelectedBands] = useState<CapabilityBand[]>([...capabilityBands]);
  const [activePipelineView, setActivePipelineView] = useState<PipelineDrawerView | null>(null);

  const filteredPool = useMemo(
    () =>
      optedInPool.filter((student) => {
        const matchesUniversity = selectedUniversity === ALL_UNIVERSITIES || student.university === selectedUniversity;
        const matchesRole = selectedRole === ALL_TARGET_ROLES || student.targetRole === selectedRole;
        const matchesBand = selectedBands.includes(student.capabilityBand);
        return matchesUniversity && matchesRole && matchesBand;
      }),
    [optedInPool, selectedBands, selectedRole, selectedUniversity]
  );

  const distribution = useMemo(
    () =>
      alignmentBands.map((range) => ({
        ...range,
        count: filteredPool.filter(
          (student) => student.alignmentScore >= range.min && student.alignmentScore <= range.max
        ).length
      })),
    [filteredPool]
  );

  const maxDistributionCount = Math.max(1, ...distribution.map((range) => range.count));
  const averageAlignmentScore =
    filteredPool.length === 0
      ? 0
      : Math.round(
          filteredPool.reduce((sum, student) => {
            return sum + student.alignmentScore;
          }, 0) / filteredPool.length
        );

  const averageDimensionScores = useMemo<DimensionScores>(() => {
    if (filteredPool.length === 0) return createZeroScores();

    return capabilityDimensions.reduce((accumulator, dimension) => {
      const sumForDimension = filteredPool.reduce((sum, student) => {
        return sum + student.dimensions[dimension.key];
      }, 0);
      accumulator[dimension.key] = Math.round(sumForDimension / filteredPool.length);
      return accumulator;
    }, {} as DimensionScores);
  }, [filteredPool]);

  const heatmap = useMemo(
    () =>
      heatmapRows.map((row) => ({
        ...row,
        cells: capabilityDimensions.map((dimension) => {
          if (filteredPool.length === 0) {
            return { dimensionKey: dimension.key, value: 0 };
          }

          const scaledValue = Math.round(averageDimensionScores[dimension.key] * row.multipliers[dimension.key]);
          return { dimensionKey: dimension.key, value: clampScore(scaledValue) };
        })
      })),
    [averageDimensionScores, filteredPool.length]
  );

  const readyAndStandoutShare =
    filteredPool.length === 0
      ? 0
      : Math.round(
          (filteredPool.filter((student) => student.capabilityBand === 'Ready' || student.capabilityBand === 'Standout')
            .length /
            filteredPool.length) *
            100
        );

  const rankedDimensions = useMemo(
    () => [...capabilityDimensions].sort((first, second) => averageDimensionScores[second.key] - averageDimensionScores[first.key]),
    [averageDimensionScores]
  );

  const topDimensionKey = rankedDimensions[0]?.key ?? capabilityDimensions[0].key;
  const topDimension = rankedDimensions[0]?.label ?? capabilityDimensions[0].label;
  const weakestDimensionKey = rankedDimensions[rankedDimensions.length - 1]?.key ?? capabilityDimensions[0].key;
  const weakestDimension = rankedDimensions[rankedDimensions.length - 1]?.label ?? capabilityDimensions[0].label;
  const weakestDimensionScore = averageDimensionScores[weakestDimensionKey];

  const bandCounts = capabilityBandCountOrder.map((band) => ({
    band,
    count: filteredPool.filter((student) => student.capabilityBand === band).length
  }));

  const lowerBandCount = distribution.slice(0, 2).reduce((sum, band) => sum + band.count, 0);
  const upperBandCount = distribution.slice(3).reduce((sum, band) => sum + band.count, 0);
  const peakDistributionBand = distribution.reduce((peak, current) => {
    return current.count > peak.count ? current : peak;
  }, distribution[0]);
  const aboveAverageCount = filteredPool.filter((student) => student.alignmentScore >= averageAlignmentScore).length;

  const pipelineCandidates = useMemo(() => {
    if (!activePipelineView) return [];

    let candidates = filteredPool;

    if (activePipelineView === 'readyPlus') {
      candidates = filteredPool.filter(
        (student) => student.capabilityBand === 'Ready' || student.capabilityBand === 'Standout'
      );
    }

    if (activePipelineView === 'highScore') {
      candidates = filteredPool.filter((student) => student.alignmentScore >= averageAlignmentScore);
    }

    if (activePipelineView === 'topSignal') {
      candidates = filteredPool.filter((student) => getPrimaryDimensionKey(student.dimensions) === topDimensionKey);
    }

    return candidates.slice().sort((first, second) => second.alignmentScore - first.alignmentScore);
  }, [activePipelineView, averageAlignmentScore, filteredPool, topDimensionKey]);

  const activeFilterSummary = useMemo(() => {
    const summary: string[] = [];

    if (selectedUniversity !== ALL_UNIVERSITIES) summary.push(selectedUniversity);
    if (selectedRole !== ALL_TARGET_ROLES) summary.push(selectedRole);
    if (selectedBands.length !== capabilityBands.length) summary.push(`${selectedBands.length} capability bands`);

    return summary.length === 0 ? 'No additional filters' : summary.join(' • ');
  }, [selectedBands.length, selectedRole, selectedUniversity]);

  const distributionRecommendations = useMemo<AgentRecommendation[]>(() => {
    if (filteredPool.length === 0) {
      return [
        {
          id: 'dist-empty',
          title: 'No score distribution under current filters',
          detail: 'Broaden your current filters to restore score signal and compare readiness bands.',
          actionLabel: 'Reset filters',
          action: 'resetFilters'
        }
      ];
    }

    const recommendations: AgentRecommendation[] = [];

    if (readyAndStandoutShare < 45) {
      recommendations.push({
        id: 'dist-ready-gap',
        title: `Ready+ density is ${readyAndStandoutShare}%`,
        detail: `Highest concentration is currently in ${peakDistributionBand.label}. Prioritize coaching and shortlist only top-ready candidates first.`,
        actionLabel: 'Open Ready+ segment',
        action: 'openReadyPlus'
      });
    } else {
      recommendations.push({
        id: 'dist-ready-strong',
        title: `Ready+ density is healthy at ${readyAndStandoutShare}%`,
        detail: 'Current filters are producing a high-readiness pool that can move into outreach immediately.',
        actionLabel: 'Open all candidates',
        action: 'openAll'
      });
    }

    if (lowerBandCount > upperBandCount) {
      recommendations.push({
        id: 'dist-lower-skew',
        title: 'Pipeline skews to early readiness bands',
        detail: `${lowerBandCount} students are below 65 versus ${upperBandCount} in 75+ bands.`,
        actionLabel: 'Open above-average segment',
        action: 'openHighScore'
      });
    } else {
      recommendations.push({
        id: 'dist-upper-skew',
        title: 'Upper-band signal is stronger than lower-band signal',
        detail: `${upperBandCount} students currently sit in 75+ alignment ranges.`,
        actionLabel: 'Focus Ready+ bands',
        action: 'focusReadyBands'
      });
    }

    return recommendations.slice(0, 2);
  }, [filteredPool.length, lowerBandCount, peakDistributionBand.label, readyAndStandoutShare, upperBandCount]);

  const heatmapRecommendations = useMemo<AgentRecommendation[]>(() => {
    if (filteredPool.length === 0) {
      return [
        {
          id: 'heat-empty',
          title: 'Heatmap needs an active student segment',
          detail: 'No skill profile can be inferred until the filter cut includes opted-in students.',
          actionLabel: 'Reset filters',
          action: 'resetFilters'
        }
      ];
    }

    const recommendations: AgentRecommendation[] = [
      {
        id: 'heat-gap',
        title: `Largest capability gap: ${weakestDimension} (${weakestDimensionScore})`,
        detail: `The strongest capability in this cut is ${topDimension}. Use top-signal candidates as a benchmark for coaching targets.`,
        actionLabel: 'Open top-signal segment',
        action: 'openTopSignal'
      }
    ];

    if (aboveAverageCount === 0) {
      recommendations.push({
        id: 'heat-no-above-avg',
        title: 'No candidates are above the current average score',
        detail: 'This indicates a thin pipeline; widening bands can recover outreach volume.',
        actionLabel: 'Reset filters',
        action: 'resetFilters'
      });
    } else {
      recommendations.push({
        id: 'heat-above-avg',
        title: `${aboveAverageCount} students are at or above average alignment`,
        detail: 'These candidates are strongest candidates to advance while lower bands continue development.',
        actionLabel: 'Open above-average segment',
        action: 'openHighScore'
      });
    }

    return recommendations;
  }, [aboveAverageCount, filteredPool.length, topDimension, weakestDimension, weakestDimensionScore]);

  const toggleCapabilityBand = (band: CapabilityBand) => {
    setSelectedBands((currentBands) => {
      if (currentBands.includes(band)) {
        return currentBands.filter((item) => item !== band);
      }

      return [...currentBands, band];
    });
  };

  const resetFilters = () => {
    setSelectedUniversity(ALL_UNIVERSITIES);
    setSelectedRole(ALL_TARGET_ROLES);
    setSelectedBands([...capabilityBands]);
    setActivePipelineView(null);
  };

  const openPipelineView = (view: PipelineDrawerView) => {
    setActivePipelineView(view);
  };

  const closePipelineView = () => {
    setActivePipelineView(null);
  };

  const runRecommendationAction = (action: RecommendationAction) => {
    if (action === 'openAll') openPipelineView('all');
    if (action === 'openReadyPlus') openPipelineView('readyPlus');
    if (action === 'openHighScore') openPipelineView('highScore');
    if (action === 'openTopSignal') openPipelineView('topSignal');
    if (action === 'focusReadyBands') setSelectedBands(['Ready', 'Standout']);
    if (action === 'resetFilters') resetFilters();
  };

  useEffect(() => {
    if (!activePipelineView) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePipelineView();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activePipelineView]);

  return (
    <section aria-labelledby="pipeline-overview-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfded7] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
              Employer Dashboard
            </p>
            <h2
              id="pipeline-overview-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Pipeline overview
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Evaluate capability signal across the opted-in student pool before applications open. Employers can see
              where readiness is dense and where capability gaps remain.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Signal before applications
          </Badge>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              University
            </span>
            <select
              value={selectedUniversity}
              onChange={(event) => setSelectedUniversity(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Filter by university"
            >
              {universities.map((university) => (
                <option key={university} value={university}>
                  {university}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              Target role
            </span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Filter by target role"
            >
              {targetRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="h-11 self-end rounded-xl border border-[#bfd2ca] bg-white px-4 text-sm font-semibold text-[#224238] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
            Capability bands
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {capabilityBands.map((band) => {
              const isActive = selectedBands.includes(band);

              return (
                <button
                  key={band}
                  type="button"
                  onClick={() => toggleCapabilityBand(band)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a] dark:border-[#12f987] dark:bg-[#12f987]'
                      : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {band}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7 grid gap-4 xl:gap-3 xl:grid-cols-2">
          <Card
            className="bg-[#f5fbf8] xl:col-span-2 dark:bg-slate-900/70"
            header={
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                  Pipeline snapshot
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Current cut</h3>
              </div>
            }
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <dt className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Students</dt>
                <dd className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{filteredPool.length}</dd>
                <button
                  type="button"
                  onClick={() => openPipelineView('all')}
                  className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                >
                  {pipelineDrawerCopy.all.actionLabel}
                </button>
              </div>
              <div className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <dt className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Avg score</dt>
                <dd className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{averageAlignmentScore}</dd>
                <button
                  type="button"
                  onClick={() => openPipelineView('highScore')}
                  className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                >
                  {pipelineDrawerCopy.highScore.actionLabel}
                </button>
              </div>
              <div className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">
                  <span>Ready+ share</span>
                  <span className="group relative">
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c4d5ce] text-[10px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                      aria-label="How to read Ready plus share"
                    >
                      i
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-5 z-20 w-[min(16rem,calc(100vw-3rem))] rounded-lg border border-[#d2dfd9] bg-white p-2.5 text-[11px] normal-case leading-4 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 xl:left-auto xl:right-0"
                    >
                      Percent of filtered opted-in students currently in the Ready or Standout capability bands.
                    </span>
                  </span>
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{readyAndStandoutShare}%</dd>
                <button
                  type="button"
                  onClick={() => openPipelineView('readyPlus')}
                  className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                >
                  {pipelineDrawerCopy.readyPlus.actionLabel}
                </button>
              </div>
              <div className="rounded-xl border border-[#d4e1db] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <dt className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Top signal</dt>
                <dd className="mt-1 text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{topDimension}</dd>
                <button
                  type="button"
                  onClick={() => openPipelineView('topSignal')}
                  className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                >
                  {pipelineDrawerCopy.topSignal.actionLabel}
                </button>
              </div>
            </dl>

            <div className="mt-4 rounded-2xl border border-[#d4e1db] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">
                Capability band counts
              </p>
              <div className="mt-2 space-y-2">
                {bandCounts.map((entry) => (
                  <div
                    key={entry.band}
                    className="flex items-center justify-between text-sm font-medium text-[#2f4d44] dark:text-slate-300"
                  >
                    <span>{entry.band}</span>
                    <span>{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {filteredPool.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[#d4e1db] bg-white px-3 py-2 text-xs font-medium text-[#4f6a62] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No opted-in students match the current filter combination.
              </p>
            ) : null}
          </Card>

          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80"
            header={
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                    Alignment score distribution
                  </p>
                  <div className="group relative">
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c4d5ce] text-[11px] font-bold text-[#36524a] dark:border-slate-600 dark:text-slate-300"
                      aria-label="How to read alignment score distribution"
                    >
                      i
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-7 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-[#d2dfd9] bg-white p-3 text-xs leading-5 text-[#3f5a52] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:left-auto sm:right-0 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    >
                      Students are grouped into score bands after applying all filters. Taller bars mean more opted-in
                      students in that readiness range, so you can quickly see whether your pipeline is skewed toward
                      developing or ready talent.
                    </div>
                  </div>
                </div>
                <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Opted-in pool</h3>
              </div>
            }
          >
            <div className="space-y-3">
              {distribution.map((range) => {
                const barWidth = range.count === 0 ? 0 : Math.max((range.count / maxDistributionCount) * 100, 8);

                return (
                  <div key={range.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#4a655d] dark:text-slate-400">
                      <span>{range.label}</span>
                      <span>{range.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#dbe7e1] dark:bg-slate-700">
                      <div className="h-full rounded-full bg-[#12f987]" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-[#d3e0da] bg-[#f4faf7] p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#47635a] dark:text-slate-400">
                  Agent recommendations
                </p>
                <p className="text-[11px] font-medium text-[#5a766d] dark:text-slate-500">Based on: {activeFilterSummary}</p>
              </div>
              <div className="mt-3 space-y-2">
                {distributionRecommendations.map((recommendation) => (
                  <article
                    key={recommendation.id}
                    className="rounded-xl border border-[#d6e2dc] bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{recommendation.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#48635b] dark:text-slate-300">{recommendation.detail}</p>
                    <button
                      type="button"
                      onClick={() => runRecommendationAction(recommendation.action)}
                      className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                    >
                      {recommendation.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </Card>

          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80"
            header={
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                  Capability heatmap
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">
                  Skill strength by capability dimension
                </h3>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] gap-1.5 text-xs">
                  <div />
                  {capabilityDimensions.map((dimension) => (
                    <div
                      key={`dimension-${dimension.key}`}
                      className="flex min-h-[38px] items-center justify-center rounded-lg border border-[#d7e3dd] bg-[#f4faf7] px-1.5 py-1.5 text-center text-[11px] font-semibold leading-tight text-[#39554d] break-words dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {dimension.label}
                    </div>
                  ))}

                  {heatmap.map((row) => (
                    <div
                      key={row.id}
                      className="contents"
                    >
                      <div className="rounded-lg border border-[#d7e3dd] bg-white px-2.5 py-1.5 font-medium text-[#304d44] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {row.label}
                      </div>
                      {row.cells.map((cell) => (
                        <div
                          key={`${row.id}-${cell.dimensionKey}`}
                          className={`rounded-lg px-1.5 py-1.5 text-center text-sm font-semibold ${getHeatCellClassName(cell.value)}`}
                        >
                          {cell.value === 0 ? '--' : cell.value}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#d3e0da] bg-[#f4faf7] p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#47635a] dark:text-slate-400">
                  Agent recommendations
                </p>
                <p className="text-[11px] font-medium text-[#5a766d] dark:text-slate-500">Based on: {activeFilterSummary}</p>
              </div>
              <div className="mt-3 space-y-2">
                {heatmapRecommendations.map((recommendation) => (
                  <article
                    key={recommendation.id}
                    className="rounded-xl border border-[#d6e2dc] bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-sm font-semibold text-[#0f2b23] dark:text-slate-100">{recommendation.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#48635b] dark:text-slate-300">{recommendation.detail}</p>
                    <button
                      type="button"
                      onClick={() => runRecommendationAction(recommendation.action)}
                      className="mt-2 text-xs font-semibold text-[#1f5b49] underline decoration-[#9acbb8] decoration-2 underline-offset-2 transition-colors hover:text-[#134334] dark:text-emerald-300 dark:decoration-emerald-500/40 dark:hover:text-emerald-200"
                    >
                      {recommendation.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </Card>

        </div>
      </div>

      {activePipelineView ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#0a1f1a]/55" onClick={closePipelineView} aria-hidden={false}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-drawer-title"
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#d2dfd9] bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4f6a62] dark:text-slate-400">
                  Current pipeline
                </p>
                <h3 id="pipeline-drawer-title" className="mt-1 text-2xl font-semibold text-[#0a1f1a] dark:text-slate-100">
                  {pipelineDrawerCopy[activePipelineView].title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#415c54] dark:text-slate-300">
                  {pipelineDrawerCopy[activePipelineView].description}
                </p>
              </div>
              <button
                type="button"
                onClick={closePipelineView}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#315148] transition-colors hover:bg-[#edf5f1] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#c8d8d1] bg-[#f5faf8] px-3 py-1 text-xs font-semibold text-[#38564d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Filters: {activeFilterSummary}
              </span>
              <span className="rounded-full border border-[#c8d8d1] bg-[#f5faf8] px-3 py-1 text-xs font-semibold text-[#38564d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Students shown: {pipelineCandidates.length}
              </span>
            </div>

            {pipelineCandidates.length === 0 ? (
              <p className="mt-6 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-4 py-3 text-sm font-medium text-[#48635b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {pipelineDrawerCopy[activePipelineView].emptyText}
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {pipelineCandidates.map((student) => (
                  <article
                    key={`pipeline-candidate-${student.id}`}
                    className="rounded-2xl border border-[#d4e1db] bg-[#f8fcfa] p-4 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[#0f2b23] dark:text-slate-100">
                          {getCandidateLabel(student.id)}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">
                          {student.university}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">
                          Alignment score
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">
                          {student.alignmentScore}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#c9d9d2] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f4d44] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {student.targetRole}
                      </span>
                      <span className="rounded-full border border-[#b6ebcb] bg-[#e9fef3] px-2.5 py-1 text-xs font-semibold text-[#0b3b2a] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {student.capabilityBand}
                      </span>
                      <span className="rounded-full border border-[#c9d9d2] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f4d44] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        Top: {getTopCapabilityLabels(student.dimensions).join(' · ')}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#d4e1db] pt-4 dark:border-slate-700">
              <button
                type="button"
                className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold text-[#224238] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Save segment
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold text-[#224238] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Export CSV
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold text-[#224238] transition-colors hover:bg-[#edf5f1] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Add to shortlist
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
