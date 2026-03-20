"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecommendationState } from "@/lib/ats/types";

type PipelineSummary = {
  total_candidates: number;
  matched_students: number;
  unmatched_candidates: number;
  recommendation_buckets: Record<RecommendationState, number>;
  top_reason_codes: Array<{ reason_code: string; count: number }>;
};

type PipelinePayload = {
  provider: "greenhouse" | "lever" | "bamboohr";
  summary: PipelineSummary;
  generated_at: string;
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#dbe8e2] dark:bg-slate-700/70";

const providerLabel: Record<PipelinePayload["provider"], string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  bamboohr: "BambooHR (Scaffold)",
};

export function RecruiterPipelineOverview() {
  const [data, setData] = useState<PipelinePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/recruiter/pipeline", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: PipelinePayload }
          | { ok: false; error?: string }
          | null;

        if (!isActive) return;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && !payload.ok ? payload.error ?? "pipeline_load_failed" : "pipeline_load_failed");
        }

        setData(payload.data);
      } catch (caughtError) {
        if (!isActive) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load pipeline";
        setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const reasonCodeRows = useMemo(() => data?.summary.top_reason_codes ?? [], [data]);

  return (
    <section className="w-full px-6 py-8 lg:px-8">
      <div className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4d675f] dark:text-slate-400">
              Recruiter Pipeline
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
              ATS + Stu Discovery Overview
            </h2>
          </div>
          {isLoading ? (
            <div className={`${skeletonBlockClassName} h-7 w-36`} aria-hidden="true" />
          ) : data ? (
            <span className="rounded-full border border-[#bdd2c9] bg-white px-3 py-1 text-xs font-semibold text-[#23493d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              Source: {providerLabel[data.provider]}
            </span>
          ) : null}
        </header>

        {isLoading ? (
          <div aria-hidden="true">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`pipeline-card-skeleton-${index}`} className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                  <div className={`${skeletonBlockClassName} h-3 w-24`} />
                  <div className={`${skeletonBlockClassName} mt-3 h-8 w-16`} />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div className={`${skeletonBlockClassName} h-3 w-32`} />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`pipeline-reason-skeleton-${index}`} className={`${skeletonBlockClassName} h-8 w-full`} />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PipelineMetricCard label="Total ATS candidates" value={String(data.summary.total_candidates)} />
              <PipelineMetricCard label="Matched to Stu" value={String(data.summary.matched_students)} />
              <PipelineMetricCard label="Unmatched ATS" value={String(data.summary.unmatched_candidates)} />
              <PipelineMetricCard
                label="Recommended"
                value={String(data.summary.recommendation_buckets.recommended)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <PipelineBucketCard
                label="Recommended"
                value={data.summary.recommendation_buckets.recommended}
                tone="good"
              />
              <PipelineBucketCard
                label="Hold"
                value={data.summary.recommendation_buckets.hold}
                tone="warning"
              />
              <PipelineBucketCard
                label="Manual review"
                value={data.summary.recommendation_buckets.manual_review}
                tone="neutral"
              />
            </div>

            <div className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                Top reason codes
              </h3>
              {reasonCodeRows.length === 0 ? (
                <p className="mt-3 text-sm text-[#557168] dark:text-slate-300">No recommendation reason codes yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {reasonCodeRows.map((row) => (
                    <li
                      key={row.reason_code}
                      className="flex items-center justify-between rounded-xl border border-[#dbe8e2] px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <span className="font-medium text-[#1d4639] dark:text-slate-200">{row.reason_code}</span>
                      <span className="rounded-md bg-[#eef7f2] px-2 py-1 text-xs font-semibold text-[#2f5a4d] dark:bg-slate-800 dark:text-slate-300">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PipelineMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[#d7e4dd] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
      <p className="text-xs uppercase tracking-[0.08em] text-[#587269] dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#0f2e25] dark:text-slate-100">{value}</p>
    </article>
  );
}

function PipelineBucketCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warning" | "neutral";
}) {
  const toneClassName =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
      : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";

  return (
    <article className={`rounded-2xl border p-4 ${toneClassName}`}>
      <p className="text-xs uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
