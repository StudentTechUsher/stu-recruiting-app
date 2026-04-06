import { NetworkingCoachPanel } from "@/components/student/NetworkingCoachPanel";

export default function StudentNetworkingCoachPage() {
  return (
    <main className="min-h-screen px-4 py-6 text-[#0a1f1a] lg:px-8 lg:py-10 dark:text-slate-100">
      <section className="w-full">
        <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
          <NetworkingCoachPanel />
        </div>
      </section>
    </main>
  );
}
