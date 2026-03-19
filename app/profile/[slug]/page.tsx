import Link from "next/link";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentShareCardRow = {
  profile_id: string;
  share_slug: string;
  full_name: string;
  avatar_url: string | null;
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SharedProfilePage({ params }: PageProps) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student", "recruiter", "org_admin", "referrer"], { requireOnboarding: false })) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p className="text-sm text-[#436059]">Sign in to view shared student profiles.</p>
      </main>
    );
  }

  const resolvedParams = await params;
  const slug = resolvedParams.slug.trim().toLowerCase();
  const supabase = await getSupabaseServerClient();

  const { data: rows } = supabase
    ? ((await supabase.rpc("resolve_student_share_profile", { input_slug: slug }).returns<StudentShareCardRow[]>()) as {
        data: StudentShareCardRow[] | null;
      })
    : { data: null };

  const student = rows?.[0] ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-8">
      <section className="w-full max-w-xl rounded-[30px] border border-[#cfded7] bg-[#f8fcfa] p-8 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Shared profile</p>
        {student ? (
          <>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">{student.full_name}</h1>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#d2dfd9] bg-white p-4">
              <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[#bfd2ca] bg-[#e8f2ed] text-sm font-semibold text-[#1f4338]">
                {student.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={student.avatar_url} alt={`${student.full_name} avatar`} className="h-full w-full object-cover" />
                ) : (
                  student.full_name
                    .split(/\s+/)
                    .map((token) => token[0] ?? "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.08em] text-[#4c6860]">Student candidate</span>
                <span className="block truncate text-lg font-semibold text-[#0a1f1a]">{student.full_name}</span>
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {context.persona === "referrer" ? (
                <Link
                  href={`/referrer/endorsements?profile=${encodeURIComponent(`/profile/${student.share_slug}`)}`}
                  className="inline-flex rounded-xl bg-[#12f987] px-4 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90"
                >
                  Open endorsement form
                </Link>
              ) : null}
              <Link
                href="/"
                className="inline-flex rounded-xl border border-[#c7d7d0] bg-white px-4 py-2 text-sm font-semibold text-[#21453a] transition-colors hover:bg-[#f2f8f5]"
              >
                Back to workspace
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">Profile not found</h1>
            <p className="mt-3 text-sm leading-7 text-[#436059]">
              This shared profile URL does not match an active student profile in the current environment.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
