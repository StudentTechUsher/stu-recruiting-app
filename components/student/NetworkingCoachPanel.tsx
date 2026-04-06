"use client";

import { useState } from "react";

type SuggestionPayload = {
  suggestion: {
    name: string;
    headline: string;
    url: string;
    rationale: string;
    target_role: string;
    target_company: string;
  };
  messages: {
    invite_message: string;
    follow_up_message: string;
    public_profile_path: string;
    public_profile_url: string;
  };
  context_used: {
    active_targets: Array<{
      capability_profile_id: string;
      role_label: string;
      company_label: string;
      priority_label: "primary" | "secondary";
    }>;
    artifacts: Array<{
      artifact_id: string;
      title: string;
    }>;
  };
  generation: {
    source: "openai" | "fallback";
    model: string;
    elapsed_ms: number;
    fallback_reason?: string;
  };
};

const generateRequest = async (): Promise<{ ok: true; data: SuggestionPayload } | { ok: false; error: string }> => {
  const response = await fetch("/api/student/networking-coach/suggestion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ refresh: false }),
  });
  const body = (await response.json().catch(() => null)) as
    | { ok: true; data: SuggestionPayload }
    | { ok: false; error?: string }
    | null;

  if (!response.ok || !body || !body.ok) {
    const errorCode = body && body.ok === false ? body.error : undefined;
    return { ok: false, error: errorCode ?? "networking_generation_failed" };
  }

  return { ok: true, data: body.data };
};

const copyToClipboard = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export function NetworkingCoachPanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionPayload | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const generateSuggestion = async () => {
    setIsGenerating(true);
    setError(null);
    setCopyStatus(null);
    const generated = await generateRequest();
    if (!generated.ok) {
      setError(generated.error);
      setIsGenerating(false);
      return;
    }
    setResult(generated.data);
    setInviteMessage(generated.data.messages.invite_message);
    setFollowUpMessage(generated.data.messages.follow_up_message);
    setIsGenerating(false);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <header className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#456158] dark:text-slate-400">
          Networking coach
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Networking Coach</h1>
        <p className="mt-2 text-sm text-[#48635b] dark:text-slate-300">
          Generate one recommended contact and two editable outreach drafts grounded in your selected role targets and artifacts.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void generateSuggestion()}
            disabled={isGenerating}
            className="inline-flex h-10 items-center rounded-xl bg-[#12f987] px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Generating..." : "Generate suggestion"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200">
          {error === "ai_feature_quota_exceeded"
            ? "You reached the networking suggestion quota for now."
            : error === "no_active_targets"
              ? "Select at least one role + company target in My Roles & Employers before generating a suggestion."
              : error === "connections_baseline_unavailable"
                ? "Connections baseline is unavailable right now."
                : "Unable to generate a networking suggestion right now."}
        </div>
      ) : null}

      {isGenerating && !result ? (
        <div className="rounded-xl border border-[#d2dfd9] bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className="h-5 w-5 animate-spin rounded-full border-2 border-[#9ec0b2] border-t-[#0f6b52] dark:border-slate-500 dark:border-t-emerald-400"
            />
            <span className="text-sm text-[#48635b] dark:text-slate-300">Generating networking suggestion...</span>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <article className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
              Suggested contact
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">{result.suggestion.name}</h2>
            <p className="mt-1 text-sm text-[#48635b] dark:text-slate-300">{result.suggestion.headline}</p>
            <p className="mt-2 text-sm text-[#38574d] dark:text-slate-300">{result.suggestion.rationale}</p>
            <a
              href={result.suggestion.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-lg border border-[#bfd2ca] bg-[#f4faf7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] hover:bg-[#ebf6f1] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Open LinkedIn profile
            </a>
          </article>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">Connection invite</p>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(inviteMessage).then((copied) =>
                      setCopyStatus(copied ? "Invite copied." : "Unable to copy invite.")
                    )
                  }
                  className="rounded-lg border border-[#bfd2ca] bg-[#f4faf7] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#21453a] hover:bg-[#ebf6f1] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
                className="mt-2 min-h-[160px] w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">{inviteMessage.length}/300</p>
            </article>

            <article className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">Follow-up message</p>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(followUpMessage).then((copied) =>
                      setCopyStatus(copied ? "Follow-up copied." : "Unable to copy follow-up.")
                    )
                  }
                  className="rounded-lg border border-[#bfd2ca] bg-[#f4faf7] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#21453a] hover:bg-[#ebf6f1] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={followUpMessage}
                onChange={(event) => setFollowUpMessage(event.target.value)}
                className="mt-2 min-h-[160px] w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">{followUpMessage.length}/700</p>
            </article>
          </section>

          <article className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">Context used</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.context_used.active_targets.map((target) => (
                <span
                  key={target.capability_profile_id}
                  className="inline-flex items-center rounded-full border border-[#bfd2ca] bg-[#f4faf7] px-3 py-1 text-xs text-[#21453a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {target.priority_label === "primary" ? "Primary" : "Secondary"}: {target.role_label} @ {target.company_label}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.context_used.artifacts.length === 0 ? (
                <p className="text-xs text-[#557168] dark:text-slate-400">No active artifacts were available for personalization.</p>
              ) : (
                result.context_used.artifacts.map((artifact) => (
                  <span
                    key={artifact.artifact_id}
                    className="inline-flex items-center rounded-full border border-[#d2dfd9] bg-white px-3 py-1 text-xs text-[#38574d] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    {artifact.title}
                  </span>
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-[#557168] dark:text-slate-400">
              Public profile:{" "}
              <a href={result.messages.public_profile_url} className="underline" target="_blank" rel="noreferrer">
                {result.messages.public_profile_path}
              </a>
            </p>
            {copyStatus ? <p className="mt-2 text-xs text-[#38574d] dark:text-slate-300">{copyStatus}</p> : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
