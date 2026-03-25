"use client";

import { useEffect, useMemo, useState } from "react";

type StudentPhase1OnboardingProps = {
  defaultCampusEmail?: string;
  claimStatus?: string | null;
  onComplete: (payload: Record<string, unknown>) => Promise<void> | void;
};

type ProfilePayload = {
  profile?: {
    personal_info?: Record<string, unknown>;
  };
};

type ArtifactsPayload = {
  artifacts?: Array<{
    artifact_type?: string;
    artifact_data?: Record<string, unknown>;
  }>;
};

type ResumeExtractionResponse = {
  ok: boolean;
  error?: string;
  status?: string;
  data?: {
    artifacts?: Array<Record<string, unknown>>;
    signals?: {
      resume_email_mismatch?: {
        auth_email?: string | null;
        resume_email?: string | null;
        message?: string;
      } | null;
      low_extraction_confidence?: boolean;
    };
  };
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export function StudentPhase1Onboarding({
  defaultCampusEmail = "",
  claimStatus = null,
  onComplete,
}: StudentPhase1OnboardingProps) {
  const claimMode = claimStatus === "claimed" || claimStatus === "idempotent";
  const [isLoadingSignals, setIsLoadingSignals] = useState(claimMode);
  const [isSavingMismatchFlag, setIsSavingMismatchFlag] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeUploadPhase, setResumeUploadPhase] = useState<"idle" | "uploading" | "extracting">("idle");
  const [isUploadingTranscript, setIsUploadingTranscript] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [allowResumeReplacement, setAllowResumeReplacement] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [claimDecision, setClaimDecision] = useState<"pending" | "confirmed" | "flagged">(
    claimMode ? "pending" : "confirmed"
  );
  const [profileName, setProfileName] = useState("Candidate");
  const [artifactSignal, setArtifactSignal] = useState("No existing evidence signal found yet.");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null);
  const [resumeAccepted, setResumeAccepted] = useState(false);
  const [lowExtractionConfidence, setLowExtractionConfidence] = useState(false);
  const [resumeMismatchWarning, setResumeMismatchWarning] = useState<{
    authEmail: string | null;
    resumeEmail: string | null;
    message: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!claimMode) return;
    let active = true;

    const loadClaimSignals = async () => {
      setIsLoadingSignals(true);
      try {
        const [profileResponse, artifactsResponse] = await Promise.all([
          fetch("/api/student/profile", { cache: "no-store" }),
          fetch("/api/student/artifacts", { cache: "no-store" }),
        ]);

        const profilePayload = (await profileResponse.json().catch(() => null)) as
          | { ok: true; data?: ProfilePayload }
          | { ok: false; error?: string }
          | null;
        const artifactsPayload = (await artifactsResponse.json().catch(() => null)) as
          | { ok: true; data?: ArtifactsPayload }
          | { ok: false; error?: string }
          | null;

        if (!active) return;

        const personalInfo = toRecord(profilePayload?.ok ? profilePayload.data?.profile?.personal_info : {});
        const firstName = toTrimmedString(personalInfo.first_name);
        const lastName = toTrimmedString(personalInfo.last_name);
        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
        if (firstName.length > 0) setFirstNameInput(firstName);
        if (lastName.length > 0) setLastNameInput(lastName);
        if (fullName.length > 0) setProfileName(fullName);

        const firstArtifact = artifactsPayload?.ok ? artifactsPayload.data?.artifacts?.[0] : null;
        const firstArtifactData = toRecord(firstArtifact?.artifact_data);
        const artifactTitle = toTrimmedString(firstArtifactData.title);
        const artifactSource = toTrimmedString(firstArtifactData.source);
        if (artifactTitle.length > 0 || artifactSource.length > 0) {
          setArtifactSignal(
            `${artifactTitle.length > 0 ? artifactTitle : "Artifact"}${artifactSource.length > 0 ? ` · ${artifactSource}` : ""}`
          );
        }
      } catch {
        if (!active) return;
      } finally {
        if (active) setIsLoadingSignals(false);
      }
    };

    void loadClaimSignals();
    return () => {
      active = false;
    };
  }, [claimMode]);

  const claimWarning = useMemo(() => {
    if (!claimStatus) return null;
    if (claimStatus === "conflict") {
      return "Claim invite conflict detected. You can continue onboarding, but the claim was not applied.";
    }
    if (claimStatus === "invalid") {
      return "Claim invite is invalid or expired. You can continue with fresh onboarding.";
    }
    return null;
  }, [claimStatus]);

  const handleResumeUpload = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage("Uploading your resume...");
    setIsUploadingResume(true);
    setResumeUploadPhase("uploading");
    const extractionStatusTimer = window.setTimeout(() => {
      setResumeUploadPhase("extracting");
      setStatusMessage("Extracting your capability evidence. This usually takes 1 to 2 minutes.");
    }, 1200);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("flow", "onboarding");
      const response = await fetch("/api/student/extract/resume", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as ResumeExtractionResponse | null;

      if (!response.ok || !payload?.ok) {
        if (payload?.error === "claim_under_review") {
          setErrorMessage("Claim is under review. Resume updates are temporarily paused.");
          return;
        }
        if (payload?.error === "document_extraction_failed") {
          setResumeAccepted(true);
          setResumeFileName(file.name);
          setLowExtractionConfidence(true);
          setStatusMessage("Resume received. Extraction needs follow-up after onboarding.");
          return;
        }
        throw new Error(payload?.error ?? "resume_upload_failed");
      }

      setResumeAccepted(true);
      setResumeFileName(file.name);
      setAllowResumeReplacement(false);
      const lowConfidence = Boolean(payload.data?.signals?.low_extraction_confidence);
      setLowExtractionConfidence(lowConfidence);
      const mismatch = payload.data?.signals?.resume_email_mismatch;
      if (mismatch) {
        setResumeMismatchWarning({
          authEmail: mismatch.auth_email ?? null,
          resumeEmail: mismatch.resume_email ?? null,
          message:
            mismatch.message ??
            "Resume email does not match your account email. Employer linking may fail when emails differ.",
        });
      }
      setStatusMessage(
        lowConfidence
          ? "Resume received. We need a stronger extraction pass, but onboarding can continue."
          : "Resume received and capability evidence extracted."
      );
    } catch {
      setErrorMessage("Unable to upload your resume right now.");
    } finally {
      window.clearTimeout(extractionStatusTimer);
      setResumeUploadPhase("idle");
      setIsUploadingResume(false);
    }
  };

  const handleTranscriptUpload = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsUploadingTranscript(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/student/extract/transcript", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        if (payload?.error === "claim_under_review") {
          setErrorMessage("Claim is under review. Transcript updates are temporarily paused.");
          return;
        }
        throw new Error(payload?.error ?? "transcript_upload_failed");
      }

      setTranscriptFileName(file.name);
      setStatusMessage("Transcript received and extraction started.");
    } catch {
      setErrorMessage("Unable to upload your transcript right now.");
    } finally {
      setIsUploadingTranscript(false);
    }
  };

  const flagClaimMismatch = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSavingMismatchFlag(true);
    try {
      const response = await fetch("/api/student/onboarding/signals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "flag_claim_mismatch",
          reason: "student_flagged_mismatch_during_confirmation",
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !payload?.ok) throw new Error("flag_failed");

      setClaimDecision("flagged");
      setStatusMessage("Claim flagged for review. Automatic profile mutations are paused.");
    } catch {
      setErrorMessage("Unable to flag this claim right now.");
    } finally {
      setIsSavingMismatchFlag(false);
    }
  };

  const completeOnboarding = async () => {
    const normalizedFirstName = firstNameInput.trim();
    const normalizedLastName = lastNameInput.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      setErrorMessage("Enter your first and last name to continue.");
      return;
    }
    if (!resumeAccepted) {
      setErrorMessage("Upload your resume to continue.");
      return;
    }
    if (claimMode && claimDecision !== "confirmed") {
      setErrorMessage("Confirm the matched profile to continue.");
      return;
    }
    if (claimDecision === "flagged") {
      setErrorMessage("Claim is under review. Onboarding completion is paused.");
      return;
    }

    setIsCompleting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await onComplete({
        personal_info: {
          email: defaultCampusEmail,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
          onboarding_path: claimMode ? "claim" : "fresh",
          onboarding_artifact_intake: {
            resume_uploaded: true,
            resume_file_name: resumeFileName,
            transcript_uploaded: Boolean(transcriptFileName),
            transcript_file_name: transcriptFileName,
            low_extraction_confidence: lowExtractionConfidence,
          },
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "claim_under_review") {
        setErrorMessage("Claim is under review. Onboarding cannot be completed until review resolves.");
      } else {
        setErrorMessage("Unable to complete onboarding right now.");
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const onboardingBlockedByClaimReview = claimDecision === "flagged";

  return (
    <section aria-labelledby="student-onboarding-phase-1-title" className="w-full px-4 py-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-4xl rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4c6860] dark:text-slate-400">Student onboarding</p>
          <h1 id="student-onboarding-phase-1-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            Build your Evidence Profile from artifacts
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
            Upload your resume to start. Stu extracts structured evidence automatically so you do not need to manually fill profile fields.
          </p>
        </header>

        {claimWarning ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
            {claimWarning}
          </div>
        ) : null}

        {claimMode ? (
          <article className="mt-5 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Claim confirmation</p>
            {isLoadingSignals ? (
              <div className="mt-2 space-y-2" aria-hidden="true">
                <div className="h-4 w-48 animate-pulse rounded bg-[#deebe5] dark:bg-slate-700" />
                <div className="h-4 w-64 animate-pulse rounded bg-[#deebe5] dark:bg-slate-700" />
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-[#12352c] dark:text-slate-200">Matched profile: {profileName}</p>
                <p className="mt-1 text-sm text-[#4f6a62] dark:text-slate-300">Signal: {artifactSignal}</p>
              </>
            )}
            <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
              Read-only confirmation. You can confirm this match or flag a mismatch for review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setClaimDecision("confirmed");
                  setErrorMessage(null);
                  setStatusMessage("Claim confirmed.");
                }}
                disabled={onboardingBlockedByClaimReview || isSavingMismatchFlag}
                className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm match
              </button>
              <button
                type="button"
                onClick={() => void flagClaimMismatch()}
                disabled={isSavingMismatchFlag || onboardingBlockedByClaimReview}
                className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/40 dark:bg-slate-900 dark:text-rose-300"
              >
                {isSavingMismatchFlag ? "Flagging..." : "Flag mismatch"}
              </button>
            </div>
          </article>
        ) : null}

        <article className="mt-5 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Required profile fields</p>
          <h2 className="mt-2 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Your name</h2>
          <p className="mt-2 text-sm text-[#4f6a62] dark:text-slate-300">
            Add your first and last name so identity and recruiter-facing records remain stable.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              First name
              <input
                type="text"
                value={firstNameInput}
                onChange={(event) => setFirstNameInput(event.target.value)}
                placeholder="First name"
                className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#0a1f1a] outline-none transition-colors placeholder:text-[#7b948c] focus:border-[#12f987] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              Last name
              <input
                type="text"
                value={lastNameInput}
                onChange={(event) => setLastNameInput(event.target.value)}
                placeholder="Last name"
                className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#0a1f1a] outline-none transition-colors placeholder:text-[#7b948c] focus:border-[#12f987] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>
          </div>
        </article>

        <article className="mt-5 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Required artifact</p>
          <h2 className="mt-2 text-xl font-semibold text-[#0a1f1a] dark:text-slate-100">Upload resume</h2>
          <p className="mt-2 text-sm text-[#4f6a62] dark:text-slate-300">
            Resume upload is required for onboarding completion. Extraction runs immediately and usually finishes within 1 to 2 minutes.
          </p>
          {resumeAccepted && !allowResumeReplacement && !isUploadingResume ? (
            <div className="mt-3 inline-flex rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">
              Resume accepted
            </div>
          ) : (
            <label className="mt-3 inline-flex cursor-pointer rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                disabled={isUploadingResume || onboardingBlockedByClaimReview || (resumeAccepted && !allowResumeReplacement)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void handleResumeUpload(file);
                  event.currentTarget.value = "";
                }}
              />
              {isUploadingResume
                ? resumeUploadPhase === "uploading"
                  ? "Uploading resume..."
                  : "Extracting evidence..."
                : allowResumeReplacement
                  ? "Choose replacement resume"
                  : "Choose resume file"}
            </label>
          )}
          {resumeAccepted && !allowResumeReplacement ? (
            <button
              type="button"
              onClick={() => {
                setAllowResumeReplacement(true);
                setStatusMessage("Upload a new resume when ready. We will refresh extracted evidence and keep provenance-linked history.");
              }}
              className="mt-3 rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Upload a new resume
            </button>
          ) : null}
          {resumeFileName ? (
            <p className="mt-2 text-xs text-[#4f6a62] dark:text-slate-300">Latest resume: {resumeFileName}</p>
          ) : null}
          {resumeAccepted ? (
            <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Resume accepted.</p>
          ) : null}
          {isUploadingResume ? (
            <div className="mt-3 rounded-xl border border-[#c2e2d5] bg-[#ebf8f2] px-3 py-2 text-xs font-medium text-[#245648] dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">
              Extracting your capability evidence. This usually takes 1 to 2 minutes. Please keep this page open.
            </div>
          ) : null}
        </article>

        <article className="mt-4 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Optional artifact</p>
          <h2 className="mt-2 text-lg font-semibold text-[#0a1f1a] dark:text-slate-100">Upload transcript</h2>
          <p className="mt-2 text-sm text-[#4f6a62] dark:text-slate-300">
            Transcript upload is optional in onboarding and can improve evidence completeness.
          </p>
          <label className="mt-3 inline-flex cursor-pointer rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              disabled={isUploadingTranscript || onboardingBlockedByClaimReview}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleTranscriptUpload(file);
                event.currentTarget.value = "";
              }}
            />
            {isUploadingTranscript ? "Uploading transcript..." : "Choose transcript file"}
          </label>
          {transcriptFileName ? (
            <p className="mt-2 text-xs text-[#4f6a62] dark:text-slate-300">Latest transcript: {transcriptFileName}</p>
          ) : null}
        </article>

        {resumeMismatchWarning ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Email mismatch warning</p>
            <p className="mt-1">{resumeMismatchWarning.message}</p>
            <p className="mt-1 text-xs">
              Account email: {resumeMismatchWarning.authEmail ?? "Unknown"} · Resume email: {resumeMismatchWarning.resumeEmail ?? "Unknown"}
            </p>
          </div>
        ) : null}

        {lowExtractionConfidence ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900 dark:border-sky-400/35 dark:bg-sky-500/10 dark:text-sky-200">
            Extraction confidence is low. Onboarding can continue, and you can re-upload an improved resume after onboarding.
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-[#4a665d] dark:text-slate-300">
            {resumeAccepted ? "Resume requirement complete." : "Resume upload is required to continue."}
          </p>
          <button
            type="button"
            onClick={() => void completeOnboarding()}
            disabled={isCompleting || !resumeAccepted || onboardingBlockedByClaimReview || (claimMode && claimDecision !== "confirmed")}
            className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompleting ? "Finishing onboarding..." : "Complete onboarding"}
          </button>
        </div>

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
