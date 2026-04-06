"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const asTrimmed = (value: string) => value.trim();

const splitFullName = (fullName: string) => {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" ")
  };
};

export function ReferrerOnboardingClient({
  defaultEmail,
  defaultFullName
}: {
  defaultEmail: string;
  defaultFullName: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = useMemo(() => {
    return (
      asTrimmed(fullName).length >= 2 &&
      asTrimmed(linkedinUrl).length >= 10 &&
      asTrimmed(company).length >= 2 &&
      asTrimmed(position).length >= 2
    );
  }, [company, fullName, linkedinUrl, position]);

  const onComplete = async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    setError(null);

    const normalizedFullName = asTrimmed(fullName);
    const parsedName = splitFullName(normalizedFullName);
    const normalizedLinkedinUrl = asTrimmed(linkedinUrl);
    const normalizedCompany = asTrimmed(company);
    const normalizedPosition = asTrimmed(position);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          personal_info: {
            first_name: parsedName.firstName,
            last_name: parsedName.lastName,
            full_name: normalizedFullName,
            linkedin_url: normalizedLinkedinUrl
          },
          referrer_data: {
            full_name: normalizedFullName,
            linkedin_url: normalizedLinkedinUrl,
            company: normalizedCompany,
            position: normalizedPosition
          }
        })
      });

      const data = (await response.json().catch(() => null)) as { ok: boolean; redirectPath?: string; error?: string } | null;
      if (response.status === 403 && data?.error === "session_expired") {
        router.push("/login?error=session_expired");
        router.refresh();
        return;
      }

      if (!response.ok || !data?.ok || !data.redirectPath) {
        throw new Error("referrer_onboarding_complete_failed");
      }

      router.push(data.redirectPath);
      router.refresh();
    } catch {
      setError("Unable to complete onboarding right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-8">
      <section className="w-full max-w-2xl rounded-[30px] border border-[#cfded7] bg-[#f8fcfa] p-8 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Referrer onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">Set up your endorsement profile</h1>
        <p className="mt-3 text-sm leading-7 text-[#436059]">
          Complete this once. Then you can look up candidates by their shared profile URL and submit endorsements.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a]"
              placeholder="Jordan Lee"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
            Email
            <input
              value={defaultEmail}
              readOnly
              className="mt-2 h-11 w-full cursor-not-allowed rounded-xl border border-[#bfd2ca] bg-[#f3f7f5] px-3 text-sm normal-case text-[#0a1f1a]"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] sm:col-span-2">
            LinkedIn URL
            <input
              value={linkedinUrl}
              onChange={(event) => setLinkedinUrl(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a]"
              placeholder="https://linkedin.com/in/username"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a]"
              placeholder="Acme Inc."
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
            Position
            <input
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a]"
              placeholder="Senior Product Manager"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onComplete}
          disabled={!canSubmit || isSaving}
          className="mt-6 inline-flex rounded-xl bg-[#12f987] px-4 py-2 text-sm font-semibold text-[#0a1f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Finishing onboarding..." : "Finish onboarding"}
        </button>
        {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </section>
    </main>
  );
}
