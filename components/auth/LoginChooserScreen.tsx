import Link from "next/link";

type LoginChooserScreenProps = {
  devIdentitiesEnabled: boolean;
};

export function LoginChooserScreen({ devIdentitiesEnabled }: LoginChooserScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)] px-4 py-12">
      <section className="w-full max-w-2xl rounded-[28px] border border-emerald-200 bg-white p-7 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Stu Recruiting Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a]">Choose sign-in path</h1>
        <p className="mt-2 text-sm text-[#3c5f52]">Students, recruiters, and referrers use magic links.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/login/student"
            className="rounded-2xl border border-[#bfd2ca] bg-[#f5faf7] p-4 transition-colors hover:bg-[#edf5f1]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">Student</p>
            <p className="mt-1 text-lg font-semibold text-[#0a1f1a]">I&apos;m a student</p>
            <p className="mt-1 text-xs text-[#476a5d]">Use your campus email to receive a secure sign-in link.</p>
          </Link>

          <Link
            href="/login/recruiter"
            className="rounded-2xl border border-[#bfd2ca] bg-[#f5faf7] p-4 transition-colors hover:bg-[#edf5f1]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">Recruiter</p>
            <p className="mt-1 text-lg font-semibold text-[#0a1f1a]">I&apos;m a recruiter</p>
            <p className="mt-1 text-xs text-[#476a5d]">Use your work email to request recruiter access.</p>
          </Link>

          <Link
            href="/login/referrer"
            className="rounded-2xl border border-[#bfd2ca] bg-[#f5faf7] p-4 transition-colors hover:bg-[#edf5f1]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">Referrer</p>
            <p className="mt-1 text-lg font-semibold text-[#0a1f1a]">I&apos;m a referrer</p>
            <p className="mt-1 text-xs text-[#476a5d]">Use your email to submit endorsements for student candidates.</p>
          </Link>
        </div>

        {devIdentitiesEnabled ? (
          <div className="mt-5 rounded-xl border border-[#d6e1db] bg-[#f8fcfa] p-3 text-xs text-[#35554a]">
            <p className="font-semibold uppercase tracking-[0.08em] text-[#48695d]">Dev identities</p>
            <p className="mt-1">Skip magic links in development and continue as a seeded persona.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="/api/auth/dev-login?persona=student"
                className="rounded-lg border border-[#bfd2ca] bg-white px-2.5 py-1 font-semibold text-[#0a1f1a] hover:bg-[#eff6f2]"
              >
                Continue as Dev Student
              </a>
              <a
                href="/api/auth/dev-login?persona=recruiter"
                className="rounded-lg border border-[#bfd2ca] bg-white px-2.5 py-1 font-semibold text-[#0a1f1a] hover:bg-[#eff6f2]"
              >
                Continue as Dev Recruiter
              </a>
              <a
                href="/api/auth/dev-login?persona=referrer"
                className="rounded-lg border border-[#bfd2ca] bg-white px-2.5 py-1 font-semibold text-[#0a1f1a] hover:bg-[#eff6f2]"
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
