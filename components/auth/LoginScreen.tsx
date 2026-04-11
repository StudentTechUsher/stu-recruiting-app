"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginScreen() {
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
      const response = await fetch("/api/auth/login", {
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
        } else if (data.error === "supabase_not_configured") {
          setError("Supabase auth is not configured for this environment.");
        } else {
          setError("Unable to sign in.");
        }
        return;
      }

      router.push(data.redirectPath);
      router.refresh();
    } catch {
      setError("Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)] px-4 py-12">
      <section className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-7 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Stu Recruiting Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a]">Sign in</h1>
        <p className="mt-2 text-sm text-[#3c5f52]">One login for students, recruiters, and org admins.</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-[#bfd2ca] px-3 py-2 text-sm text-[#0a1f1a]"
              placeholder="name@school.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-[#bfd2ca] px-3 py-2 text-sm text-[#0a1f1a]"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0fd978] px-3 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}

      </section>
    </main>
  );
}
