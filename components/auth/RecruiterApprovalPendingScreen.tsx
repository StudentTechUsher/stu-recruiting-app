import Link from "next/link";
import { AppNavigationShell } from "@/components/AppNavigationShell";

export function RecruiterApprovalPendingScreen() {
  return (
    <AppNavigationShell audience="recruiter" showNavigation={false}>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#eef8f3_0%,#e3f1eb_38%,#d7e8df_100%)] px-6 py-12 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(10,31,26,0.08),transparent_45%,rgba(18,249,135,0.12))]" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        <div className="relative flex min-h-[calc(100vh-6rem)] items-center justify-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recruiter-approval-pending-title"
            className="w-full max-w-xl rounded-[30px] border border-[#cfded7] bg-white/95 p-8 shadow-[0_30px_80px_-40px_rgba(10,31,26,0.55)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Recruiter access pending</p>
            <h1
              id="recruiter-approval-pending-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl"
            >
              Your recruiter dashboard is waiting on approval
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#436059]">
              We received your recruiter sign-in, but dashboard access stays locked until Stu confirms you are an authorized recruiter.
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-[#d2dfd9] bg-[#f8fcfa] p-4 text-sm text-[#21453a]">
              <p className="rounded-lg border border-[#e3ece8] bg-white px-3 py-2">
                Once approved, the same recruiter magic-link flow will take you directly into the dashboard.
              </p>
              <p className="rounded-lg border border-[#e3ece8] bg-white px-3 py-2">
                Need help? Email <a className="font-semibold text-emerald-700 underline" href="mailto:vin@stuplanning.com">vin@stuplanning.com</a>.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/login/recruiter"
                className="inline-flex rounded-xl bg-[#12f987] px-4 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90"
              >
                Back to recruiter sign-in
              </Link>
              <Link
                href="/api/auth/logout"
                className="inline-flex rounded-xl border border-[#c7d7d0] bg-white px-4 py-2 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#f2f8f5]"
              >
                Sign out
              </Link>
            </div>
          </section>
        </div>
      </main>
    </AppNavigationShell>
  );
}
