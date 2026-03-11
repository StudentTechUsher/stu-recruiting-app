import Link from "next/link";

type LoginChooserScreenProps = {
  sessionCheckEnabled: boolean;
};

export function LoginChooserScreen({ sessionCheckEnabled }: LoginChooserScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)] px-4 py-12">
      <section className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-7 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Stu Recruiting Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a]">Choose sign-in path</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/login/student"
            className="rounded-2xl border border-[#bfd2ca] bg-[#f5faf7] p-4 transition-colors hover:bg-[#edf5f1]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">Student</p>
            <p className="mt-1 text-lg font-semibold text-[#0a1f1a]">Magic link</p>
            <p className="mt-1 text-xs text-[#476a5d]">Use your campus email to receive a secure sign-in link.</p>
          </Link>

          <Link
            href="/login/staff"
            className="rounded-2xl border border-[#bfd2ca] bg-[#f5faf7] p-4 transition-colors hover:bg-[#edf5f1]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#476a5d]">Recruiter / Admin</p>
            <p className="mt-1 text-lg font-semibold text-[#0a1f1a]">Password login</p>
            <p className="mt-1 text-xs text-[#476a5d]">Continue using email and password for staff accounts.</p>
          </Link>
        </div>

        <div className="mt-5 rounded-xl border border-[#d4e1db] bg-[#f5faf7] p-3 text-xs text-[#3d5f53]">
          Session check: <span className="font-semibold">{sessionCheckEnabled ? "enabled" : "disabled"}</span>
          {!sessionCheckEnabled ? (
            <div>
              <a href="/student/onboarding" className="mt-1 inline-block font-semibold text-emerald-700 underline">
                Continue without session enforcement
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
