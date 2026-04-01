import Link from "next/link";
import { Badge } from "@/components/mock/ui/Badge";
import { Card } from "@/components/mock/ui/Card";

const placeholderPlaybook = [
  {
    title: "Contact mapping by target employer",
    detail: "TODO: Suggest high-priority people to contact based on your selected employers and roles."
  },
  {
    title: "Outreach strategy",
    detail: "TODO: Recommend personalized outreach angles for each suggested contact."
  },
  {
    title: "Conversation prep",
    detail: "TODO: Generate short meeting prep prompts and follow-up suggestions."
  }
];

export default function StudentNetworkingCoachPage() {
  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <section aria-labelledby="student-networking-coach-title" className="w-full px-4 py-6 lg:px-8 lg:py-12">
        <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">Networking coach</p>
            <h2
              id="student-networking-coach-title"
              className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl"
            >
              Networking Coach (Design Preview)
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
              This is a UI-only first pass. Functionality is intentionally deferred and marked with TODO content.
            </p>
            <Badge className="mt-3 bg-[#fff5e8] text-[#7a4d20] ring-1 ring-[#f2c896] dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/35">
              TODO wiring pending
            </Badge>
          </header>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {placeholderPlaybook.map((item) => (
              <Card
                key={item.title}
                className="bg-white/95 p-4 dark:bg-slate-900/80"
                header={<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#38574d] dark:text-slate-300">{item.title}</h3>}
              >
                <p className="text-xs leading-6 text-[#4c6860] dark:text-slate-300">{item.detail}</p>
              </Card>
            ))}
          </div>

          <Card className="mt-6 bg-white/95 p-5 dark:bg-slate-900/80" header={<h3 className="text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Prep work</h3>}>
            <p className="text-sm text-[#48635b] dark:text-slate-300">
              Keep your targets current so future networking suggestions stay relevant to your recruiting focus.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/student/targets"
                className="inline-flex h-10 items-center rounded-xl bg-[#12f987] px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978]"
              >
                Open My Roles & Employers
              </Link>
              <Link
                href="/student/profile"
                className="inline-flex h-10 items-center rounded-xl border border-[#bfd2ca] bg-white px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open Profile
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
