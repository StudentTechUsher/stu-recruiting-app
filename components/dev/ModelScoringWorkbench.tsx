"use client";

import { useMemo, useState } from "react";

type VerificationTier =
  | "unverified"
  | "weakly_verified"
  | "moderately_verified"
  | "strongly_verified";

type JobCapability = {
  name: string;
  weight: number;
};

type JobVector = {
  role: string;
  capabilities: JobCapability[];
};

type StudentCapability = {
  name: string;
  score: number;
  confidence: number;
  verification_tier: VerificationTier;
  evidence: string[];
};

type StudentProfile = {
  student_id: string;
  profile_type: string;
  capabilities: Record<string, StudentCapability[]>;
};

type FlatStudentCapability = StudentCapability & {
  category: string;
  adjusted: number;
};

type ScoringRow = {
  name: string;
  weight: number;
  matched: boolean;
  category: string | null;
  score: number;
  confidence: number;
  verificationTier: VerificationTier | null;
  adjusted: number;
  weightedContribution: number;
};

type RadarDatum = {
  label: string;
  value: number;
};

const TIER_MULTIPLIER: Record<VerificationTier, number> = {
  unverified: 0.5,
  weakly_verified: 0.65,
  moderately_verified: 0.85,
  strongly_verified: 1,
};

const SAMPLE_JOB_VECTOR: JobVector = {
  role: "Early Talent Cloud Engineer",
  capabilities: [
    { name: "Learning Velocity", weight: 0.9 },
    { name: "Cloud Fundamentals", weight: 0.9 },
    { name: "Backend Engineering", weight: 0.7 },
    { name: "Programming Fluency", weight: 0.7 },
    { name: "Debugging Ability", weight: 0.7 },
    { name: "Collaboration", weight: 0.7 },
    { name: "Ownership", weight: 0.7 },
    { name: "Delivery Reliability", weight: 0.7 },
    { name: "Feedback Responsiveness", weight: 0.7 },
    { name: "Problem Decomposition", weight: 0.7 },
    { name: "Communication Clarity", weight: 0.6 },
    { name: "Attention to Detail", weight: 0.6 },
    { name: "DevOps & CI/CD", weight: 0.6 },
    { name: "Abstraction Ability", weight: 0.6 },
    { name: "Execution Speed", weight: 0.6 },
    { name: "Curiosity", weight: 0.7 },
    { name: "Infrastructure as Code", weight: 0.6 },
    { name: "Ambiguity Navigation", weight: 0.5 },
    { name: "Task Scoping", weight: 0.5 },
    { name: "Stakeholder Alignment", weight: 0.5 },
  ],
};

const SAMPLE_STUDENT_PROFILE: StudentProfile = {
  student_id: "stu_multi_001",
  profile_type: "early_talent_multi_interest",
  capabilities: {
    Technical: [
      {
        name: "Programming Fluency",
        score: 0.72,
        confidence: 0.7,
        verification_tier: "strongly_verified",
        evidence: [
          "Completed multiple Python-based projects",
          "Built REST API using Flask",
          "GitHub repo with 5+ projects",
        ],
      },
      {
        name: "Cloud Fundamentals",
        score: 0.68,
        confidence: 0.65,
        verification_tier: "strongly_verified",
        evidence: [
          "AWS Cloud Practitioner certification",
          "Deployed web app using EC2 and S3",
          "Coursework in cloud infrastructure",
        ],
      },
      {
        name: "Backend Engineering",
        score: 0.65,
        confidence: 0.6,
        verification_tier: "strongly_verified",
        evidence: [
          "Built backend service for student project",
          "Worked with REST APIs and databases",
        ],
      },
      {
        name: "Data Engineering",
        score: 0.7,
        confidence: 0.68,
        verification_tier: "strongly_verified",
        evidence: [
          "Built ETL pipeline using Python and Pandas",
          "Processed large CSV datasets",
          "Class project involving data transformation",
        ],
      },
      {
        name: "Data Modeling",
        score: 0.6,
        confidence: 0.55,
        verification_tier: "strongly_verified",
        evidence: [
          "Designed relational schema for project",
          "Worked with SQL joins and normalization",
        ],
      },
      {
        name: "DevOps & CI/CD",
        score: 0.55,
        confidence: 0.5,
        verification_tier: "strongly_verified",
        evidence: [
          "Basic GitHub Actions pipeline",
          "Deployed app through CI workflow",
        ],
      },
    ],
    Cognitive: [
      {
        name: "Learning Velocity",
        score: 0.9,
        confidence: 0.8,
        verification_tier: "strongly_verified",
        evidence: [
          "Self-taught AWS and data pipelines",
          "Completed multiple online certifications",
          "Quick progression across domains",
        ],
      },
      {
        name: "Problem Decomposition",
        score: 0.75,
        confidence: 0.7,
        verification_tier: "strongly_verified",
        evidence: [
          "Broke down data pipeline into stages",
          "Designed modular backend services",
        ],
      },
      {
        name: "Analytical Reasoning",
        score: 0.72,
        confidence: 0.68,
        verification_tier: "strongly_verified",
        evidence: [
          "Data analysis coursework",
          "Statistical reasoning in projects",
        ],
      },
      {
        name: "Abstraction Ability",
        score: 0.65,
        confidence: 0.6,
        verification_tier: "strongly_verified",
        evidence: [
          "Understands pipeline architecture concepts",
          "Explains system components at high level",
        ],
      },
      {
        name: "Ambiguity Navigation",
        score: 0.68,
        confidence: 0.6,
        verification_tier: "strongly_verified",
        evidence: [
          "Worked on open-ended class projects",
          "Defined project scope independently",
        ],
      },
    ],
    Execution: [
      {
        name: "Ownership",
        score: 0.82,
        confidence: 0.75,
        verification_tier: "strongly_verified",
        evidence: [
          "Led capstone project",
          "Took responsibility for backend + data pipeline",
        ],
      },
      {
        name: "Delivery Reliability",
        score: 0.78,
        confidence: 0.7,
        verification_tier: "strongly_verified",
        evidence: [
          "Delivered all major coursework projects on time",
          "Completed multi-phase capstone",
        ],
      },
      {
        name: "Execution Speed",
        score: 0.7,
        confidence: 0.65,
        verification_tier: "strongly_verified",
        evidence: [
          "Built MVP projects quickly",
          "Iterated on feedback",
        ],
      },
      {
        name: "Prioritization",
        score: 0.68,
        confidence: 0.6,
        verification_tier: "strongly_verified",
        evidence: [
          "Balanced multiple project deadlines",
          "Scoped features for deliverables",
        ],
      },
      {
        name: "Attention to Detail",
        score: 0.72,
        confidence: 0.68,
        verification_tier: "strongly_verified",
        evidence: [
          "Low error rate in projects",
          "Careful data validation steps",
        ],
      },
    ],
    Behavioral: [
      {
        name: "Communication Clarity",
        score: 0.78,
        confidence: 0.72,
        verification_tier: "strongly_verified",
        evidence: [
          "Presented technical projects to peers",
          "Clear documentation in GitHub repos",
        ],
      },
      {
        name: "Collaboration",
        score: 0.8,
        confidence: 0.75,
        verification_tier: "strongly_verified",
        evidence: [
          "Worked in 3-4 person teams",
          "Coordinated project tasks",
        ],
      },
      {
        name: "Feedback Responsiveness",
        score: 0.85,
        confidence: 0.78,
        verification_tier: "strongly_verified",
        evidence: [
          "Iterated quickly after instructor feedback",
          "Improved project deliverables",
        ],
      },
      {
        name: "Stakeholder Alignment",
        score: 0.7,
        confidence: 0.6,
        verification_tier: "strongly_verified",
        evidence: [
          "Aligned team goals in projects",
          "Communicated scope changes",
        ],
      },
      {
        name: "Initiative",
        score: 0.82,
        confidence: 0.75,
        verification_tier: "strongly_verified",
        evidence: [
          "Self-initiated learning in cloud + data",
          "Built projects outside coursework",
        ],
      },
      {
        name: "Curiosity",
        score: 0.9,
        confidence: 0.8,
        verification_tier: "strongly_verified",
        evidence: [
          "Explored multiple domains (cloud, data, PM)",
          "Consistent independent learning",
        ],
      },
    ],
  },
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function truncateLabel(value: string, maxLength = 16): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseVerificationTier(value: unknown): VerificationTier {
  if (
    value === "unverified" ||
    value === "weakly_verified" ||
    value === "moderately_verified" ||
    value === "strongly_verified"
  ) {
    return value;
  }
  if (value === "verified") return "strongly_verified";
  return "strongly_verified";
}

function parseJobVectorJson(raw: string): JobVector {
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed)) {
    throw new Error("Job vector JSON must be an object.");
  }

  const role = typeof parsed.role === "string" ? parsed.role.trim() : "";
  if (!role) {
    throw new Error("Job vector must include a non-empty role.");
  }

  if (!Array.isArray(parsed.capabilities)) {
    throw new Error("Job vector must include a capabilities array.");
  }

  const capabilities = parsed.capabilities.map((value, index): JobCapability => {
    if (!isRecord(value)) {
      throw new Error(`Capability at index ${index} must be an object.`);
    }

    const name = typeof value.name === "string" ? value.name.trim() : "";
    const weight = Number(value.weight);

    if (!name) {
      throw new Error(`Capability at index ${index} needs a non-empty name.`);
    }
    if (!Number.isFinite(weight)) {
      throw new Error(`Capability "${name}" needs a numeric weight.`);
    }

    return { name, weight: clamp01(weight) };
  });

  return { role, capabilities };
}

function parseStudentProfileJson(raw: string): StudentProfile {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Student profile JSON must be an object.");
  }
  if (!isRecord(parsed.capabilities)) {
    throw new Error("Student profile must include a capabilities object.");
  }

  const capabilities: Record<string, StudentCapability[]> = {};

  for (const [category, value] of Object.entries(parsed.capabilities)) {
    if (!Array.isArray(value)) {
      throw new Error(`Category "${category}" must be an array.`);
    }

    capabilities[category] = value.map((item, index): StudentCapability => {
      if (!isRecord(item)) {
        throw new Error(`Capability in "${category}" at index ${index} must be an object.`);
      }

      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) {
        throw new Error(`Capability in "${category}" at index ${index} needs a non-empty name.`);
      }

      const score = clamp01(Number(item.score));
      const confidence = clamp01(Number(item.confidence));
      const verification_tier = parseVerificationTier(item.verification_tier);
      const evidence = Array.isArray(item.evidence)
        ? item.evidence.filter((e): e is string => typeof e === "string")
        : [];

      return { name, score, confidence, verification_tier, evidence };
    });
  }

  const student_id = typeof parsed.student_id === "string" && parsed.student_id.trim()
    ? parsed.student_id.trim()
    : "student_dev";
  const profile_type = typeof parsed.profile_type === "string" && parsed.profile_type.trim()
    ? parsed.profile_type.trim()
    : "custom_profile";

  return { student_id, profile_type, capabilities };
}

export function ModelScoringWorkbench() {
  const [jobVector, setJobVector] = useState<JobVector>(SAMPLE_JOB_VECTOR);
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(SAMPLE_STUDENT_PROFILE);
  const [jobJsonDraft, setJobJsonDraft] = useState<string>(JSON.stringify(SAMPLE_JOB_VECTOR, null, 2));
  const [studentJsonDraft, setStudentJsonDraft] = useState<string>(
    JSON.stringify(SAMPLE_STUDENT_PROFILE, null, 2)
  );
  const [jobJsonStatus, setJobJsonStatus] = useState<string | null>(null);
  const [studentJsonStatus, setStudentJsonStatus] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categoryEntries = useMemo(
    () => Object.entries(studentProfile.capabilities),
    [studentProfile.capabilities]
  );

  const flatCapabilities = useMemo<FlatStudentCapability[]>(
    () =>
      categoryEntries.flatMap(([category, capabilities]) =>
        capabilities.map((capability) => {
          const adjusted =
            clamp01(capability.score) *
            clamp01(capability.confidence) *
            TIER_MULTIPLIER[capability.verification_tier];
          return { ...capability, category, adjusted };
        })
      ),
    [categoryEntries]
  );

  const scoring = useMemo(() => {
    const candidateByName = new Map<string, FlatStudentCapability>();

    for (const capability of flatCapabilities) {
      const key = toNameKey(capability.name);
      if (!key) continue;
      const existing = candidateByName.get(key);
      if (!existing || capability.adjusted > existing.adjusted) {
        candidateByName.set(key, capability);
      }
    }

    const rows: ScoringRow[] = jobVector.capabilities.map((capability) => {
      const weight = clamp01(capability.weight);
      const matchedCapability = candidateByName.get(toNameKey(capability.name));

      if (!matchedCapability) {
        return {
          name: capability.name,
          weight,
          matched: false,
          category: null,
          score: 0,
          confidence: 0,
          verificationTier: null,
          adjusted: 0,
          weightedContribution: 0,
        };
      }

      return {
        name: capability.name,
        weight,
        matched: true,
        category: matchedCapability.category,
        score: matchedCapability.score,
        confidence: matchedCapability.confidence,
        verificationTier: matchedCapability.verification_tier,
        adjusted: matchedCapability.adjusted,
        weightedContribution: weight * matchedCapability.adjusted,
      };
    });

    const totals = rows.reduce(
      (acc, row) => ({
        totalWeight: acc.totalWeight + row.weight,
        weightedRaw: acc.weightedRaw + row.weight * row.score,
        weightedAdjusted: acc.weightedAdjusted + row.weightedContribution,
        weightedConfidence: acc.weightedConfidence + row.weight * row.confidence,
        matchedCount: acc.matchedCount + (row.matched ? 1 : 0),
      }),
      {
        totalWeight: 0,
        weightedRaw: 0,
        weightedAdjusted: 0,
        weightedConfidence: 0,
        matchedCount: 0,
      }
    );

    const denominator = totals.totalWeight || 1;

    return {
      rows,
      totalWeight: totals.totalWeight,
      coverage: jobVector.capabilities.length ? totals.matchedCount / jobVector.capabilities.length : 0,
      rawScore: totals.weightedRaw / denominator,
      adjustedScore: totals.weightedAdjusted / denominator,
      weightedConfidence: totals.weightedConfidence / denominator,
      missingCount: Math.max(0, jobVector.capabilities.length - totals.matchedCount),
    };
  }, [flatCapabilities, jobVector.capabilities]);

  const capabilityRadarData = useMemo<RadarDatum[]>(
    () =>
      jobVector.capabilities.map((capability) => ({
        label: capability.name,
        value: clamp01(capability.weight),
      })),
    [jobVector.capabilities]
  );

  const candidateRadarData = useMemo<RadarDatum[]>(
    () =>
      scoring.rows.map((row) => ({
        label: row.name,
        value: clamp01(row.adjusted),
      })),
    [scoring.rows]
  );

  const updateJobCapability = (index: number, patch: Partial<JobCapability>) => {
    setJobVector((current) => ({
      ...current,
      capabilities: current.capabilities.map((capability, capabilityIndex) =>
        capabilityIndex === index ? { ...capability, ...patch } : capability
      ),
    }));
  };

  const addJobCapability = () => {
    setJobVector((current) => ({
      ...current,
      capabilities: [
        ...current.capabilities,
        { name: `New Capability ${current.capabilities.length + 1}`, weight: 0.5 },
      ],
    }));
  };

  const removeJobCapability = (index: number) => {
    setJobVector((current) => ({
      ...current,
      capabilities: current.capabilities.filter((_, capabilityIndex) => capabilityIndex !== index),
    }));
  };

  const updateStudentCapability = (
    category: string,
    index: number,
    patch: Partial<StudentCapability>
  ) => {
    setStudentProfile((current) => ({
      ...current,
      capabilities: {
        ...current.capabilities,
        [category]: current.capabilities[category].map((capability, capabilityIndex) =>
          capabilityIndex === index ? { ...capability, ...patch } : capability
        ),
      },
    }));
  };

  const addStudentCapability = (category: string) => {
    setStudentProfile((current) => ({
      ...current,
      capabilities: {
        ...current.capabilities,
        [category]: [
          ...current.capabilities[category],
          {
            name: `New ${category} Capability`,
            score: 0.5,
            confidence: 0.5,
            verification_tier: "strongly_verified",
            evidence: [],
          },
        ],
      },
    }));
  };

  const removeStudentCapability = (category: string, index: number) => {
    setStudentProfile((current) => ({
      ...current,
      capabilities: {
        ...current.capabilities,
        [category]: current.capabilities[category].filter((_, capabilityIndex) => capabilityIndex !== index),
      },
    }));
  };

  const addCategory = () => {
    const normalized = newCategoryName.trim();
    if (!normalized) return;

    setStudentProfile((current) => {
      if (current.capabilities[normalized]) return current;
      return {
        ...current,
        capabilities: {
          ...current.capabilities,
          [normalized]: [],
        },
      };
    });
    setNewCategoryName("");
  };

  const removeCategory = (category: string) => {
    setStudentProfile((current) => {
      const nextCapabilities = { ...current.capabilities };
      delete nextCapabilities[category];
      return { ...current, capabilities: nextCapabilities };
    });
  };

  const applyJobJson = () => {
    try {
      const parsed = parseJobVectorJson(jobJsonDraft);
      setJobVector(parsed);
      setJobJsonStatus("Applied.");
    } catch (error) {
      setJobJsonStatus(error instanceof Error ? error.message : "Unable to parse job vector JSON.");
    }
  };

  const applyStudentJson = () => {
    try {
      const parsed = parseStudentProfileJson(studentJsonDraft);
      setStudentProfile(parsed);
      setStudentJsonStatus("Applied.");
    } catch (error) {
      setStudentJsonStatus(
        error instanceof Error ? error.message : "Unable to parse student profile JSON."
      );
    }
  };

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <h1 className="text-sm font-semibold text-cyan-300">Model Scoring Workbench</h1>
        <p className="mt-1 text-xs text-gray-400">
          Live scoring uses score × confidence × verification multiplier, then applies job weights.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-gray-800 bg-gray-900/70 px-4 py-3 lg:grid-cols-4">
        <MetricCard
          label="Adjusted Match Score"
          value={formatPercent(scoring.adjustedScore)}
          description="Weighted average match using score × confidence × verification multiplier for each matched capability."
        />
        <MetricCard
          label="Raw Match Score"
          value={formatPercent(scoring.rawScore)}
          description="Weighted average match using capability score only, before confidence and verification adjustments."
        />
        <MetricCard
          label="Coverage"
          value={formatPercent(scoring.coverage)}
          description="Percent of job capabilities that found a name match in the student profile."
        />
        <MetricCard
          label="Missing Capabilities"
          value={`${scoring.missingCount}`}
          description="Count of job capabilities with no matching student capability by name."
        />
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-gray-800 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              Capability Model / Job Vector
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                onClick={() => {
                  setJobVector(SAMPLE_JOB_VECTOR);
                  setJobJsonDraft(JSON.stringify(SAMPLE_JOB_VECTOR, null, 2));
                  setJobJsonStatus("Reset to sample.");
                }}
              >
                Reset sample
              </button>
              <button
                type="button"
                className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-950"
                onClick={addJobCapability}
              >
                Add capability
              </button>
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-gray-400">Role</span>
            <input
              className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-cyan-500"
              value={jobVector.role}
              onChange={(event) => setJobVector((current) => ({ ...current, role: event.target.value }))}
            />
          </label>

          <div className="mb-4 rounded border border-gray-800 bg-gray-900/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              Capability Radar
            </h3>
            <p className="mt-1 text-[11px] text-gray-400">
              Spokes represent target capability weights from the job vector.
            </p>
            <SimpleRadarChart
              data={capabilityRadarData}
              strokeClassName="stroke-cyan-300"
              fillClassName="fill-cyan-500/25"
            />
          </div>

          <div className="space-y-2">
            {jobVector.capabilities.map((capability, index) => (
              <div key={`${capability.name}-${index}`} className="rounded border border-gray-800 bg-gray-900/80 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
                    value={capability.name}
                    onChange={(event) => updateJobCapability(index, { name: event.target.value })}
                  />
                  <button
                    type="button"
                    className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                    onClick={() => removeJobCapability(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    className="flex-1 accent-cyan-400"
                    value={capability.weight}
                    onChange={(event) =>
                      updateJobCapability(index, { weight: clamp01(Number(event.target.value)) })
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
                    value={capability.weight}
                    onChange={(event) =>
                      updateJobCapability(index, { weight: clamp01(Number(event.target.value)) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Alignment Breakdown
          </h3>
          <div className="space-y-2">
            {scoring.rows.map((row, index) => (
              <div key={`${row.name}-${index}`} className="rounded border border-gray-800 bg-gray-900/80 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-200">{row.name}</span>
                  <span className="text-[11px] text-gray-400">
                    weight {row.weight.toFixed(2)} · contrib {row.weightedContribution.toFixed(3)}
                  </span>
                </div>
                <div className="h-2 rounded bg-gray-800">
                  <div
                    className={`h-2 rounded ${row.matched ? "bg-cyan-400" : "bg-red-500/50"}`}
                    style={{ width: `${Math.round(row.adjusted * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  {row.matched
                    ? `${row.category} · score ${row.score.toFixed(2)} · conf ${row.confidence.toFixed(
                        2
                      )} · tier ${row.verificationTier}`
                    : "No matching student capability"}
                </div>
              </div>
            ))}
          </div>

          <details className="mt-5 rounded border border-gray-800 bg-gray-900/70">
            <summary className="cursor-pointer px-3 py-2 text-xs text-gray-300">
              Job vector JSON editor
            </summary>
            <div className="border-t border-gray-800 p-3">
              <textarea
                className="h-56 w-full rounded border border-gray-700 bg-gray-950 p-2 text-xs text-gray-100 outline-none focus:border-cyan-500"
                value={jobJsonDraft}
                onChange={(event) => setJobJsonDraft(event.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                  onClick={() => setJobJsonDraft(JSON.stringify(jobVector, null, 2))}
                >
                  Load current
                </button>
                <button
                  type="button"
                  className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-950"
                  onClick={applyJobJson}
                >
                  Apply JSON
                </button>
                {jobJsonStatus && <span className="text-xs text-gray-400">{jobJsonStatus}</span>}
              </div>
            </div>
          </details>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              Candidate Model / Student Signals
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                onClick={() => {
                  setStudentProfile(SAMPLE_STUDENT_PROFILE);
                  setStudentJsonDraft(JSON.stringify(SAMPLE_STUDENT_PROFILE, null, 2));
                  setStudentJsonStatus("Reset to sample.");
                }}
              >
                Reset sample
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs text-gray-400">Student ID</span>
              <input
                className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-cyan-500"
                value={studentProfile.student_id}
                onChange={(event) =>
                  setStudentProfile((current) => ({ ...current, student_id: event.target.value }))
                }
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-gray-400">Profile Type</span>
              <input
                className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-cyan-500"
                value={studentProfile.profile_type}
                onChange={(event) =>
                  setStudentProfile((current) => ({ ...current, profile_type: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="mb-4 rounded border border-gray-800 bg-gray-900/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              Candidate Radar
            </h3>
            <p className="mt-1 text-[11px] text-gray-400">
              Job-aligned candidate shape using adjusted values (score x confidence x verification).
            </p>
            <SimpleRadarChart
              data={candidateRadarData}
              strokeClassName="stroke-emerald-300"
              fillClassName="fill-emerald-500/25"
            />
          </div>

          <div className="mb-3 flex items-center gap-2">
            <input
              className="w-56 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
              value={newCategoryName}
              placeholder="New category name"
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button
              type="button"
              className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-950"
              onClick={addCategory}
            >
              Add category
            </button>
          </div>

          <div className="space-y-3">
            {categoryEntries.map(([category, capabilities]) => (
              <div key={category} className="rounded border border-gray-800 bg-gray-900/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-cyan-200">{category}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                      onClick={() => addStudentCapability(category)}
                    >
                      Add capability
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                      onClick={() => removeCategory(category)}
                    >
                      Remove category
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {capabilities.map((capability, index) => (
                    <div
                      key={`${capability.name}-${index}`}
                      className="rounded border border-gray-800 bg-gray-900 p-2"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
                          value={capability.name}
                          onChange={(event) =>
                            updateStudentCapability(category, index, { name: event.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                          onClick={() => removeStudentCapability(category, index)}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <RangeInput
                          label="Score"
                          value={capability.score}
                          onChange={(value) => updateStudentCapability(category, index, { score: value })}
                        />
                        <RangeInput
                          label="Confidence"
                          value={capability.confidence}
                          onChange={(value) =>
                            updateStudentCapability(category, index, { confidence: value })
                          }
                        />
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-[11px] text-gray-400">Verification Tier</span>
                        <select
                          className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
                          value={capability.verification_tier}
                          onChange={(event) =>
                            updateStudentCapability(category, index, {
                              verification_tier: parseVerificationTier(event.target.value),
                            })
                          }
                        >
                          <option value="unverified">no verification (0.50x)</option>
                          <option value="weakly_verified">weak verification (0.65x)</option>
                          <option value="moderately_verified">moderate verification (0.85x)</option>
                          <option value="strongly_verified">strong verification (1.00x)</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <details className="mt-5 rounded border border-gray-800 bg-gray-900/70">
            <summary className="cursor-pointer px-3 py-2 text-xs text-gray-300">
              Student profile JSON editor
            </summary>
            <div className="border-t border-gray-800 p-3">
              <textarea
                className="h-56 w-full rounded border border-gray-700 bg-gray-950 p-2 text-xs text-gray-100 outline-none focus:border-cyan-500"
                value={studentJsonDraft}
                onChange={(event) => setStudentJsonDraft(event.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                  onClick={() => setStudentJsonDraft(JSON.stringify(studentProfile, null, 2))}
                >
                  Load current
                </button>
                <button
                  type="button"
                  className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-950"
                  onClick={applyStudentJson}
                >
                  Apply JSON
                </button>
                {studentJsonStatus && <span className="text-xs text-gray-400">{studentJsonStatus}</span>}
              </div>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function SimpleRadarChart({
  data,
  strokeClassName,
  fillClassName,
}: {
  data: RadarDatum[];
  strokeClassName: string;
  fillClassName: string;
}) {
  if (data.length < 3) {
    return <div className="py-8 text-center text-xs text-gray-500">Add at least 3 capabilities to render a radar chart.</div>;
  }

  const size = 360;
  const center = size / 2;
  const radius = size * 0.33;
  const step = (Math.PI * 2) / data.length;
  const labelStride = data.length > 12 ? Math.ceil(data.length / 12) : 1;

  const axes = data.map((datum, index) => {
    const angle = -Math.PI / 2 + index * step;
    const outerX = center + Math.cos(angle) * radius;
    const outerY = center + Math.sin(angle) * radius;
    const valueX = center + Math.cos(angle) * radius * clamp01(datum.value);
    const valueY = center + Math.sin(angle) * radius * clamp01(datum.value);
    const labelX = center + Math.cos(angle) * (radius + 20);
    const labelY = center + Math.sin(angle) * (radius + 20);

    return {
      ...datum,
      angle,
      outerX,
      outerY,
      valueX,
      valueY,
      labelX,
      labelY,
      showLabel: index % labelStride === 0,
    };
  });

  const ringScales = [0.25, 0.5, 0.75, 1];
  const ringPoints = ringScales.map((scale) =>
    axes
      .map((axis) => {
        const x = center + Math.cos(axis.angle) * radius * scale;
        const y = center + Math.sin(axis.angle) * radius * scale;
        return `${x},${y}`;
      })
      .join(" ")
  );

  const shapePoints = axes.map((axis) => `${axis.valueX},${axis.valueY}`).join(" ");

  return (
    <div className="mt-2 overflow-x-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto block h-[300px] w-full min-w-[280px] max-w-[460px]"
        aria-label="Radar chart"
      >
        {ringPoints.map((points, index) => (
          <polygon
            key={`ring-${ringScales[index]}`}
            points={points}
            fill="none"
            stroke="rgb(55 65 81)"
            strokeWidth="1"
          />
        ))}

        {axes.map((axis, index) => (
          <line
            key={`axis-${index}-${axis.label}`}
            x1={center}
            y1={center}
            x2={axis.outerX}
            y2={axis.outerY}
            stroke="rgb(55 65 81)"
            strokeWidth="1"
          />
        ))}

        <polygon points={shapePoints} className={fillClassName} />
        <polygon points={shapePoints} className={strokeClassName} fill="none" strokeWidth="2" />

        {axes.map((axis, index) => (
          <g key={`point-${index}-${axis.label}`}>
            <circle cx={axis.valueX} cy={axis.valueY} r="2.5" className={strokeClassName} />
            <title>{`${axis.label}: ${Math.round(axis.value * 100)}%`}</title>
          </g>
        ))}

        {axes.map((axis, index) => {
          if (!axis.showLabel) return null;

          const cos = Math.cos(axis.angle);
          let anchor: "start" | "middle" | "end" = "middle";
          if (cos > 0.25) anchor = "start";
          if (cos < -0.25) anchor = "end";

          return (
            <text
              key={`label-${axis.label}-${index}`}
              x={axis.labelX}
              y={axis.labelY}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="10"
              fill="rgb(156 163 175)"
            >
              {truncateLabel(axis.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900/80 p-2">
      <div className="flex items-center gap-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <span className="group relative inline-flex">
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-400 hover:border-cyan-500 hover:text-cyan-300 focus:border-cyan-500 focus:text-cyan-300 focus:outline-none"
            aria-label={`${label} definition`}
          >
            i
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-64 -translate-x-1/2 rounded border border-gray-700 bg-gray-950 p-2 text-[11px] normal-case tracking-normal text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {description}
          </span>
        </span>
      </div>
      <div className="mt-1 text-lg font-semibold text-cyan-200">{value}</div>
    </div>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          className="flex-1 accent-cyan-400"
          onChange={(event) => onChange(clamp01(Number(event.target.value)))}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value}
          className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-cyan-500"
          onChange={(event) => onChange(clamp01(Number(event.target.value)))}
        />
      </div>
    </label>
  );
}
