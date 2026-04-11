"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function StaffPasswordLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login/staff", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = (await response.json()) as { ok: boolean; error?: string; redirectPath?: string };
      if (!response.ok || !data.ok || !data.redirectPath) {
        if (data.error === "role_unassigned") {
          setError("Your account is valid but has no assigned Stu role. Contact an org admin.");
        } else if (data.error === "use_student_magic_link") {
          setError("Student accounts must use the magic-link sign-in flow.");
        } else if (data.error === "use_recruiter_magic_link") {
          setError("Recruiter accounts must use the recruiter magic-link sign-in flow.");
        } else if (data.error === "supabase_not_configured") {
          setError("Supabase auth is not configured for this environment.");
        } else {
          setError("We couldn't sign you in. Please check your details and try again.");
        }
        return;
      }

      router.push(data.redirectPath);
      router.refresh();
    } catch {
      setError("We couldn't sign you in. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Org admin sign-in</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Password login</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Org admin accounts sign in with email and password.</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p> : null}

        <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-700 underline dark:text-emerald-300">
            Back to sign-in options
          </Link>
        </div>
      </section>
    </main>
  );
}
