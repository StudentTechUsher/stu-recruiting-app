"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ResolvedStudent = {
  profile_id: string;
  share_slug: string;
  full_name: string;
  avatar_url: string | null;
};

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#e4efe9]";

export default function ReferrerEndorsementsPage() {
  return (
    <Suspense fallback={<ReferrerEndorsementsPageFallback />}>
      <ReferrerEndorsementsPageContent />
    </Suspense>
  );
}

function ReferrerEndorsementsPageContent() {
  const searchParams = useSearchParams();
  const [profileInput, setProfileInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [student, setStudent] = useState<ResolvedStudent | null>(null);
  const [endorsementText, setEndorsementText] = useState("");

  useEffect(() => {
    const profileFromQuery = searchParams.get("profile");
    if (!profileFromQuery) return;
    setProfileInput(profileFromQuery);
  }, [searchParams]);

  const canResolve = useMemo(() => profileInput.trim().length > 0 && !isResolving, [isResolving, profileInput]);
  const canSave = useMemo(() => endorsementText.trim().length > 0 && !!student && !isSaving, [endorsementText, isSaving, student]);
  const characterCount = endorsementText.trim().length;

  const resolveStudent = async () => {
    if (!canResolve) return;
    setIsResolving(true);
    setLookupError(null);
    setSaveError(null);
    setSaveNotice(null);
    setStudent(null);

    try {
      const response = await fetch("/api/referrer/students/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ profile_url: profileInput.trim() })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: true;
            data: {
              student: ResolvedStudent;
              existing_endorsement: { endorsement_text: string; updated_at: string | null } | null;
            };
          }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        const errorCode = !payload || payload.ok ? "" : payload.error ?? "";
        if (errorCode === "invalid_profile_url") setLookupError("Enter a valid student profile URL or share slug.");
        else if (errorCode === "student_not_found") setLookupError("No student profile matched that URL.");
        else setLookupError("Unable to resolve that student profile right now.");
        return;
      }

      setStudent(payload.data.student);
      setEndorsementText(payload.data.existing_endorsement?.endorsement_text ?? "");
      setSaveNotice(
        payload.data.existing_endorsement
          ? "Loaded your existing endorsement for this student. You can edit and save."
          : "Student resolved. Add your endorsement below."
      );
    } catch {
      setLookupError("Unable to resolve that student profile right now.");
    } finally {
      setIsResolving(false);
    }
  };

  const saveEndorsement = async () => {
    if (!canSave || !student) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      const response = await fetch("/api/referrer/endorsements", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          profile_url: profileInput.trim(),
          endorsement: endorsementText.trim()
        })
      });
      const payload = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        if (payload?.error === "endorsement_too_long") {
          setSaveError("Endorsement must be 4,000 characters or fewer.");
        } else {
          setSaveError("Unable to save endorsement right now.");
        }
        return;
      }

      setSaveNotice(`Endorsement saved for ${student.full_name}.`);
    } catch {
      setSaveError("Unable to save endorsement right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="w-full px-6 py-12 lg:px-8">
      <section className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860]">Referrer workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] md:text-4xl">Submit student endorsement</h1>
          <p className="mt-3 text-sm leading-7 text-[#436059]">
            Paste the student&apos;s shared profile URL. We&apos;ll resolve their profile and let you submit or update your endorsement.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
            Student profile URL or share slug
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={profileInput}
                onChange={(event) => setProfileInput(event.target.value)}
                className="h-11 min-w-[280px] flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a]"
                placeholder="https://app.example.com/u/..."
                disabled={isResolving}
              />
              <button
                type="button"
                onClick={() => void resolveStudent()}
                disabled={!canResolve}
                className="rounded-xl bg-[#12f987] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolving ? "Resolving..." : "Resolve Student"}
              </button>
            </div>
          </label>

          {lookupError ? <p className="mt-3 text-sm font-medium text-rose-700">{lookupError}</p> : null}
        </section>

        <section className="mt-5 rounded-2xl border border-[#d2dfd9] bg-white p-4">
          {isResolving ? (
            <div aria-hidden="true">
              <div className={`${skeletonBlockClassName} h-5 w-28`} />
              <div className="mt-3 flex items-center gap-3">
                <div className={`${skeletonBlockClassName} h-14 w-14 rounded-xl`} />
                <div className="min-w-0 flex-1">
                  <div className={`${skeletonBlockClassName} h-4 w-56`} />
                  <div className={`${skeletonBlockClassName} mt-2 h-3 w-40`} />
                </div>
              </div>
              <div className={`${skeletonBlockClassName} mt-4 h-32 w-full`} />
              <div className={`${skeletonBlockClassName} mt-3 h-9 w-36`} />
            </div>
          ) : student ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">Resolved student</p>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#d2dfd9] bg-[#f8fcfa] p-3">
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
                  <span className="block truncate text-base font-semibold text-[#0a1f1a]">{student.full_name}</span>
                  <span className="block truncate text-xs text-[#4c6860]">/u/{student.share_slug}</span>
                </span>
              </div>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62]">
                Endorsement
                <textarea
                  value={endorsementText}
                  onChange={(event) => setEndorsementText(event.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm normal-case text-[#0a1f1a]"
                  placeholder="Describe this student's strengths, outcomes, and readiness."
                  disabled={isSaving}
                />
              </label>
              <p className="mt-2 text-xs text-[#557168]">{characterCount}/4000 characters</p>
              <button
                type="button"
                onClick={() => void saveEndorsement()}
                disabled={!canSave}
                className="mt-3 rounded-xl bg-[#12f987] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Endorsement"}
              </button>
            </>
          ) : (
            <p className="text-sm text-[#557168]">Resolve a student profile URL to start writing an endorsement.</p>
          )}
        </section>

        {saveError ? <p className="mt-4 text-sm font-medium text-rose-700">{saveError}</p> : null}
        {saveNotice ? (
          <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-sm font-medium text-[#44645b]">{saveNotice}</p>
        ) : null}
      </section>
    </main>
  );
}

function ReferrerEndorsementsPageFallback() {
  return (
    <main className="w-full px-6 py-12 lg:px-8">
      <section className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)]">
        <div className={`${skeletonBlockClassName} h-4 w-28`} />
        <div className={`${skeletonBlockClassName} mt-3 h-10 w-80`} />
        <div className={`${skeletonBlockClassName} mt-3 h-6 w-full`} />
        <div className={`${skeletonBlockClassName} mt-6 h-32 w-full`} />
        <div className={`${skeletonBlockClassName} mt-5 h-72 w-full`} />
      </section>
    </main>
  );
}
