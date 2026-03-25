"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MagicLinkResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  throttled?: boolean;
  retryAfterSeconds?: number;
};

type MagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
  submitPath: string;
  eyebrow: string;
  heading: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  loadingLabel: string;
  errorMessages?: Record<string, string>;
  initialError?: string | null;
  additionalPayload?: Record<string, string>;
};

const DEFAULT_RETRY_AFTER_SECONDS = 60;

const parseRetryAfterSeconds = (response: Response, data: MagicLinkResponse | null) => {
  if (typeof data?.retryAfterSeconds === "number" && Number.isFinite(data.retryAfterSeconds) && data.retryAfterSeconds > 0) {
    return Math.floor(data.retryAfterSeconds);
  }

  const retryAfterHeader = response.headers.get("retry-after");
  if (retryAfterHeader) {
    const parsed = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
};

export function MagicLinkLoginScreen({
  sessionCheckEnabled,
  submitPath,
  eyebrow,
  heading,
  description,
  emailLabel,
  emailPlaceholder,
  submitLabel,
  loadingLabel,
  errorMessages = {},
  initialError = null,
  additionalPayload = {}
}: MagicLinkLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [lastRequestedEmail, setLastRequestedEmail] = useState("");
  const normalizedEmail = email.trim().toLowerCase();
  const isCooldownActive = cooldownSeconds > 0 && normalizedEmail !== "" && normalizedEmail === lastRequestedEmail;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      setCooldownSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCooldownActive) {
      setError(null);
      setNotice(`A sign-in link was requested recently. Wait ${cooldownSeconds} seconds, then try again.`);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedEmailValue = email.trim();
      const normalizedEmailKey = normalizedEmailValue.toLowerCase();
      const response = await fetch(submitPath, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: normalizedEmailValue,
          ...additionalPayload,
        })
      });

      const data = (await response.json().catch(() => null)) as MagicLinkResponse | null;
      const errorCode = data?.error;
      const retryAfterSeconds = parseRetryAfterSeconds(response, data);

      if (!response.ok || !data?.ok) {
        if (errorCode === "invalid_email") {
          setError("Enter a valid email address.");
        } else if (errorCode === "supabase_not_configured") {
          setError("Supabase auth is not configured for this environment.");
        } else if (errorCode === "email_auth_disabled") {
          setError("Supabase email auth is disabled. Enable Email provider in Supabase Auth settings.");
        } else if (errorCode === "invalid_magic_link_redirect") {
          setError("Magic-link redirect URL is not allowed in Supabase. Check your Auth redirect URL settings.");
        } else if (errorCode === "magic_link_rate_limited" || response.status === 429) {
          setLastRequestedEmail(normalizedEmailKey);
          setCooldownSeconds(retryAfterSeconds);
          setNotice(`A sign-in link was requested recently. Wait ${retryAfterSeconds} seconds, then try again.`);
        } else if (errorCode && errorMessages[errorCode]) {
          setError(errorMessages[errorCode]);
        } else if (errorCode === "magic_link_send_failed" && data?.details) {
          setError(`Unable to send magic link. ${data.details}`);
        } else {
          setError("Unable to send magic link.");
        }
        return;
      }

      setLastRequestedEmail(normalizedEmailKey);
      setCooldownSeconds(retryAfterSeconds);
      if (data.throttled) {
        setNotice(`A sign-in link was requested recently. Wait ${retryAfterSeconds} seconds, then try again.`);
      } else {
        setNotice("Magic link sent. Check your inbox and open the sign-in link.");
      }
    } catch {
      setError("Unable to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)] px-4 py-12">
      <section className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-7 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a]">{heading}</h1>
        <p className="mt-2 text-sm text-[#3c5f52]">{description}</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">
            {emailLabel}
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-[#bfd2ca] px-3 py-2 text-sm text-[#0a1f1a]"
              placeholder={emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || isCooldownActive}
            className="w-full rounded-xl bg-[#0fd978] px-3 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? loadingLabel : isCooldownActive ? `Wait ${cooldownSeconds}s` : submitLabel}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p> : null}

        <div className="mt-4 flex items-center justify-between text-xs text-[#3d5f53]">
          <Link href="/login" className="font-semibold text-emerald-700 underline">
            Back to sign-in options
          </Link>
          <span>Session: {sessionCheckEnabled ? "enabled" : "disabled"}</span>
        </div>
      </section>
    </main>
  );
}
