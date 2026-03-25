import { type DragEvent, useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type TimelineYearNumber = number;
type MilestoneType = 'course' | 'club' | 'certification' | 'project' | 'internship';
type MilestoneFilter = 'all' | MilestoneType;

type Milestone = {
  id: string;
  title: string;
  type: MilestoneType;
  description: string;
  alignmentLift: number;
  recommendedYearNumber: number;
  effort: string;
  signalTags: string[];
};

type DragLocation = { kind: 'timeline'; yearNumber: TimelineYearNumber } | { kind: 'recommendations' };

type DragPayload = {
  milestoneId: string;
  from: DragLocation;
};

const milestoneTypeLabelMap: Record<MilestoneType, string> = {
  course: 'Course',
  club: 'Club',
  certification: 'Certification',
  project: 'Project',
  internship: 'Internship'
};

const milestoneTypeToneClass: Record<MilestoneType, string> = {
  course: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  club: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  certification: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100',
  project: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  internship: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-100'
};

const milestoneCatalog: Milestone[] = [
  {
    id: 'pln-1',
    title: 'Data Systems Foundations',
    type: 'course',
    description: 'Take a systems-focused course and publish a short design rationale artifact.',
    alignmentLift: 4,
    recommendedYearNumber: 1,
    effort: '8 weeks',
    signalTags: ['Technical depth', 'Systems thinking']
  },
  {
    id: 'pln-2',
    title: 'Join Data Club Project Pod',
    type: 'club',
    description: 'Work with a team on a real dataset and present outcomes at semester showcase.',
    alignmentLift: 3,
    recommendedYearNumber: 1,
    effort: '12 weeks',
    signalTags: ['Collaboration signal', 'Applied execution']
  },
  {
    id: 'pln-3',
    title: 'SQL Practitioner Certification',
    type: 'certification',
    description: 'Validate query fluency and optimization fundamentals with provider-backed evidence.',
    alignmentLift: 4,
    recommendedYearNumber: 2,
    effort: '4 weeks',
    signalTags: ['Technical depth', 'Reliability signal']
  },
  {
    id: 'pln-4',
    title: 'Pipeline Reliability Portfolio Project',
    type: 'project',
    description: 'Build an ingestion pipeline with monitoring, retries, and incident notes.',
    alignmentLift: 6,
    recommendedYearNumber: 2,
    effort: '6 weeks',
    signalTags: ['Applied execution', 'Execution reliability']
  },
  {
    id: 'pln-5',
    title: 'Company X Annual Hackathon',
    type: 'club',
    description: 'Compete in a timed challenge and submit an implementation + reflection summary.',
    alignmentLift: 5,
    recommendedYearNumber: 2,
    effort: '1 week',
    signalTags: ['Applied execution', 'Collaboration signal']
  },
  {
    id: 'pln-6',
    title: 'Distributed Data Engineering',
    type: 'course',
    description: 'Complete a distributed systems course with benchmark and tradeoff writeup.',
    alignmentLift: 5,
    recommendedYearNumber: 3,
    effort: '10 weeks',
    signalTags: ['Systems thinking', 'Technical depth']
  },
  {
    id: 'pln-7',
    title: 'Cloud Platform Associate',
    type: 'certification',
    description: 'Upload cloud architecture and platform reliability credentials.',
    alignmentLift: 4,
    recommendedYearNumber: 3,
    effort: '5 weeks',
    signalTags: ['Execution reliability', 'Technical depth']
  },
  {
    id: 'pln-8',
    title: 'Open Source Data Tool Contribution',
    type: 'project',
    description: 'Contribute one accepted pull request and document decision rationale.',
    alignmentLift: 4,
    recommendedYearNumber: 3,
    effort: '3 weeks',
    signalTags: ['Technical depth', 'Communication signal']
  },
  {
    id: 'pln-9',
    title: 'Signal-Aligned Internship',
    type: 'internship',
    description: 'Complete internship evidence packet with manager-verified outcomes.',
    alignmentLift: 7,
    recommendedYearNumber: 4,
    effort: '10 weeks',
    signalTags: ['Execution reliability', 'Collaboration signal']
  },
  {
    id: 'pln-10',
    title: 'Capstone: Production Readiness Review',
    type: 'project',
    description: 'Run a full readiness review and publish architecture + delivery lessons learned.',
    alignmentLift: 6,
    recommendedYearNumber: 4,
    effort: '8 weeks',
    signalTags: ['Systems thinking', 'Execution reliability']
  }
];

const milestoneById: Record<string, Milestone> = milestoneCatalog.reduce(
  (lookup, milestone) => {
    lookup[milestone.id] = milestone;
    return lookup;
  },
  {} as Record<string, Milestone>
);

const dragPayloadKey = 'application/x-stu-pathway-milestone';

const cloneSchedule = (schedule: Record<TimelineYearNumber, string[]>, timelineYearNumbers: TimelineYearNumber[]) => {
  return timelineYearNumbers.reduce(
    (next, year) => {
      next[year] = [...schedule[year]];
      return next;
    },
    {} as Record<TimelineYearNumber, string[]>
  );
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toYearLabel = (yearNumber: number) => `Year ${yearNumber}`;

const buildTimelineYearNumbers = (currentAcademicYear: number, yearsToGraduation: number) =>
  Array.from({ length: yearsToGraduation }, (_, index) => currentAcademicYear + index);

const clampToTimelineYear = (
  targetYearNumber: number,
  timelineStartYear: number,
  timelineEndYear: number
): TimelineYearNumber => clamp(targetYearNumber, timelineStartYear, timelineEndYear);

const createInitialPlannerState = (timelineYearNumbers: TimelineYearNumber[]) => {
  const timelineStartYear = timelineYearNumbers[0];
  const timelineEndYear = timelineYearNumbers[timelineYearNumbers.length - 1];
  const seedMilestoneIds = ['pln-1', 'pln-2', 'pln-3'];

  const scheduleByYear = timelineYearNumbers.reduce(
    (next, yearNumber) => {
      next[yearNumber] = [];
      return next;
    },
    {} as Record<TimelineYearNumber, string[]>
  );

  seedMilestoneIds.forEach((milestoneId) => {
    const milestone = milestoneById[milestoneId];
    if (!milestone) return;
    const clampedYear = clampToTimelineYear(milestone.recommendedYearNumber, timelineStartYear, timelineEndYear);
    scheduleByYear[clampedYear].push(milestoneId);
  });

  const scheduledAtStart = new Set(Object.values(scheduleByYear).flat());
  const recommendationIds = milestoneCatalog.map((milestone) => milestone.id).filter((id) => !scheduledAtStart.has(id));

  return { scheduleByYear, recommendationIds };
};

const parseDragPayload = (rawPayload: string): DragPayload | null => {
  try {
    const parsed = JSON.parse(rawPayload) as DragPayload;
    if (!parsed.milestoneId || !milestoneById[parsed.milestoneId]) return null;
    if (!parsed.from || (parsed.from.kind !== 'timeline' && parsed.from.kind !== 'recommendations')) return null;
    if (parsed.from.kind === 'timeline' && typeof parsed.from.yearNumber !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

export interface StudentPathwayPlannerProps {
  targetProfileLabel?: string;
  baselineAlignmentScore?: number;
  currentAcademicYear?: number;
  yearsToGraduation?: number;
}

export const StudentPathwayPlanner = ({
  targetProfileLabel = 'Entry-Level Data Engineer',
  baselineAlignmentScore = 61,
  currentAcademicYear = 1,
  yearsToGraduation = 4
}: StudentPathwayPlannerProps) => {
  const normalizedCurrentAcademicYear = Math.max(1, Math.floor(currentAcademicYear));
  const normalizedYearsToGraduation = clamp(Math.floor(yearsToGraduation), 1, 8);
  const timelineYearNumbers = useMemo(
    () => buildTimelineYearNumbers(normalizedCurrentAcademicYear, normalizedYearsToGraduation),
    [normalizedCurrentAcademicYear, normalizedYearsToGraduation]
  );
  const timelineStartYear = timelineYearNumbers[0];
  const timelineEndYear = timelineYearNumbers[timelineYearNumbers.length - 1];

  const initialPlannerState = useMemo(() => createInitialPlannerState(timelineYearNumbers), [timelineYearNumbers]);

  const [scheduledByYear, setScheduledByYear] = useState<Record<TimelineYearNumber, string[]>>(() =>
    cloneSchedule(initialPlannerState.scheduleByYear, timelineYearNumbers)
  );
  const [recommendationIds, setRecommendationIds] = useState<string[]>(() => [...initialPlannerState.recommendationIds]);
  const [activeFilter, setActiveFilter] = useState<MilestoneFilter>('all');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Drag milestones onto any year row to build your graduation plan.');

  const yearMilestones = useMemo(() => {
    return timelineYearNumbers.reduce(
      (mapped, yearNumber) => {
        mapped[yearNumber] = scheduledByYear[yearNumber].map((id) => milestoneById[id]).filter(Boolean);
        return mapped;
      },
      {} as Record<TimelineYearNumber, Milestone[]>
    );
  }, [scheduledByYear, timelineYearNumbers]);

  const totalPlannedLift = useMemo(() => {
    return timelineYearNumbers.reduce(
      (sum, yearNumber) => sum + yearMilestones[yearNumber].reduce((inner, milestone) => inner + milestone.alignmentLift, 0),
      0
    );
  }, [timelineYearNumbers, yearMilestones]);

  const projectedGraduationAlignment = clamp(baselineAlignmentScore + totalPlannedLift, baselineAlignmentScore, 95);

  const unscheduledLiftPotential = useMemo(() => {
    return recommendationIds.reduce((sum, milestoneId) => sum + milestoneById[milestoneId].alignmentLift, 0);
  }, [recommendationIds]);

  const topRecommendedMilestone = useMemo(() => {
    const candidates = recommendationIds.map((id) => milestoneById[id]).filter(Boolean);
    if (candidates.length === 0) return null;
    return [...candidates].sort((first, second) => second.alignmentLift - first.alignmentLift)[0];
  }, [recommendationIds]);

  const filteredRecommendations = useMemo(() => {
    return recommendationIds
      .map((id) => milestoneById[id])
      .filter((milestone) => (activeFilter === 'all' ? true : milestone.type === activeFilter))
      .sort((first, second) => second.alignmentLift - first.alignmentLift);
  }, [activeFilter, recommendationIds]);

  const moveMilestone = (milestoneId: string, destination: DragLocation) => {
    const milestone = milestoneById[milestoneId];
    if (!milestone) return;

    if (destination.kind === 'recommendations') {
      setScheduledByYear((current) => {
        const next = cloneSchedule(current, timelineYearNumbers);
        timelineYearNumbers.forEach((yearNumber) => {
          next[yearNumber] = next[yearNumber].filter((id) => id !== milestoneId);
        });
        return next;
      });

      setRecommendationIds((current) => {
        if (current.includes(milestoneId)) return current;
        return [milestoneId, ...current];
      });

      setStatusMessage(`Moved to recommendations: ${milestone.title}.`);
      return;
    }

    const targetYearNumber = destination.yearNumber;

    setScheduledByYear((current) => {
      const next = cloneSchedule(current, timelineYearNumbers);
      timelineYearNumbers.forEach((yearNumber) => {
        next[yearNumber] = next[yearNumber].filter((id) => id !== milestoneId);
      });
      next[targetYearNumber] = [...next[targetYearNumber], milestoneId];
      return next;
    });

    setRecommendationIds((current) => current.filter((id) => id !== milestoneId));
    setStatusMessage(
      `Added to ${toYearLabel(targetYearNumber)}: ${milestone.title}. Projected alignment +${milestone.alignmentLift}% if completed with strong evidence.`
    );
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, milestoneId: string, from: DragLocation) => {
    const payload: DragPayload = { milestoneId, from };
    event.dataTransfer.setData(dragPayloadKey, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLElement>, destination: DragLocation) => {
    event.preventDefault();
    setDragOverTarget(null);

    const payload = parseDragPayload(event.dataTransfer.getData(dragPayloadKey));
    if (!payload) return;

    if (destination.kind === 'timeline' && payload.from.kind === 'timeline' && payload.from.yearNumber === destination.yearNumber) {
      return;
    }

    moveMilestone(payload.milestoneId, destination);
  };

  const handleYearDragOver = (event: DragEvent<HTMLDivElement>, yearNumber: TimelineYearNumber) => {
    event.preventDefault();
    setDragOverTarget(`year-${yearNumber}`);
  };

  const handleRecommendationDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverTarget('recommendations');
  };

  const addRecommendedMilestone = (milestone: Milestone) => {
    const recommendedYearNumber = clampToTimelineYear(milestone.recommendedYearNumber, timelineStartYear, timelineEndYear);
    moveMilestone(milestone.id, { kind: 'timeline', yearNumber: recommendedYearNumber });
  };

  const moveToNextYear = (milestone: Milestone, currentYearNumber: TimelineYearNumber) => {
    const currentIndex = timelineYearNumbers.findIndex((yearNumber) => yearNumber === currentYearNumber);
    if (currentIndex < 0 || currentIndex === timelineYearNumbers.length - 1) {
      setStatusMessage(`${milestone.title} is already in your final planned year.`);
      return;
    }

    moveMilestone(milestone.id, { kind: 'timeline', yearNumber: timelineYearNumbers[currentIndex + 1] });
  };

  return (
    <section aria-labelledby="student-pathway-planner-title" className="w-full px-4 py-6 lg:px-8 lg:py-12">
      <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">
              Graduation timeline planner
            </p>
            <h2
              id="student-pathway-planner-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Graduation timeline planner with hiring-signal guidance
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Build a plan from your current year through graduation. Each year is a scrollable row so you can manage
              many milestones while keeping progression clear.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/35">
              Coming Soon
            </Badge>
            <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
              Target: {targetProfileLabel}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card
            className="bg-white/95 p-4 dark:bg-slate-900/80"
            header={<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">Current signal</h3>}
          >
            <p className="text-3xl font-semibold text-[#0f2b23] dark:text-slate-100">{baselineAlignmentScore}</p>
            <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">
              Baseline alignment before adding new pathway milestones.
            </p>
          </Card>

          <Card
            className="bg-white/95 p-4 dark:bg-slate-900/80"
            header={<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">Projected by graduation</h3>}
          >
            <p className="text-3xl font-semibold text-[#0f2b23] dark:text-slate-100">{projectedGraduationAlignment}</p>
            <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">
              Current plan adds an estimated +{totalPlannedLift}% alignment lift.
            </p>
          </Card>

          <Card
            className="bg-white/95 p-4 dark:bg-slate-900/80"
            header={<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">Recommender cue</h3>}
          >
            {topRecommendedMilestone ? (
              <>
                <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{topRecommendedMilestone.title}</p>
                <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">
                  Add this to increase your alignment score by {topRecommendedMilestone.alignmentLift}%.
                </p>
                <Button type="button" size="sm" className="mt-3 w-full" onClick={() => addRecommendedMilestone(topRecommendedMilestone)}>
                  Add to {toYearLabel(clampToTimelineYear(topRecommendedMilestone.recommendedYearNumber, timelineStartYear, timelineEndYear))}
                </Button>
              </>
            ) : (
              <p className="text-xs text-[#4c6860] dark:text-slate-300">
                All current milestones are scheduled. Potential unscheduled lift remaining +{unscheduledLiftPotential}%.
              </p>
            )}
          </Card>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card
            className="bg-white/95 p-5 dark:bg-slate-900/80"
            header={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Graduation timeline planner</h3>
                <Badge className="bg-[#eef6ff] text-[#1f4f7a] dark:bg-sky-500/20 dark:text-sky-100">
                  Vertical year rows + horizontal milestone lanes
                </Badge>
              </div>
            }
          >
            <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
              {timelineYearNumbers.map((yearNumber) => {
                const milestones = yearMilestones[yearNumber];
                const yearLift = milestones.reduce((sum, milestone) => sum + milestone.alignmentLift, 0);

                return (
                  <div
                    key={`timeline-${yearNumber}`}
                    onDragOver={(event) => handleYearDragOver(event, yearNumber)}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={(event) => handleDrop(event, { kind: 'timeline', yearNumber })}
                    className={`rounded-2xl border px-3 py-3 transition-colors ${
                      dragOverTarget === `year-${yearNumber}`
                        ? 'border-[#0fd978] bg-[#eafff3] dark:border-emerald-500 dark:bg-emerald-500/10'
                        : 'border-[#d4e1db] bg-[#f8fcfa] dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#14372d] dark:text-slate-100">{toYearLabel(yearNumber)}</p>
                      <Badge className="bg-[#eef6f1] text-[#325148] dark:bg-slate-700 dark:text-slate-200">+{yearLift}%</Badge>
                    </div>
                    <p className="mb-2 text-[11px] text-[#4c6860] dark:text-slate-400">
                      Planned milestones: {milestones.length} · Horizontal scroll enabled
                    </p>

                    {milestones.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#c7d8d1] px-2 py-4 text-center text-xs text-[#4c6860] dark:border-slate-700 dark:text-slate-400">
                        Drop milestones here
                      </p>
                    ) : (
                      <div className="overflow-x-auto pb-1">
                        <div className="flex min-w-max gap-2">
                          {milestones.map((milestone) => (
                            <article
                              key={milestone.id}
                              draggable
                              onDragStart={(event) => handleDragStart(event, milestone.id, { kind: 'timeline', yearNumber })}
                              className="w-72 shrink-0 cursor-grab rounded-xl border border-[#d2e0da] bg-white px-2.5 py-2 shadow-[0_10px_16px_-18px_rgba(10,31,26,0.7)] active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-[#10362c] dark:text-slate-100">{milestone.title}</p>
                                <Badge className={milestoneTypeToneClass[milestone.type]}>{milestoneTypeLabelMap[milestone.type]}</Badge>
                              </div>
                              <p className="mt-1 text-[11px] leading-4 text-[#4c6860] dark:text-slate-300">{milestone.description}</p>
                              <p className="mt-1 text-[11px] font-semibold text-[#33544a] dark:text-slate-300">
                                Hiring signal lift +{milestone.alignmentLift}% · {milestone.effort}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {milestone.signalTags.map((tag) => (
                                  <span
                                    key={`${milestone.id}-${tag}`}
                                    className="inline-flex rounded-full bg-[#edf5f1] px-2 py-0.5 text-[10px] font-medium text-[#355149] dark:bg-slate-700 dark:text-slate-200"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Button type="button" size="sm" variant="secondary" onClick={() => moveToNextYear(milestone, yearNumber)}>
                                  Move forward
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => moveMilestone(milestone.id, { kind: 'recommendations' })}>
                                  Unschedule
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4">
            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Recommended milestones</h3>}
            >
              <p className="text-xs text-[#4c6860] dark:text-slate-300">
                Drag from this list into any year row. Or use one-click scheduling to follow the recommended year.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    activeFilter === 'all'
                      ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                      : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  All
                </button>
                {(Object.keys(milestoneTypeLabelMap) as MilestoneType[]).map((type) => (
                  <button
                    key={`filter-${type}`}
                    type="button"
                    onClick={() => setActiveFilter(type)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      activeFilter === type
                        ? 'border-[#0fd978] bg-[#12f987] text-[#0a1f1a]'
                        : 'border-[#c4d5ce] bg-white text-[#3a574e] hover:bg-[#eff6f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {milestoneTypeLabelMap[type]}
                  </button>
                ))}
              </div>

              <div
                className={`mt-3 max-h-[40rem] space-y-2 overflow-y-auto pr-1 ${
                  dragOverTarget === 'recommendations' ? 'rounded-2xl border border-[#0fd978] bg-[#eafff3] p-2 dark:border-emerald-500 dark:bg-emerald-500/10' : ''
                }`}
                onDragOver={handleRecommendationDragOver}
                onDragLeave={() => setDragOverTarget(null)}
                onDrop={(event) => handleDrop(event, { kind: 'recommendations' })}
              >
                {filteredRecommendations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#c7d8d1] px-3 py-4 text-center text-xs text-[#4c6860] dark:border-slate-700 dark:text-slate-400">
                    No milestones in this filter.
                  </p>
                ) : (
                  filteredRecommendations.map((milestone) => (
                    <article
                      key={`recommend-${milestone.id}`}
                      draggable
                      onDragStart={(event) => handleDragStart(event, milestone.id, { kind: 'recommendations' })}
                      className="cursor-grab rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#12382f] dark:text-slate-100">{milestone.title}</p>
                        <Badge className={milestoneTypeToneClass[milestone.type]}>{milestoneTypeLabelMap[milestone.type]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">{milestone.description}</p>
                      <p className="mt-1 text-xs font-medium text-[#3c5a50] dark:text-slate-300">
                        Add this to increase your alignment score by {milestone.alignmentLift}%.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-[#4c6860] dark:text-slate-400">
                          Recommended in {toYearLabel(clampToTimelineYear(milestone.recommendedYearNumber, timelineStartYear, timelineEndYear))} · Effort{' '}
                          {milestone.effort}
                        </p>
                        <Button type="button" size="sm" onClick={() => addRecommendedMilestone(milestone)}>
                          Add to {toYearLabel(clampToTimelineYear(milestone.recommendedYearNumber, timelineStartYear, timelineEndYear))}
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Card>

            <Card
              className="bg-white/95 p-5 dark:bg-slate-900/80"
              header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Plan feedback</h3>}
            >
              <p className="text-sm text-[#4c6860] dark:text-slate-300">{statusMessage}</p>
              <div className="mt-3 rounded-xl border border-[#d4e1db] bg-[#f8fcfa] px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                  Hiring-signal influence
                </p>
                <p className="mt-1 text-xs text-[#4c6860] dark:text-slate-300">
                  Your timeline balances courses, clubs, certifications, projects, and internships. More diverse
                  evidence tends to improve confidence in your alignment progression.
                </p>
                <p className="mt-2 text-xs font-medium text-[#3a594f] dark:text-slate-300">
                  Unscheduled potential still available: +{unscheduledLiftPotential}%.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
