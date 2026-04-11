"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MagicLinkResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  throttled?: boolean;
  retryAfterSeconds?: number;
};

type VerifyCodeResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  redirectPath?: string;
};

type MagicLinkLoginScreenProps = {
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
  googleOAuthPath?: string | null;
  verifyPath?: string;
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
  additionalPayload = {},
  googleOAuthPath = null,
  verifyPath,
}: MagicLinkLoginScreenProps) {
  const router = useRouter();
  const hasGoogleOAuth = Boolean(googleOAuthPath);
  const verifyEndpoint = verifyPath ?? `${submitPath}/verify`;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
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
          setError("We couldn't send a sign-in link. Please try again.");
        }
        return;
      }

      setLastRequestedEmail(normalizedEmailKey);
      setCooldownSeconds(retryAfterSeconds);
      if (data.throttled) {
        setNotice(`A sign-in link was requested recently. Wait ${retryAfterSeconds} seconds, then try again.`);
      } else {
        setNotice("Magic link sent. Check your inbox and open the sign-in link, or enter the email code below.");
      }
    } catch {
      setError("We couldn't send a sign-in link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmailValue = email.trim();
    const normalizedCode = code.trim();
    if (!normalizedEmailValue) {
      setError("Enter your email address before verifying.");
      return;
    }

    if (!normalizedCode) {
      setError("Enter the sign-in code from your email.");
      return;
    }

    setVerifyingCode(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(verifyEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: normalizedEmailValue,
          code: normalizedCode,
          ...additionalPayload,
        })
      });

      const data = (await response.json().catch(() => null)) as VerifyCodeResponse | null;
      const errorCode = data?.error;

      if (!response.ok || !data?.ok || !data.redirectPath) {
        if (errorCode === "invalid_email" || errorCode === "invalid_otp_payload") {
          setError("Enter a valid email and code.");
        } else if (errorCode === "invalid_otp_code") {
          setError("Code is invalid or expired. Request a new magic link and try again.");
        } else if (errorCode === "otp_rate_limited") {
          setError("Too many attempts. Wait a moment and try again.");
        } else if (errorCode === "wrong_account_type") {
          setError("This email is assigned to a different account type. Use the matching sign-in path.");
        } else if (errorCode === "role_unassigned") {
          setError("Your account does not have an assigned Stu role. Contact an org admin.");
        } else if (errorCode === "supabase_not_configured") {
          setError("Supabase auth is not configured for this environment.");
        } else if (errorCode && errorMessages[errorCode]) {
          setError(errorMessages[errorCode]);
        } else if (errorCode === "otp_verify_failed" && data?.details) {
          setError(`Unable to verify code. ${data.details}`);
        } else {
          setError("We couldn't verify that code. Request a new link and try again.");
        }
        return;
      }

      router.push(data.redirectPath);
      router.refresh();
    } catch {
      setError("We couldn't verify that code. Request a new link and try again.");
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{heading}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>

        {hasGoogleOAuth ? (
          <div className="mt-5">
            <a
              href={googleOAuthPath ?? undefined}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-sm font-semibold text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8f9fa]"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 48 48"
              >
                <path fill="#EA4335" d="M24 9.5c3.9 0 7.4 1.3 10.2 4l7.6-7.6C37.3 2 31.1 0 24 0 14.6 0 6.5 5.4 2.6 13.3l8.9 6.9C13.5 13.8 18.3 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.7-.2-3.3-.5-4.8H24v9.1h12.4c-.5 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.5-4.1 6.8-10.1 6.8-17.3z" />
                <path fill="#FBBC05" d="M11.5 28.2c-.5-1.4-.8-2.8-.8-4.2s.3-2.9.8-4.2l-8.9-6.9C.9 16.2 0 20 0 24s.9 7.8 2.6 11.1l8.9-6.9z" />
                <path fill="#34A853" d="M24 48c7.1 0 13.1-2.3 17.5-6.3l-7.6-5.9c-2.1 1.4-4.8 2.2-9.9 2.2-5.7 0-10.5-4.3-12.2-10.1l-8.9 6.9C6.5 42.6 14.6 48 24 48z" />
              </svg>
              <span>Sign in with Google</span>
            </a>

            <div className="mt-4 flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span>Or use email</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ) : null}

        <form className={`${hasGoogleOAuth ? "mt-4" : "mt-5"} space-y-4`} onSubmit={onSubmit}>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            {emailLabel}
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder={emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || isCooldownActive}
            className="w-full rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? loadingLabel : isCooldownActive ? `Wait ${cooldownSeconds}s` : submitLabel}
          </button>
        </form>

        {lastRequestedEmail ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Have a code instead?</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Enter the code from your email to finish signing in.</p>
            <form className="mt-3 space-y-3" onSubmit={onVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Enter code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
              <button
                type="submit"
                disabled={verifyingCode}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {verifyingCode ? "Verifying..." : "Verify code"}
              </button>
            </form>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

        <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-700 underline dark:text-emerald-300">
            Back to sign-in options
          </Link>
        </div>
      </section>
    </main>
  );
}
