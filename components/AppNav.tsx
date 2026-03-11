import Link from "next/link";

const navGroups = [
  {
    label: "Recruiter",
    items: [
      ["Capability Models", "/recruiter/capability-models"],
      ["Pipeline", "/recruiter/pipeline"],
      ["Off-Platform Scoring", "/recruiter/off-platform-scoring"],
      ["Candidates", "/recruiter/candidates"],
      ["Outcomes", "/recruiter/outcomes"]
    ]
  },
  {
    label: "Student",
    items: [
      ["Onboarding", "/student/onboarding"],
      ["Profile", "/student/profile"],
      ["Dashboard", "/student/dashboard"],
      ["Artifacts", "/student/artifacts"],
      ["Pathway", "/student/pathway"],
      ["Guidance", "/student/guidance"],
      ["Interview Prep", "/student/interview-prep"]
    ]
  },
  {
    label: "Admin",
    items: [["Recruiter Assignments", "/admin/recruiter-assignments"]]
  }
] as const;

export function AppNav() {
  return (
    <nav className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">App Navigation</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {navGroups.map((group) => (
          <section key={group.label}>
            <h2 className="text-sm font-semibold text-emerald-900">{group.label}</h2>
            <ul className="mt-2 space-y-1">
              {group.items.map(([label, href]) => (
                <li key={href}>
                  <Link className="text-sm text-emerald-800 hover:text-emerald-600" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
