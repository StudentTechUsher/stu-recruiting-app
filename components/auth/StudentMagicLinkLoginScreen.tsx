"use client";

import { useState } from "react";
import Link from "next/link";

type StudentMagicLinkLoginScreenProps = {
  sessionCheckEnabled: boolean;
};

export function StudentMagicLinkLoginScreen({ sessionCheckEnabled }: StudentMagicLinkLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedEmail = email.trim();
      const response = await fetch("/api/auth/login/student", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; details?: string }
        | null;
      const errorCode = data?.error;

      if (!response.ok || !data?.ok) {
        if (errorCode === "invalid_email") {
          setError("Enter a valid email address.");
        } else if (errorCode === "invalid_student_email_domain") {
          setError("Use a valid campus email domain for student login.");
        } else if (errorCode === "supabase_not_configured") {
          setError("Supabase auth is not configured for this environment.");
        } else if (errorCode === "email_auth_disabled") {
          setError("Supabase email auth is disabled. Enable Email provider in Supabase Auth settings.");
        } else if (errorCode === "invalid_magic_link_redirect") {
          setError("Magic-link redirect URL is not allowed in Supabase. Check your Auth redirect URL settings.");
        } else if (errorCode === "magic_link_rate_limited") {
          setError("Too many attempts. Wait a minute, then request a new magic link.");
        } else if (errorCode === "magic_link_send_failed" && data?.details) {
          setError(`Unable to send magic link. ${data.details}`);
        } else {
          setError("Unable to send magic link.");
        }
        return;
      }

      setNotice("Magic link sent. Check your inbox and open the sign-in link.");
    } catch {
      setError("Unable to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)] px-4 py-12">
      <section className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-7 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Student sign-in</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a]">Get magic link</h1>
        <p className="mt-2 text-sm text-[#3c5f52]">Use your .edu email to receive a secure sign-in link.</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">
            Campus email
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-[#bfd2ca] px-3 py-2 text-sm text-[#0a1f1a]"
              placeholder="name@school.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0fd978] px-3 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending link..." : "Send magic link"}
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
