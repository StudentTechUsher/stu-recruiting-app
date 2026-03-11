import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type ImportSource = 'csv' | 'ats' | 'handshake' | 'linkedin';
type AlignmentBand = 'Standout' | 'Ready' | 'Developing' | 'Emerging';

type ExternalCandidateRecord = {
  id: string;
  fullName: string;
  university: string;
  targetRole: string;
  source: ImportSource;
  evidenceNote: string;
  alignmentScore: number;
  alignmentBand: AlignmentBand;
  confidence: number;
  topSignals: string[];
};

const sourceOptions: Array<{ id: ImportSource; label: string; helper: string }> = [
  {
    id: 'csv',
    label: 'CSV upload',
    helper: 'Batch upload from campus partners or ATS exports.'
  },
  {
    id: 'ats',
    label: 'ATS export',
    helper: 'Score historical applicants not currently on stu.'
  },
  {
    id: 'handshake',
    label: 'Handshake import',
    helper: 'Pull early-talent records from Handshake feeds.'
  },
  {
    id: 'linkedin',
    label: 'LinkedIn paste',
    helper: 'Quickly score sourced profiles from external channels.'
  }
];

const sampleImportBySource: Record<ImportSource, string> = {
  csv: [
    'fullName,university,targetRole,sourceContext,evidenceNote',
    'Mina Shah,University of Florida,Product Analyst,Campus Hiring Fair,Led customer analytics capstone project',
    'Noel Ramirez,Temple University,Data Analyst,Career Center Export,Built ETL dashboard for student outcomes',
    'Ari Patel,Virginia Tech,Associate Consultant,University Partner Feed,Presented process redesign to faculty board'
  ].join('\n'),
  ats: [
    'fullName,university,targetRole,sourceContext,evidenceNote',
    'Jordan Ellis,Ohio State University,Data Analyst,Greenhouse Export,Internship project improved KPI reporting by 21%',
    'Reese Morris,Penn State,Product Analyst,Lever Export,Shipped UX experiment with conversion lift',
    'Sky Kim,University of Washington,Associate Consultant,SmartRecruiters Export,Documented and automated onboarding workflow'
  ].join('\n'),
  handshake: [
    'fullName,university,targetRole,sourceContext,evidenceNote',
    'Lena Cho,University of California Irvine,Product Analyst,Handshake Events,Won innovation challenge and presented product case study',
    'Miles Turner,University of North Carolina Charlotte,Data Analyst,Handshake Employer Outreach,Built dashboard for retention trend analysis',
    'Aisha Khan,University of Colorado Boulder,Associate Consultant,Handshake Career Fair,Led operations redesign simulation with peer team'
  ].join('\n'),
  linkedin: [
    'fullName,university,targetRole,sourceContext,evidenceNote',
    'Talia Vaughn,University of Arizona,Product Analyst,LinkedIn Sourcing,Published portfolio walkthrough with business case',
    'Kris Owens,Rutgers University,Data Analyst,LinkedIn Sourcing,Open-source contribution in analytics tooling',
    'Devon Yoon,San Diego State University,Associate Consultant,LinkedIn Sourcing,Led operations sprint for student startup'
  ].join('\n')
};

const capabilitySignals = [
  'Problem solving',
  'Data communication',
  'Execution reliability',
  'Collaboration',
  'Business judgment'
] as const;

const bandClassMap: Record<AlignmentBand, string> = {
  Standout: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  Ready: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-100',
  Developing: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
  Emerging: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100'
};

const getBand = (score: number): AlignmentBand => {
  if (score >= 85) return 'Standout';
  if (score >= 70) return 'Ready';
  if (score >= 55) return 'Developing';
  return 'Emerging';
};

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }

  return hash;
};

const parseImportedCandidates = (rawText: string, source: ImportSource): ExternalCandidateRecord[] => {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const normalizedRows = lines[0].toLowerCase().includes('fullname') ? lines.slice(1) : lines;
  const parsed: ExternalCandidateRecord[] = [];

  normalizedRows.forEach((row, rowIndex) => {
    const columns = row.split(',').map((value) => value.trim());
    if (columns.length < 4) return;

    const [fullName, university, targetRole, sourceContext, evidenceNote = 'No additional note provided'] = columns;
    if (!fullName || !university || !targetRole) return;

    const hash = hashString(`${fullName}|${university}|${targetRole}|${sourceContext}|${evidenceNote}|${source}`);
    const alignmentScore = 55 + (hash % 42);
    const confidence = 61 + (hash % 35);

    const firstSignalIndex = hash % capabilitySignals.length;
    const secondSignalIndex = (hash + 2) % capabilitySignals.length;

    parsed.push({
      id: `external-${source}-${rowIndex}-${hash}`,
      fullName,
      university,
      targetRole,
      source,
      evidenceNote,
      alignmentScore,
      alignmentBand: getBand(alignmentScore),
      confidence,
      topSignals: [capabilitySignals[firstSignalIndex], capabilitySignals[secondSignalIndex]]
    });
  });

  return parsed;
};

export const RecruiterImportScoringWorkbench = () => {
  const [selectedSource, setSelectedSource] = useState<ImportSource>('csv');
  const [importBody, setImportBody] = useState(sampleImportBySource.csv);
  const [scoredCandidates, setScoredCandidates] = useState<ExternalCandidateRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (scoredCandidates.length === 0) {
      return {
        averageScore: 0,
        standoutCount: 0,
        readyPlusCount: 0
      };
    }

    const averageScore = Math.round(
      scoredCandidates.reduce((sum, candidate) => sum + candidate.alignmentScore, 0) / scoredCandidates.length
    );
    const standoutCount = scoredCandidates.filter((candidate) => candidate.alignmentBand === 'Standout').length;
    const readyPlusCount = scoredCandidates.filter(
      (candidate) => candidate.alignmentBand === 'Standout' || candidate.alignmentBand === 'Ready'
    ).length;

    return {
      averageScore,
      standoutCount,
      readyPlusCount
    };
  }, [scoredCandidates]);

  const loadSampleForSource = (source: ImportSource) => {
    setSelectedSource(source);
    setImportBody(sampleImportBySource[source]);
    setStatusMessage(`Loaded ${sourceOptions.find((option) => option.id === source)?.label.toLowerCase()} sample records.`);
  };

  const runScoring = () => {
    const parsed = parseImportedCandidates(importBody, selectedSource);

    if (parsed.length === 0) {
      setScoredCandidates([]);
      setStatusMessage('No valid rows found. Use comma-separated values with fullName, university, and targetRole.');
      return;
    }

    setScoredCandidates(parsed);
    setStatusMessage(`Generated alignment scores for ${parsed.length} off-platform candidates.`);
  };

  return (
    <section aria-labelledby="external-candidate-scoring-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfded7] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
              Recruiter Scoring Layer
            </p>
            <h2
              id="external-candidate-scoring-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Import and score off-platform students
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              Recruiters can import student records that are not yet on Stu and generate alignment scores against the
              same capability model used for opted-in candidates.
            </p>
          </div>
          <Badge className="bg-[#e9fef3] text-[#0a402d] ring-1 ring-[#b8e9ce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
            Score any candidate
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sourceOptions.map((option) => {
            const isActive = selectedSource === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => loadSampleForSource(option.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-[#0fd978] bg-[#ecfff5] dark:border-emerald-500 dark:bg-emerald-500/10'
                    : 'border-[#d4e1db] bg-white hover:bg-[#f2f8f5] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <p className="text-sm font-semibold text-[#12392f] dark:text-slate-100">{option.label}</p>
                <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-300">{option.helper}</p>
              </button>
            );
          })}
        </div>

        <Card
          className="mt-4 bg-white/95 dark:bg-slate-900/80"
          header={
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                External candidate import
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Import records</h3>
            </div>
          }
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
            Paste records
            <textarea
              value={importBody}
              onChange={(event) => setImportBody(event.target.value)}
              className="mt-2 min-h-40 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="fullName,university,targetRole,sourceContext,evidenceNote"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={runScoring}>
              Generate alignment scores
            </Button>
            <Button type="button" variant="secondary" onClick={() => setImportBody(sampleImportBySource[selectedSource])}>
              Reload sample
            </Button>
          </div>

          <p className="mt-3 text-xs text-[#48645c] dark:text-slate-300">
            Expected format: <span className="font-semibold">fullName, university, targetRole, sourceContext, evidenceNote</span>
          </p>

          {statusMessage ? (
            <p className="mt-3 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {statusMessage}
            </p>
          ) : null}
        </Card>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Card className="bg-white/95 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Scored records</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{scoredCandidates.length}</p>
          </Card>
          <Card className="bg-white/95 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Avg score</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{summary.averageScore}</p>
          </Card>
          <Card className="bg-white/95 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-[0.08em] text-[#547067] dark:text-slate-400">Ready+ candidates</p>
            <p className="mt-1 text-2xl font-semibold text-[#0f2b23] dark:text-slate-100">{summary.readyPlusCount}</p>
          </Card>
        </div>

        <Card
          className="mt-4 bg-white/95 dark:bg-slate-900/80"
          header={
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#55736a] dark:text-slate-400">
                  Scored off-platform candidates
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Alignment output</h3>
              </div>
              <Badge>{summary.standoutCount} standout</Badge>
            </div>
          }
        >
          {scoredCandidates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#c8d7d1] bg-[#f7fcf9] px-4 py-6 text-sm text-[#4f6a62] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No scores yet. Import records and run scoring to create an external candidate alignment cut.
            </p>
          ) : (
            <div className="space-y-3">
              {scoredCandidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="rounded-2xl border border-[#d4e1db] bg-[#f8fcfa] p-4 dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#0f2b23] dark:text-slate-100">{candidate.fullName}</p>
                      <p className="mt-1 text-xs text-[#4a665e] dark:text-slate-300">
                        {candidate.targetRole} · {candidate.university}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={bandClassMap[candidate.alignmentBand]}>{candidate.alignmentBand}</Badge>
                      <p className="mt-1 text-sm font-semibold text-[#15382f] dark:text-slate-100">Score {candidate.alignmentScore}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#c9d9d2] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f4d44] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      Source: {candidate.source.toUpperCase()}
                    </span>
                    <span className="rounded-full border border-[#c9d9d2] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f4d44] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      Confidence {candidate.confidence}%
                    </span>
                    <span className="rounded-full border border-[#c9d9d2] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f4d44] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      Top: {candidate.topSignals.join(' · ')}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#48635b] dark:text-slate-300">Evidence note: {candidate.evidenceNote}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};
