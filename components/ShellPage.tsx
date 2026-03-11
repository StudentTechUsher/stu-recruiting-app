import type { ReactNode } from "react";

type ShellPageProps = {
  title: string;
  subtitle: string;
  strategicRecommendations: string[];
  tacticalRecommendations: string[];
  crossSectionInsights: string[];
  children?: ReactNode;
  warningTag?: string;
};

export function ShellPage({
  title,
  subtitle,
  strategicRecommendations,
  tacticalRecommendations,
  crossSectionInsights,
  children,
  warningTag
}: ShellPageProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 md:px-8">
      <header className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Stu Recruiting Platform</p>
        <h1 className="mt-2 text-3xl font-semibold text-emerald-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-emerald-800">{subtitle}</p>
        {warningTag ? (
          <p className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-800">
            {warningTag}
          </p>
        ) : null}
      </header>

      <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-emerald-900">Global Strategic Recommendations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-900">
          {strategicRecommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">Primary Workflow Section</h2>
          <p className="mt-2 text-sm text-emerald-800">{subtitle}</p>
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-900">Contextual Tactical Recommendations</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900">
              {tacticalRecommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <details className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Why this matters</summary>
            <p className="mt-2 text-sm text-emerald-800">
              This shell enforces recommendation placement standards so each view can evolve without losing strategic
              guidance context.
            </p>
          </details>

          <div className="mt-4">{children}</div>
        </section>

        <aside className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">Cross-Section Insights</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-900">
            {crossSectionInsights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
