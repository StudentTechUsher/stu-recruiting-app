import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type ScoreDimension = 'clarity' | 'structure' | 'evidence' | 'roleAlignment';

type DimensionScores = Record<ScoreDimension, number>;

type EmployerCompany = {
  id: string;
  name: string;
  roleTrack: string;
  reviewSla: string;
  questionThemes: string[];
};

type InterviewQuestion = {
  id: string;
  companyId: string;
  employerPrompt: string;
  adaptedPrompt: string;
  focusSignals: string[];
};

type EvaluatedResponse = {
  questionId: string;
  companyId: string;
  response: string;
  overallScore: number;
  scores: DimensionScores;
  strengths: string[];
  improvements: string[];
};

type InterviewSessionStatus = 'in-progress' | 'completed';

type InterviewSessionRecord = {
  id: string;
  status: InterviewSessionStatus;
  startedAt: string;
  completedAt?: string;
  sharedCompanyIds: string[];
  questionIds: string[];
  responses: EvaluatedResponse[];
  averageScore: number | null;
  dimensionAverages: DimensionScores | null;
  summary: string;
};

type ActiveSessionState = {
  sessionId: string;
  questionIds: string[];
  currentQuestionIndex: number;
  responses: EvaluatedResponse[];
};

export interface StudentInterviewPrepProps {
  studentName?: string;
  targetRole?: string;
  defaultOptedInCompanyIds?: string[];
}

const companies: EmployerCompany[] = [
  {
    id: 'atlas-analytics',
    name: 'Atlas Analytics',
    roleTrack: 'Data Analyst track',
    reviewSla: 'Reviews within 72 hours',
    questionThemes: ['KPI tradeoffs', 'Stakeholder communication', 'Experiment framing']
  },
  {
    id: 'northstar-fintech',
    name: 'Northstar Fintech',
    roleTrack: 'Junior Product Ops track',
    reviewSla: 'Reviews weekly',
    questionThemes: ['Operational reliability', 'Root-cause thinking', 'Cross-team execution']
  },
  {
    id: 'veridian-cloud',
    name: 'Veridian Cloud',
    roleTrack: 'Associate Data Engineering track',
    reviewSla: 'Reviews within 5 business days',
    questionThemes: ['Pipeline ownership', 'Monitoring design', 'Incident response']
  }
];

const questionBank: InterviewQuestion[] = [
  {
    id: 'atlas-q1',
    companyId: 'atlas-analytics',
    employerPrompt: 'Tell us about a time you changed a KPI recommendation after new evidence came in.',
    adaptedPrompt:
      'Describe one project where your first recommendation changed after data contradicted your assumption. What changed and why?',
    focusSignals: ['assumption', 'evidence', 'stakeholder', 'tradeoff']
  },
  {
    id: 'atlas-q2',
    companyId: 'atlas-analytics',
    employerPrompt: 'How do you explain model uncertainty to non-technical partners?',
    adaptedPrompt:
      'A hiring manager asks why your confidence band is wide. Walk through how you explain uncertainty without losing trust.',
    focusSignals: ['uncertainty', 'confidence', 'clarity', 'decision']
  },
  {
    id: 'northstar-q1',
    companyId: 'northstar-fintech',
    employerPrompt: 'Share an example of leading process improvement with limited authority.',
    adaptedPrompt:
      'You discover a handoff issue slowing a team you do not manage. How would you drive a fix and show measurable impact?',
    focusSignals: ['handoff', 'alignment', 'impact', 'measurement']
  },
  {
    id: 'northstar-q2',
    companyId: 'northstar-fintech',
    employerPrompt: 'How do you triage operational incidents under pressure?',
    adaptedPrompt:
      'A workflow fails during a high-volume period. Explain your first 30 minutes, including communication and mitigation steps.',
    focusSignals: ['priority', 'communication', 'mitigation', 'follow-up']
  },
  {
    id: 'veridian-q1',
    companyId: 'veridian-cloud',
    employerPrompt: 'Describe your approach to designing monitorable data pipelines.',
    adaptedPrompt:
      'You are building an ingestion pipeline for weekly forecasting. How do you design alerts and runbooks so issues are easy to detect and recover?',
    focusSignals: ['pipeline', 'alerts', 'runbook', 'reliability']
  },
  {
    id: 'veridian-q2',
    companyId: 'veridian-cloud',
    employerPrompt: 'Tell us about a production bug you owned and fixed.',
    adaptedPrompt:
      'Walk through one bug you owned end-to-end: detection, diagnosis, fix, and prevention. Include what you changed after the incident.',
    focusSignals: ['detection', 'diagnosis', 'ownership', 'prevention']
  }
];

const dimensionLabels: Record<ScoreDimension, string> = {
  clarity: 'Clarity',
  structure: 'Structure',
  evidence: 'Evidence',
  roleAlignment: 'Role alignment'
};

const dimensionToneClass: Record<ScoreDimension, string> = {
  clarity: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100',
  structure: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100',
  evidence: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  roleAlignment: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100'
};

const clampScore = (score: number) => Math.max(0, Math.min(Math.round(score), 100));

const formatDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const calculateDimensionAverages = (responses: EvaluatedResponse[]): DimensionScores => {
  const totals: DimensionScores = {
    clarity: 0,
    structure: 0,
    evidence: 0,
    roleAlignment: 0
  };

  responses.forEach((response) => {
    totals.clarity += response.scores.clarity;
    totals.structure += response.scores.structure;
    totals.evidence += response.scores.evidence;
    totals.roleAlignment += response.scores.roleAlignment;
  });

  const count = Math.max(1, responses.length);
  return {
    clarity: clampScore(totals.clarity / count),
    structure: clampScore(totals.structure / count),
    evidence: clampScore(totals.evidence / count),
    roleAlignment: clampScore(totals.roleAlignment / count)
  };
};

const calculateAverageScore = (responses: EvaluatedResponse[]) => {
  if (responses.length === 0) return null;
  const total = responses.reduce((sum, response) => sum + response.overallScore, 0);
  return clampScore(total / responses.length);
};

const evaluateResponse = (question: InterviewQuestion, response: string): EvaluatedResponse => {
  const normalized = response.toLowerCase();
  const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
  const starCoverage = ['situation', 'task', 'action', 'result'].reduce(
    (count, keyword) => (normalized.includes(keyword) ? count + 1 : count),
    0
  );
  const sequenceSignals = ['first', 'then', 'after', 'finally'].reduce(
    (count, keyword) => (normalized.includes(keyword) ? count + 1 : count),
    0
  );
  const quantifiedSignals = (normalized.match(/\b\d+(\.\d+)?%?\b/g) ?? []).length;
  const focusSignalHits = question.focusSignals.reduce(
    (count, signal) => (normalized.includes(signal.toLowerCase()) ? count + 1 : count),
    0
  );

  const clarity = clampScore(46 + Math.min(wordCount, 220) * 0.16 + (normalized.includes('because') ? 4 : 0));
  const structure = clampScore(40 + starCoverage * 10 + sequenceSignals * 4);
  const evidence = clampScore(35 + quantifiedSignals * 11 + (normalized.includes('example') ? 5 : 0));
  const roleAlignment = clampScore(42 + focusSignalHits * 10 + (normalized.includes('team') ? 4 : 0));

  const weightedScore = clampScore(clarity * 0.24 + structure * 0.27 + evidence * 0.27 + roleAlignment * 0.22);
  const scores: DimensionScores = { clarity, structure, evidence, roleAlignment };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (structure >= 72) strengths.push('Clear sequence made the response easy to follow.');
  if (evidence >= 72) strengths.push('Included concrete evidence and measurable outcomes.');
  if (roleAlignment >= 72) strengths.push('Connected examples to employer priorities.');
  if (clarity >= 72) strengths.push('Language stayed direct and understandable.');

  if (structure < 65) improvements.push('Use a tighter STAR flow so each answer has clear phases.');
  if (evidence < 65) improvements.push('Add one quantified result to strengthen credibility.');
  if (roleAlignment < 65) improvements.push('Reference the company question themes more explicitly.');
  if (clarity < 65) improvements.push('Reduce long sentences and emphasize cause-and-effect decisions.');

  if (strengths.length === 0) {
    strengths.push('Response addressed the prompt and showed baseline readiness.');
  }
  if (improvements.length === 0) {
    improvements.push('Practice a shorter version to improve delivery under time pressure.');
  }

  return {
    questionId: question.id,
    companyId: question.companyId,
    response,
    overallScore: weightedScore,
    scores,
    strengths,
    improvements
  };
};

const buildSessionQuestionIds = (optedInCompanyIds: string[], existingSessionCount: number) => {
  const uniqueQuestionIds: string[] = [];

  optedInCompanyIds.forEach((companyId, index) => {
    const companyQuestions = questionBank.filter((question) => question.companyId === companyId);
    if (companyQuestions.length === 0) return;
    const seed = existingSessionCount + index;
    const firstQuestion = companyQuestions[seed % companyQuestions.length];
    const secondQuestion = companyQuestions[(seed + 1) % companyQuestions.length];

    uniqueQuestionIds.push(firstQuestion.id);
    if (secondQuestion.id !== firstQuestion.id && uniqueQuestionIds.length < 4) {
      uniqueQuestionIds.push(secondQuestion.id);
    }
  });

  return Array.from(new Set(uniqueQuestionIds)).slice(0, 4);
};

const createMockResponse = (
  questionId: string,
  companyId: string,
  overallScore: number,
  scores: DimensionScores,
  response: string
): EvaluatedResponse => ({
  questionId,
  companyId,
  response,
  overallScore,
  scores,
  strengths: ['Response stayed structured and mapped to employer intent.'],
  improvements: ['Add one more numerical outcome to increase evidence density.']
});

const initialSessionRecords: InterviewSessionRecord[] = [
  {
    id: 'session-2026-02-24-a',
    status: 'completed',
    startedAt: 'Feb 24, 10:12 AM',
    completedAt: 'Feb 24, 10:41 AM',
    sharedCompanyIds: ['atlas-analytics', 'veridian-cloud'],
    questionIds: ['atlas-q2', 'veridian-q1', 'veridian-q2'],
    responses: [
      createMockResponse(
        'atlas-q2',
        'atlas-analytics',
        78,
        { clarity: 80, structure: 77, evidence: 72, roleAlignment: 81 },
        'I explained uncertainty with a confidence range, a simple scenario table, and one recommendation threshold for stakeholder decisions.'
      ),
      createMockResponse(
        'veridian-q1',
        'veridian-cloud',
        74,
        { clarity: 73, structure: 75, evidence: 72, roleAlignment: 77 },
        'I documented alert severity levels and built a runbook that mapped each alert to owner, action, and recovery verification.'
      ),
      createMockResponse(
        'veridian-q2',
        'veridian-cloud',
        76,
        { clarity: 77, structure: 74, evidence: 75, roleAlignment: 78 },
        'I traced a failed transform to a schema change, shipped a guarded parser patch, and added contract tests to prevent recurrence.'
      )
    ],
    averageScore: 76,
    dimensionAverages: {
      clarity: 77,
      structure: 75,
      evidence: 73,
      roleAlignment: 79
    },
    summary: 'Strong role alignment with room to add more quantified evidence.'
  },
  {
    id: 'session-2026-02-17-b',
    status: 'completed',
    startedAt: 'Feb 17, 3:04 PM',
    completedAt: 'Feb 17, 3:26 PM',
    sharedCompanyIds: ['northstar-fintech'],
    questionIds: ['northstar-q1', 'northstar-q2'],
    responses: [
      createMockResponse(
        'northstar-q1',
        'northstar-fintech',
        71,
        { clarity: 72, structure: 69, evidence: 68, roleAlignment: 75 },
        'I coordinated a cross-team fix by setting weekly checkpoints, writing ownership notes, and showing cycle-time reduction after rollout.'
      ),
      createMockResponse(
        'northstar-q2',
        'northstar-fintech',
        69,
        { clarity: 68, structure: 72, evidence: 65, roleAlignment: 71 },
        'I triaged by impact and reversibility, sent immediate updates, and documented a short prevention plan once stability returned.'
      )
    ],
    averageScore: 70,
    dimensionAverages: {
      clarity: 70,
      structure: 71,
      evidence: 67,
      roleAlignment: 73
    },
    summary: 'Solid incident communication; improve quantified impact and precision.'
  }
];

const improvementGuidance: Record<ScoreDimension, string> = {
  clarity: 'Practice 60-second summaries so your main decision and rationale land quickly.',
  structure: 'Use STAR headings in your prep notes and time-box each section.',
  evidence: 'Add at least one metric, baseline, and post-change result in every answer.',
  roleAlignment: 'Echo the employer theme language and show why your example matches that theme.'
};

export const StudentInterviewPrep = ({
  studentName = 'Taylor',
  targetRole = 'Entry-Level Data Engineer',
  defaultOptedInCompanyIds
}: StudentInterviewPrepProps) => {
  const validDefaultOptIns = (defaultOptedInCompanyIds ?? []).filter((companyId) =>
    companies.some((company) => company.id === companyId)
  );

  const [optedInCompanyIds, setOptedInCompanyIds] = useState<string[]>(
    validDefaultOptIns.length > 0 ? validDefaultOptIns : ['atlas-analytics', 'veridian-cloud']
  );
  const [sessions, setSessions] = useState<InterviewSessionRecord[]>(initialSessionRecords);
  const [activeSession, setActiveSession] = useState<ActiveSessionState | null>(null);
  const [draftResponse, setDraftResponse] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionRecords[0]?.id ?? null);

  const questionLookup = useMemo(() => {
    return questionBank.reduce(
      (lookup, question) => {
        lookup[question.id] = question;
        return lookup;
      },
      {} as Record<string, InterviewQuestion>
    );
  }, []);

  const companyLookup = useMemo(() => {
    return companies.reduce(
      (lookup, company) => {
        lookup[company.id] = company;
        return lookup;
      },
      {} as Record<string, EmployerCompany>
    );
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const activeQuestion = useMemo(() => {
    if (!activeSession) return null;
    const questionId = activeSession.questionIds[activeSession.currentQuestionIndex];
    return questionId ? questionLookup[questionId] : null;
  }, [activeSession, questionLookup]);

  const completedSessionCount = sessions.filter((session) => session.status === 'completed').length;
  const averageCompletedScore = useMemo(() => {
    const completedScores = sessions.map((session) => session.averageScore).filter((score): score is number => score !== null);
    if (completedScores.length === 0) return null;
    return clampScore(completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length);
  }, [sessions]);

  const selectedSessionReviewability = useMemo(() => {
    if (!selectedSession) return { reviewable: [] as EmployerCompany[], withheld: [] as EmployerCompany[] };
    const reviewable: EmployerCompany[] = [];
    const withheld: EmployerCompany[] = [];

    selectedSession.sharedCompanyIds.forEach((companyId) => {
      const company = companyLookup[companyId];
      if (!company) return;
      if (optedInCompanyIds.includes(companyId)) reviewable.push(company);
      else withheld.push(company);
    });

    return { reviewable, withheld };
  }, [companyLookup, optedInCompanyIds, selectedSession]);

  const improvementPlan = useMemo(() => {
    if (!selectedSession?.dimensionAverages) return [];

    return (Object.keys(selectedSession.dimensionAverages) as ScoreDimension[])
      .sort((left, right) => selectedSession.dimensionAverages![left] - selectedSession.dimensionAverages![right])
      .slice(0, 2)
      .map((dimension) => ({
        dimension,
        score: selectedSession.dimensionAverages![dimension],
        recommendation: improvementGuidance[dimension]
      }));
  }, [selectedSession]);

  const reviewableCompanyNoun = selectedSessionReviewability.reviewable.length === 1 ? 'company' : 'companies';

  const toggleCompanyOptIn = (companyId: string) => {
    setOptedInCompanyIds((current) => {
      if (current.includes(companyId)) {
        const next = current.filter((id) => id !== companyId);
        setStatusMessage(
          next.length === 0
            ? 'All company sharing is paused. Opt in to at least one employer to start interview sessions.'
            : `Sharing paused for ${companyLookup[companyId]?.name}.`
        );
        return next;
      }

      const next = [...current, companyId];
      setStatusMessage(`Sharing enabled for ${companyLookup[companyId]?.name}. New sessions can be reviewed by this employer.`);
      return next;
    });
  };

  const updateSessionRecord = (sessionId: string, updater: (session: InterviewSessionRecord) => InterviewSessionRecord) => {
    setSessions((current) => current.map((session) => (session.id === sessionId ? updater(session) : session)));
  };

  const startSession = () => {
    if (activeSession) {
      setStatusMessage('Finish your active session before starting a new one.');
      return;
    }

    if (optedInCompanyIds.length === 0) {
      setStatusMessage('Opt in to at least one company so interview responses have a review destination.');
      return;
    }

    const questionIds = buildSessionQuestionIds(optedInCompanyIds, sessions.length);
    if (questionIds.length === 0) {
      setStatusMessage('No question set is available for selected companies.');
      return;
    }

    const sessionId = `session-${Date.now()}`;
    const startedAt = formatDateTime(new Date());
    const sessionRecord: InterviewSessionRecord = {
      id: sessionId,
      status: 'in-progress',
      startedAt,
      sharedCompanyIds: [...optedInCompanyIds],
      questionIds,
      responses: [],
      averageScore: null,
      dimensionAverages: null,
      summary: 'In progress'
    };

    setSessions((current) => [sessionRecord, ...current]);
    setActiveSession({
      sessionId,
      questionIds,
      currentQuestionIndex: 0,
      responses: []
    });
    setSelectedSessionId(sessionId);
    setDraftResponse('');
    setStatusMessage(
      `Interview session started with ${questionIds.length} AI-adapted questions across ${optedInCompanyIds.length} opted-in companies.`
    );
  };

  const submitResponse = () => {
    if (!activeSession || !activeQuestion) return;
    const trimmedResponse = draftResponse.trim();

    if (trimmedResponse.length < 80) {
      setStatusMessage('Add more detail before grading. Aim for at least 80 characters with one concrete outcome.');
      return;
    }

    const evaluated = evaluateResponse(activeQuestion, trimmedResponse);
    const nextResponses = [...activeSession.responses, evaluated];
    const nextIndex = activeSession.currentQuestionIndex + 1;

    updateSessionRecord(activeSession.sessionId, (session) => ({
      ...session,
      responses: nextResponses
    }));

    if (nextIndex < activeSession.questionIds.length) {
      setActiveSession({
        ...activeSession,
        currentQuestionIndex: nextIndex,
        responses: nextResponses
      });
      setDraftResponse('');
      setStatusMessage(`Response graded at ${evaluated.overallScore}. Continue to question ${nextIndex + 1}.`);
      return;
    }

    const completedAt = formatDateTime(new Date());
    const dimensionAverages = calculateDimensionAverages(nextResponses);
    const averageScore = calculateAverageScore(nextResponses);
    const sortedDimensions = (Object.keys(dimensionAverages) as ScoreDimension[]).sort(
      (left, right) => dimensionAverages[right] - dimensionAverages[left]
    );
    const summary = `Top signal: ${dimensionLabels[sortedDimensions[0]]}. Priority to improve: ${dimensionLabels[sortedDimensions[sortedDimensions.length - 1]]}.`;

    updateSessionRecord(activeSession.sessionId, (session) => ({
      ...session,
      status: 'completed',
      completedAt,
      responses: nextResponses,
      averageScore,
      dimensionAverages,
      summary
    }));

    setActiveSession(null);
    setDraftResponse('');
    setSelectedSessionId(activeSession.sessionId);
    setStatusMessage(`Session complete. Final score ${averageScore ?? '--'}. Review your breakdown and next-step plan below.`);
  };

  const latestCompletedSession = sessions.find((session) => session.status === 'completed');

  return (
    <section aria-labelledby="student-interview-prep-title" className="w-full px-6 py-12 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-[#e8fff2] text-[#0b5c39] ring-1 ring-[#b9ebce] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
          Student interview prep
        </Badge>
        <Badge className="bg-[#edf7ff] text-[#134f79] ring-1 ring-[#bfdcf5] dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400/35">
          AI-adapted employer questions
        </Badge>
        <Badge className="bg-[#fff8e7] text-[#735200] ring-1 ring-[#f3df9d] dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/35">
          Session-based scoring
        </Badge>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="student-interview-prep-title" className="text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
            Interview prep sessions for {studentName}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#34544a] dark:text-slate-300">
            Questions are adapted from employer-submitted prompts for your selected role track ({targetRole}). Each response is
            graded, stored in a session, and shareable only with companies you opt in to.
          </p>
        </div>
        <Button onClick={startSession} disabled={!!activeSession}>
          {activeSession ? 'Session in progress' : 'Start interview session'}
        </Button>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-2xl border border-[#cce0d7] bg-[#f3fbf7] px-4 py-3 text-sm font-medium text-[#21493b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-semibold text-[#0d2a22] dark:text-slate-100">Active question</h3>
              {activeSession ? (
                <Badge className="bg-[#f0f7ff] text-[#1f4a73] ring-1 ring-[#c9def2] dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400/35">
                  Question {activeSession.currentQuestionIndex + 1} of {activeSession.questionIds.length}
                </Badge>
              ) : (
                <Badge className="bg-[#eef6f1] text-[#39594f] dark:bg-slate-700 dark:text-slate-100">No active session</Badge>
              )}
            </div>
          }
        >
          {activeSession && activeQuestion ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d8e5df] bg-[#fbfefd] p-4 dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#577267] dark:text-slate-400">
                  Employer seed question ({companyLookup[activeQuestion.companyId]?.name})
                </p>
                <p className="mt-1 text-sm text-[#2d4b40] dark:text-slate-300">{activeQuestion.employerPrompt}</p>
              </div>

              <div className="rounded-2xl border border-[#cfe1d9] bg-[#f5fbf8] p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4b6a5e] dark:text-slate-400">AI-adapted prompt</p>
                <p className="mt-1 text-base font-medium text-[#0f2f25] dark:text-slate-100">{activeQuestion.adaptedPrompt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeQuestion.focusSignals.map((signal) => (
                    <Badge key={`${activeQuestion.id}-${signal}`} className="bg-white text-[#34574a] ring-1 ring-[#cddfd7] dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>

              <label htmlFor="interview-response" className="block text-sm font-semibold text-[#1f3f35] dark:text-slate-200">
                Your response
              </label>
              <textarea
                id="interview-response"
                value={draftResponse}
                onChange={(event) => setDraftResponse(event.target.value)}
                placeholder="Structure with situation, task, action, and result. Include one measurable outcome."
                className="h-44 w-full rounded-2xl border border-[#bfd4cb] bg-white px-4 py-3 text-sm leading-6 text-[#15332a] outline-none ring-0 transition focus:border-[#0fd978] focus:shadow-[0_0_0_3px_rgba(18,249,135,0.18)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#587166] dark:text-slate-400">{draftResponse.trim().split(/\s+/).filter(Boolean).length} words</p>
                <Button onClick={submitResponse}>Grade response and continue</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-[#35554a] dark:text-slate-300">
                Start a session to receive AI-adapted interview questions based on employer inputs from companies you have opted in to.
              </p>
              {latestCompletedSession ? (
                <div className="rounded-2xl border border-[#d3e2dc] bg-[#f7fcf9] p-4 text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                  <p className="font-semibold text-[#133a2f] dark:text-slate-100">Latest completed session</p>
                  <p className="mt-1 text-[#35584b] dark:text-slate-300">
                    {latestCompletedSession.completedAt} · score {latestCompletedSession.averageScore ?? '--'} ·{' '}
                    {latestCompletedSession.questionIds.length} questions
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold text-[#0d2a22] dark:text-slate-100">Sharing controls</h3>
              <Badge className="bg-[#eef7ff] text-[#28516f] ring-1 ring-[#c7ddef] dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400/35">
                {optedInCompanyIds.length} opted in
              </Badge>
            </div>
          }
        >
          <div className="space-y-3">
            {companies.map((company) => {
              const isOptedIn = optedInCompanyIds.includes(company.id);
              return (
                <div
                  key={company.id}
                  className="rounded-2xl border border-[#d7e4de] bg-[#fbfefd] p-4 dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#143c31] dark:text-slate-100">{company.name}</p>
                      <p className="mt-1 text-xs text-[#4f695f] dark:text-slate-400">{company.roleTrack}</p>
                      <p className="mt-1 text-xs text-[#4f695f] dark:text-slate-400">{company.reviewSla}</p>
                    </div>
                    <Button variant={isOptedIn ? 'secondary' : 'primary'} size="sm" onClick={() => toggleCompanyOptIn(company.id)}>
                      {isOptedIn ? 'Pause sharing' : 'Enable sharing'}
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.questionThemes.map((theme) => (
                      <Badge key={`${company.id}-${theme}`} className="bg-white text-[#3a5b50] ring-1 ring-[#d1e1db] dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-semibold text-[#0d2a22] dark:text-slate-100">Interview session history</h3>
              <Badge className="bg-[#effcf4] text-[#1b5a40] ring-1 ring-[#c4ebd2] dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/35">
                {completedSessionCount} completed
              </Badge>
            </div>
          }
        >
          <div className="space-y-3">
            {sessions.map((session) => {
              const isSelected = session.id === selectedSessionId;
              const isCompleted = session.status === 'completed';
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#8dc5ac] bg-[#f0fbf5] ring-2 ring-[#c0e7d2] dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:ring-emerald-400/20'
                      : 'border-[#d5e3dd] bg-white hover:bg-[#f8fcfa] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#12382d] dark:text-slate-100">{session.id}</p>
                    <Badge className={isCompleted ? 'bg-[#ebfff2] text-[#1a5a3f] dark:bg-emerald-500/20 dark:text-emerald-100' : 'bg-[#fff7e8] text-[#7a5404] dark:bg-amber-500/20 dark:text-amber-100'}>
                      {isCompleted ? 'Completed' : 'In progress'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#506a60] dark:text-slate-400">Started {session.startedAt}</p>
                  <p className="mt-1 text-xs text-[#506a60] dark:text-slate-400">
                    {session.completedAt ? `Completed ${session.completedAt}` : 'Awaiting completion'} · {session.questionIds.length} questions
                  </p>
                  <p className="mt-2 text-sm text-[#2f5145] dark:text-slate-300">{session.summary}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold text-[#0d2a22] dark:text-slate-100">Session breakdown</h3>
              <Badge className="bg-[#edf5ff] text-[#234e71] ring-1 ring-[#c6d8eb] dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400/35">
                Avg score {selectedSession?.averageScore ?? '--'}
              </Badge>
            </div>
          }
        >
          {selectedSession?.status === 'completed' && selectedSession.dimensionAverages ? (
            <div className="space-y-4">
              <div>
                {(Object.keys(selectedSession.dimensionAverages) as ScoreDimension[]).map((dimension) => {
                  const value = selectedSession.dimensionAverages![dimension];
                  return (
                    <div key={`${selectedSession.id}-${dimension}`} className="mb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <Badge className={dimensionToneClass[dimension]}>{dimensionLabels[dimension]}</Badge>
                        <span className="text-xs font-semibold text-[#2e5044] dark:text-slate-300">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#dce8e2] dark:bg-slate-700">
                        <div className="h-full rounded-full bg-[#0fd978]" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[#d6e4de] bg-[#f9fcfa] p-3 dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#587267] dark:text-slate-400">Improvement plan</p>
                <ul className="mt-2 space-y-2">
                  {improvementPlan.map((item) => (
                    <li key={`${selectedSession.id}-${item.dimension}`} className="text-sm leading-6 text-[#2d4d41] dark:text-slate-300">
                      <b>{dimensionLabels[item.dimension]} ({item.score})</b>: {item.recommendation}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#d6e4de] bg-[#f7fbff] p-3 dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4e6880] dark:text-slate-400">Company review access</p>
                <p className="mt-2 text-sm text-[#2f4d61] dark:text-slate-300">
                  {selectedSessionReviewability.reviewable.length} {reviewableCompanyNoun} can review this session now.
                </p>
                {selectedSessionReviewability.reviewable.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSessionReviewability.reviewable.map((company) => (
                      <Badge key={`${selectedSession.id}-${company.id}`} className="bg-white text-[#31556f] ring-1 ring-[#cfdfef] dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                        {company.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {selectedSessionReviewability.withheld.length > 0 ? (
                  <p className="mt-2 text-xs text-[#556f83] dark:text-slate-400">
                    Sharing paused for:{' '}
                    {selectedSessionReviewability.withheld.map((company) => company.name).join(', ')}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-[#36584c] dark:text-slate-300">
              Complete a session to see dimension scoring, review visibility, and targeted improvement recommendations.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#597267] dark:text-slate-400">Completed sessions</p>
          <p className="mt-2 text-3xl font-semibold text-[#0f3026] dark:text-slate-100">{completedSessionCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#597267] dark:text-slate-400">Portfolio interview average</p>
          <p className="mt-2 text-3xl font-semibold text-[#0f3026] dark:text-slate-100">{averageCompletedScore ?? '--'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#597267] dark:text-slate-400">Companies with review access</p>
          <p className="mt-2 text-3xl font-semibold text-[#0f3026] dark:text-slate-100">{optedInCompanyIds.length}</p>
        </Card>
      </div>
    </section>
  );
};
