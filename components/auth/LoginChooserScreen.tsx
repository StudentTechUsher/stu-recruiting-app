import Link from "next/link";

type LoginChooserScreenProps = {
  devIdentitiesEnabled: boolean;
  initialError?: string | null;
};

export function LoginChooserScreen({ devIdentitiesEnabled, initialError = null }: LoginChooserScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Stu Recruiting Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Choose your sign-in path</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Students, recruiters, and referrers all sign in with email links.</p>
        {initialError ? <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">{initialError}</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/login/student"
            className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 shadow-[0_14px_26px_-20px_rgba(16,185,129,0.6)] transition-colors hover:bg-emerald-100/70 sm:col-span-2 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
          >
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Recommended</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">I&apos;m a student</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">We&apos;ll email you a sign-in link to your campus inbox.</p>
          </Link>

          <Link
            href="/login/recruiter"
            className="rounded-2xl border border-slate-300 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recruiter</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">I&apos;m a recruiter</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use your work email to request access.</p>
          </Link>

          <Link
            href="/login/referrer"
            className="rounded-2xl border border-slate-300 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Referrer</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">I&apos;m a referrer</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Sign in to submit candidate endorsements.</p>
          </Link>
        </div>

        {devIdentitiesEnabled ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Dev identities</p>
            <p className="mt-1">Skip magic links in development and continue as a seeded persona.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="/api/auth/dev-login?persona=student"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Continue as Dev Student
              </a>
              <a
                href="/api/auth/dev-login?persona=recruiter"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Continue as Dev Recruiter
              </a>
              <a
                href="/api/auth/dev-login?persona=referrer"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Continue as Dev Referrer
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
