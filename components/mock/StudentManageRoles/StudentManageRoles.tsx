"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { findBestOptionMatch, normalizeOptionLabel, normalizeOptionSearchKey } from "@/lib/text/fuzzy-option-match";

const toggledClassName =
  "border-[#0fd978] bg-[#e8fff3] text-[#0b3f2d] dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100";
const untoggledClassName =
  "border-[#d1e0d9] bg-white text-[#1f4035] hover:bg-[#f2f8f5] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#e4efe9] dark:bg-slate-700/70";
const targetPositionChangeConfirmationMessage =
  "Changing target positions updates the capability attributes tracked in your dashboard. Continue?";

type StudentProfileApiData = {
  profile: {
    personal_info?: Record<string, unknown>;
  };
  student_data?: Record<string, unknown>;
  role_options?: string[];
  company_options?: string[];
  referral_profile?: {
    share_slug?: string | null;
    share_path?: string | null;
  };
  endorsements?: Array<{
    endorsement_id: string;
    referrer_full_name: string;
    referrer_company?: string | null;
    referrer_position?: string | null;
    referrer_linkedin_url?: string | null;
    endorsement_text: string;
    updated_at?: string | null;
  }>;
};

type ProfileLinkKey = "linkedin" | "handshake" | "github" | "kaggle" | "otherRepo" | "portfolio";
type StudentManageRolesView = "all" | "profile" | "targets";
type CapabilitySourceType = "resume" | "transcript" | "linkedin" | "github" | "kaggle";

type SourceExtractionEntry = {
  last_extracted_at?: string;
  extracted_from?: string;
  extracted_from_filename?: string;
  artifact_count?: number;
  status?: "extracting" | "succeeded" | "failed";
  error_message?: string | null;
  warning_code?: string | null;
  warning_message?: string | null;
  last_run_summary?: string | null;
  identity_confidence?: "high" | "medium" | "low";
  storage_file_ref?: {
    bucket?: string;
    path?: string;
    kind?: string;
  };
};

type SourceExtractionLog = Partial<Record<CapabilitySourceType, SourceExtractionEntry>>;

type SourceDisplayState = "Not connected" | "Ready" | "Extracting" | "Up to date" | "Needs update" | "Failed";

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return fallback;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const resolvePersonalNames = (personalInfo: Record<string, unknown>): { firstName: string; lastName: string } => {
  const explicitFirst = asTrimmedString(personalInfo.first_name);
  const explicitLast = asTrimmedString(personalInfo.last_name);
  const fullName = asTrimmedString(personalInfo.full_name);

  if (explicitFirst && explicitLast) {
    return {
      firstName: explicitFirst,
      lastName: explicitLast,
    };
  }

  const fullNameTokens = fullName.split(/\s+/).filter(Boolean);
  const fallbackFirst = explicitFirst || fullNameTokens[0] || "";
  const fallbackLast = explicitLast || fullNameTokens.slice(1).join(" ");

  return {
    firstName: fallbackFirst,
    lastName: fallbackLast,
  };
};

const isAllowedVideoUrl = (value: string): boolean => {
  const normalized = value.trim();
  if (normalized.length === 0) return true;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "loom.com" ||
      host.endsWith(".loom.com") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = normalizeOptionLabel(item);
    const key = normalizeOptionSearchKey(normalized);
    if (key.length < 2) continue;
    if (!deduped.has(key)) deduped.set(key, normalized);
  }

  return Array.from(deduped.values());
};

const mergeOptionList = (options: string[], selected: string[]): string[] => {
  const deduped = new Map<string, string>();
  for (const item of [...options, ...selected]) {
    if (typeof item !== "string") continue;
    const normalized = normalizeOptionLabel(item);
    const key = normalizeOptionSearchKey(normalized);
    if (key.length < 2) continue;
    if (!deduped.has(key)) deduped.set(key, normalized);
  }
  return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b));
};

const sourceLabel: Record<CapabilitySourceType, string> = {
  resume: "Resume",
  transcript: "Transcript",
  linkedin: "LinkedIn",
  github: "GitHub",
  kaggle: "Kaggle"
};

const sourceStateToneClass: Record<SourceDisplayState, string> = {
  "Not connected": "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  Ready: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
  Extracting: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
  "Up to date": "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  "Needs update": "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  Failed: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
};

const normalizeGithubProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  const normalizedInput = trimmed.replace(/^@+/, "");
  if (!normalizedInput.includes("://") && !normalizedInput.includes("/")) {
    const username = normalizedInput.replace(/^\/+|\/+$/g, "");
    return username.length > 0 ? `https://github.com/${username}` : "";
  }

  try {
    const parsed = new URL(normalizedInput.includes("://") ? normalizedInput : `https://${normalizedInput}`);
    const host = parsed.hostname.toLowerCase();
    if (host === "github.com" || host === "www.github.com") {
      const [username] = parsed.pathname.split("/").filter(Boolean);
      if (username) return `https://github.com/${username}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeLinkedinProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("linkedin.com")) {
      const cleanedPath = parsed.pathname.replace(/\/+$/, "");
      if (cleanedPath.length > 0) return `https://www.linkedin.com${cleanedPath}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeKaggleProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("kaggle.com")) {
      const [username] = parsed.pathname.split("/").filter(Boolean);
      if (username) return `https://www.kaggle.com/${username}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

export function StudentManageRoles({ view = "all" }: { view?: StudentManageRolesView }) {
  const showProfileSections = view !== "targets";
  const showTargetSections = view !== "profile";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [employerOptions, setEmployerOptions] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
  const [customRoleName, setCustomRoleName] = useState("");
  const [customEmployerName, setCustomEmployerName] = useState("");
  const [profileLinks, setProfileLinks] = useState<Record<ProfileLinkKey, string>>({
    linkedin: "",
    handshake: "",
    github: "",
    kaggle: "",
    otherRepo: "",
    portfolio: ""
  });
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfileDetails, setIsSavingProfileDetails] = useState(false);
  const [isSavingExternalSignals, setIsSavingExternalSignals] = useState(false);
  const [hasSavedProfileDetails, setHasSavedProfileDetails] = useState(false);
  const [hasSavedExternalSignals, setHasSavedExternalSignals] = useState(false);
  const [isVisibleToTargetEmployers, setIsVisibleToTargetEmployers] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [sourceExtractionLog, setSourceExtractionLog] = useState<SourceExtractionLog>({});
  const [extractingSources, setExtractingSources] = useState<Partial<Record<CapabilitySourceType, boolean>>>({});
  const [studentSharePath, setStudentSharePath] = useState("");
  const [endorsements, setEndorsements] = useState<StudentProfileApiData["endorsements"]>([]);
  const [isCopyingShareUrl, setIsCopyingShareUrl] = useState(false);
  const [appOrigin, setAppOrigin] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/student/profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: StudentProfileApiData }
          | { ok: false; error?: string }
          | null;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error("profile_load_failed");
        }

        if (!isActive) return;

        const personalInfo = payload.data.profile?.personal_info ?? {};
        const studentData = payload.data.student_data ?? {};
        const loadedRoles = toStringArray(studentData.target_roles);
        const loadedEmployers = toStringArray(studentData.target_companies);
        const loadedEmployerVisibility = asBoolean(
          studentData.employer_visibility_opt_in ?? studentData.target_employer_visibility_opt_in,
          false
        );
        const artifactProfileLinks = toRecord(studentData.artifact_profile_links);
        const extractionProfileLinks = toRecord(studentData.profile_links);
        const savedLinks: Record<string, unknown> = { ...artifactProfileLinks };
        for (const [key, value] of Object.entries(extractionProfileLinks)) {
          const normalizedValue = asTrimmedString(value);
          if (normalizedValue.length > 0) {
            savedLinks[key] = normalizedValue;
            continue;
          }
          if (typeof value !== "string") {
            savedLinks[key] = value;
          }
        }
        const savedVideoLinks = toRecord(studentData.video_links);
        const extractionLog = toRecord(studentData.source_extraction_log);
        const availableRoles = mergeOptionList(toStringArray(payload.data.role_options ?? []), loadedRoles);
        const availableEmployers = mergeOptionList(toStringArray(payload.data.company_options ?? []), loadedEmployers);
        const referralProfile = toRecord(payload.data.referral_profile);
        const resolvedNames = resolvePersonalNames(personalInfo);

        setFirstName(resolvedNames.firstName);
        setLastName(resolvedNames.lastName);
        setEmail(asTrimmedString(personalInfo.email));
        setAvatarUrl(asTrimmedString(personalInfo.avatar_url) || asTrimmedString(personalInfo.avatarUrl));
        setStudentSharePath(asTrimmedString(referralProfile.share_path));
        setEndorsements(payload.data.endorsements ?? []);
        setSelectedRoles(loadedRoles);
        setSelectedEmployers(loadedEmployers);
        setIsVisibleToTargetEmployers(loadedEmployerVisibility);
        setRoleOptions(availableRoles);
        setEmployerOptions(availableEmployers);
        setSourceExtractionLog(extractionLog as SourceExtractionLog);
        setProfileLinks({
          linkedin: asTrimmedString(savedLinks.linkedin),
          handshake: asTrimmedString(savedLinks.handshake),
          github: asTrimmedString(savedLinks.github),
          kaggle: asTrimmedString(savedLinks.kaggle),
          otherRepo: asTrimmedString(savedLinks.other_repo) || asTrimmedString(savedLinks.otherRepo),
          portfolio:
            asTrimmedString(savedLinks.portfolio_url) ||
            asTrimmedString(savedLinks.portfolio) ||
            asTrimmedString(savedVideoLinks.project_demo_url)
        });
        setIntroVideoUrl(asTrimmedString(savedVideoLinks.intro_video_url));
        setStatusMessage(null);
      } catch {
        if (!isActive) return;
        setStatusMessage("Unable to load profile right now. Please refresh and try again.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  const hasNameFields = useMemo(() => firstName.trim().length > 1 && lastName.trim().length > 1, [firstName, lastName]);
  const canSaveProfileDetails = !isLoading && !isSavingProfileDetails && hasNameFields;
  const externalSignalSourceCount = useMemo(() => {
    return (
      Object.values(profileLinks).filter((value) => value.trim().length > 0).length + (introVideoUrl.trim().length > 0 ? 1 : 0)
    );
  }, [introVideoUrl, profileLinks]);
  const visibilityReadinessChecks = useMemo(
    () => [
      { key: "name", label: "First and last name are complete", done: hasNameFields },
      { key: "photo", label: "Profile photo is uploaded", done: avatarUrl.trim().length > 0 },
      { key: "roles", label: "At least one target position is selected", done: selectedRoles.length > 0 },
      { key: "employers", label: "At least one target employer is selected", done: selectedEmployers.length > 0 },
      { key: "signals", label: "At least one profile signal is added", done: externalSignalSourceCount > 0 }
    ],
    [avatarUrl, externalSignalSourceCount, hasNameFields, selectedEmployers.length, selectedRoles.length]
  );
  const completedVisibilityChecks = useMemo(
    () => visibilityReadinessChecks.filter((check) => check.done).length,
    [visibilityReadinessChecks]
  );
  const canEnableEmployerVisibility = useMemo(
    () => visibilityReadinessChecks.every((check) => check.done),
    [visibilityReadinessChecks]
  );
  const avatarFallbackInitials = useMemo(() => {
    const fullName = `${firstName} ${lastName}`.trim();
    const source = fullName.length > 0 ? fullName : email;
    const tokens = source
      .split(/[\s@._-]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) return "ST";
    const first = tokens[0]?.[0] ?? "";
    const second = tokens[1]?.[0] ?? "";
    const fallback = `${first}${second}`.toUpperCase();
    return fallback.length > 0 ? fallback : "ST";
  }, [email, firstName, lastName]);
  const canCopyShareUrl = useMemo(() => studentSharePath.trim().length > 0 && !isLoading && !isCopyingShareUrl, [isCopyingShareUrl, isLoading, studentSharePath]);
  const studentShareUrl = useMemo(() => {
    if (!studentSharePath) return "";
    return appOrigin ? `${appOrigin}${studentSharePath}` : studentSharePath;
  }, [appOrigin, studentSharePath]);
  const normalizedExternalLinks = useMemo(
    () => ({
      linkedin: normalizeLinkedinProfileUrl(profileLinks.linkedin),
      github: normalizeGithubProfileUrl(profileLinks.github),
      kaggle: normalizeKaggleProfileUrl(profileLinks.kaggle)
    }),
    [profileLinks.github, profileLinks.kaggle, profileLinks.linkedin]
  );
  const sourceRows = useMemo(() => {
    const getExternalState = (source: "linkedin" | "github" | "kaggle"): SourceDisplayState => {
      const entry = sourceExtractionLog[source];
      const configuredUrl = normalizedExternalLinks[source];
      if (!configuredUrl) return "Not connected";
      if (extractingSources[source] || entry?.status === "extracting") return "Extracting";
      if (entry?.status === "failed") return "Failed";
      if (!entry?.last_extracted_at) return "Ready";

      const extractedFrom = asTrimmedString(entry.extracted_from);
      if (extractedFrom && extractedFrom !== configuredUrl) return "Needs update";
      return entry?.status === "succeeded" ? "Up to date" : "Ready";
    };

    const getDocumentState = (source: "resume" | "transcript"): SourceDisplayState => {
      const entry = sourceExtractionLog[source];
      if (extractingSources[source] || entry?.status === "extracting") return "Extracting";
      if (entry?.status === "failed") return "Failed";
      const hasDocument = Boolean(
        asTrimmedString(entry?.extracted_from_filename) ||
          asTrimmedString(entry?.storage_file_ref?.path) ||
          asTrimmedString(entry?.storage_file_ref?.bucket)
      );
      if (!hasDocument) return "Not connected";
      return entry?.status === "succeeded" ? "Up to date" : "Ready";
    };

    return {
      resume: getDocumentState("resume"),
      transcript: getDocumentState("transcript"),
      linkedin: getExternalState("linkedin"),
      github: getExternalState("github"),
      kaggle: getExternalState("kaggle")
    } as Record<CapabilitySourceType, SourceDisplayState>;
  }, [extractingSources, normalizedExternalLinks, sourceExtractionLog]);
  const sourcesNeedingUpdate = useMemo(
    () =>
      (["linkedin", "github", "kaggle"] as CapabilitySourceType[]).filter(
        (source) => sourceRows[source] === "Needs update"
      ),
    [sourceRows]
  );

  const notifyStudentProfileUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("student-profile-updated"));
  };

  const copyShareUrl = async () => {
    if (!canCopyShareUrl) return;
    setIsCopyingShareUrl(true);
    try {
      await navigator.clipboard.writeText(studentShareUrl);
      setStatusMessage("Copied your shareable profile URL.");
    } catch {
      setStatusMessage("Unable to copy URL automatically. You can still copy it manually from the field.");
    } finally {
      setIsCopyingShareUrl(false);
    }
  };

  const toggleRole = (role: string) => {
    if (isLoading || isSaving) return;
    const normalized = normalizeOptionSearchKey(role);
    const nextSelectedRoles = selectedRoles.some((value) => normalizeOptionSearchKey(value) === normalized)
      ? selectedRoles.filter((value) => normalizeOptionSearchKey(value) !== normalized)
      : [...selectedRoles, role];
    if (nextSelectedRoles.length === 0) {
      setStatusMessage("Keep at least one target position selected.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(targetPositionChangeConfirmationMessage)) {
      return;
    }
    setSelectedRoles(nextSelectedRoles);
    setStatusMessage("Saving target positions...");
    void saveSelections({
      rolesOverride: nextSelectedRoles,
      employersOverride: selectedEmployers,
      successMessage: "Target positions saved. Capability tracking updated.",
    });
  };

  const toggleEmployer = (employer: string) => {
    if (isLoading || isSaving) return;
    const normalized = normalizeOptionSearchKey(employer);
    const nextSelectedEmployers = selectedEmployers.some((value) => normalizeOptionSearchKey(value) === normalized)
      ? selectedEmployers.filter((value) => normalizeOptionSearchKey(value) !== normalized)
      : [...selectedEmployers, employer];
    if (nextSelectedEmployers.length === 0) {
      setStatusMessage("Keep at least one target employer selected.");
      return;
    }
    setSelectedEmployers(nextSelectedEmployers);
    setStatusMessage("Saving target employers...");
    void saveSelections({
      rolesOverride: selectedRoles,
      employersOverride: nextSelectedEmployers,
      successMessage: "Target employers saved.",
    });
  };

  const addCustomRole = () => {
    if (isLoading || isSaving) return;
    const normalized = normalizeOptionLabel(customRoleName);
    const normalizedKey = normalizeOptionSearchKey(normalized);
    if (normalizedKey.length < 2) {
      setStatusMessage("Enter a valid role name before adding.");
      return;
    }

    const matched = findBestOptionMatch(normalized, roleOptions);
    const resolvedRole = matched?.option ?? normalized;
    const resolvedKey = normalizeOptionSearchKey(resolvedRole);
    if (typeof window !== "undefined" && !window.confirm(targetPositionChangeConfirmationMessage)) {
      return;
    }

    setRoleOptions((current) => {
      if (current.some((value) => normalizeOptionSearchKey(value) === resolvedKey)) return current;
      return mergeOptionList(current, [resolvedRole]);
    });
    const nextSelectedRoles = selectedRoles.some((value) => normalizeOptionSearchKey(value) === resolvedKey)
      ? selectedRoles
      : [...selectedRoles, resolvedRole];
    setSelectedRoles(nextSelectedRoles);
    setCustomRoleName("");
    setStatusMessage("Saving target positions...");
    void saveSelections({
      rolesOverride: nextSelectedRoles,
      employersOverride: selectedEmployers,
      successMessage: matched
        ? `Matched and saved role: ${resolvedRole}. Capability tracking updated.`
        : `Added and saved role: ${resolvedRole}. Capability tracking updated.`,
    });
  };

  const addCustomEmployer = () => {
    if (isLoading || isSaving) return;
    const normalized = normalizeOptionLabel(customEmployerName);
    const normalizedKey = normalizeOptionSearchKey(normalized);
    if (normalizedKey.length < 2) {
      setStatusMessage("Enter a valid employer name before adding.");
      return;
    }

    const matched = findBestOptionMatch(normalized, employerOptions);
    const resolvedEmployer = matched?.option ?? normalized;
    const resolvedKey = normalizeOptionSearchKey(resolvedEmployer);

    setEmployerOptions((current) => {
      if (current.some((value) => normalizeOptionSearchKey(value) === resolvedKey)) return current;
      return mergeOptionList(current, [resolvedEmployer]);
    });
    const nextSelectedEmployers = selectedEmployers.some((value) => normalizeOptionSearchKey(value) === resolvedKey)
      ? selectedEmployers
      : [...selectedEmployers, resolvedEmployer];
    setSelectedEmployers(nextSelectedEmployers);
    setCustomEmployerName("");
    setStatusMessage("Saving target employers...");
    void saveSelections({
      rolesOverride: selectedRoles,
      employersOverride: nextSelectedEmployers,
      successMessage: matched
        ? `Matched and saved employer: ${resolvedEmployer}.`
        : `Added and saved employer: ${resolvedEmployer}.`,
    });
  };

  const handleProfileLinkChange = (key: ProfileLinkKey, value: string) => {
    setProfileLinks((current) => ({
      ...current,
      [key]: value
    }));
    setHasSavedExternalSignals(false);
    if (key === "linkedin" || key === "github" || key === "kaggle") {
      setStatusMessage(`Your ${key === "linkedin" ? "LinkedIn" : key === "github" ? "GitHub" : "Kaggle"} link changed. Extract to update your profile.`);
    }
  };

  const refreshSourceExtractionState = async () => {
    const response = await fetch("/api/student/artifacts", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | { ok: true; data: { source_extraction_log?: unknown; profile_links?: Record<string, unknown> } }
      | { ok: false; error?: string }
      | null;
    if (!response.ok || !payload || !payload.ok) throw new Error("source_state_refresh_failed");

    const extractionLog = toRecord(payload.data.source_extraction_log);
    setSourceExtractionLog(extractionLog as SourceExtractionLog);

    const profileLinksFromArtifacts = toRecord(payload.data.profile_links);
    setProfileLinks((current) => ({
      ...current,
      linkedin: asTrimmedString(profileLinksFromArtifacts.linkedin) || current.linkedin,
      github: asTrimmedString(profileLinksFromArtifacts.github) || current.github,
      kaggle: asTrimmedString(profileLinksFromArtifacts.kaggle) || current.kaggle
    }));
  };

  const setSourceLoadingState = (source: CapabilitySourceType, isLoadingSource: boolean) => {
    setExtractingSources((current) => ({
      ...current,
      [source]: isLoadingSource
    }));
  };

  const shouldConfirmReextract = (source: CapabilitySourceType): boolean => sourceExtractionLog[source]?.status === "succeeded";

  const parseGithubUsername = (value: string): string => {
    const normalized = normalizeGithubProfileUrl(value);
    if (!normalized) return "";
    return normalized.replace(/^https?:\/\/github\.com\//, "").split("/")[0] ?? "";
  };

  const resolveExtractionFailureMessage = (errorCode: string, source: CapabilitySourceType): string => {
    if (errorCode === "source_url_invalid_or_unsupported") return "Source link is invalid or unsupported.";
    if (errorCode === "source_not_found") return `${sourceLabel[source]} profile not found. Check the URL and try again.`;
    if (errorCode === "source_private_or_inaccessible") {
      return `${sourceLabel[source]} is private or inaccessible. Make it public and retry extraction.`;
    }
    return `${sourceLabel[source]} extraction failed. Please try again.`;
  };

  const runExternalSourceExtraction = async ({
    source,
    allowLowConfidence = false
  }: {
    source: "linkedin" | "github" | "kaggle";
    allowLowConfidence?: boolean;
  }) => {
    if (extractingSources[source]) return;

    const linkValue = source === "linkedin" ? profileLinks.linkedin : source === "github" ? profileLinks.github : profileLinks.kaggle;
    const normalizedLink =
      source === "linkedin"
        ? normalizeLinkedinProfileUrl(linkValue)
        : source === "github"
          ? normalizeGithubProfileUrl(linkValue)
          : normalizeKaggleProfileUrl(linkValue);
    if (!normalizedLink) {
      setStatusMessage(`Add your ${sourceLabel[source]} URL first, then extract.`);
      return;
    }

    if (!allowLowConfidence && shouldConfirmReextract(source)) {
      const confirmed = window.confirm(
        `Re-extract from ${sourceLabel[source]}?\n\nWe'll keep previous versions, avoid duplicate entries when nothing has changed, and create new provenance-linked versions when content changes.`
      );
      if (!confirmed) return;
    }

    setSourceLoadingState(source, true);
    setSourceExtractionLog((current) => ({
      ...current,
      [source]: {
        ...(current[source] ?? {}),
        status: "extracting",
        error_message: null
      }
    }));

    try {
      const endpoint = source === "linkedin" ? "/api/student/extract/linkedin" : source === "github" ? "/api/student/extract/github" : "/api/student/extract/kaggle";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          source === "github"
            ? { github_username: parseGithubUsername(normalizedLink), allow_low_confidence: allowLowConfidence }
            : { profile_url: normalizedLink, allow_low_confidence: allowLowConfidence }
        )
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: Record<string, unknown> }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        const failureCode = payload && !payload.ok && typeof payload.error === "string" ? payload.error : "extraction_failed";
        throw new Error(failureCode);
      }

      const status = asTrimmedString(payload.data.status);
      const sourceRun = toRecord(payload.data.source_run);
      const requiresConfirmation = asBoolean(sourceRun.requires_confirmation, false) || status === "confirmation_required";
      if (requiresConfirmation && !allowLowConfidence) {
        const reason =
          asTrimmedString(sourceRun.warning_message) ||
          `We couldn't confidently match this ${sourceLabel[source]} profile to your identity.`;
        const confirmed = window.confirm(`${reason}\n\nExtract anyway?`);
        if (confirmed) {
          await runExternalSourceExtraction({ source, allowLowConfidence: true });
        } else {
          setStatusMessage(`${sourceLabel[source]} extraction canceled.`);
          await refreshSourceExtractionState();
        }
        return;
      }

      await refreshSourceExtractionState();
      const summary = asTrimmedString(sourceRun.result_summary);
      const warning = asTrimmedString(sourceRun.warning_message);
      if (summary) setStatusMessage(warning ? `${summary} ${warning}` : summary);
      else if (warning) setStatusMessage(warning);
      else setStatusMessage(`${sourceLabel[source]} extraction completed.`);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "extraction_failed";
      setStatusMessage(resolveExtractionFailureMessage(errorCode, source));
      setSourceExtractionLog((current) => ({
        ...current,
        [source]: {
          ...(current[source] ?? {}),
          status: "failed",
          error_message: resolveExtractionFailureMessage(errorCode, source)
        }
      }));
    } finally {
      setSourceLoadingState(source, false);
    }
  };

  const runDocumentSourceExtraction = async ({ source, file }: { source: "resume" | "transcript"; file: File }) => {
    if (extractingSources[source]) return;
    if (shouldConfirmReextract(source)) {
      const confirmed = window.confirm(
        `Re-extract from ${sourceLabel[source]}?\n\nWe'll keep previous versions, avoid duplicate entries when nothing has changed, and create new provenance-linked versions when content changes.`
      );
      if (!confirmed) return;
    }

    setSourceLoadingState(source, true);
    setSourceExtractionLog((current) => ({
      ...current,
      [source]: {
        ...(current[source] ?? {}),
        status: "extracting",
        extracted_from_filename: file.name,
        error_message: null
      }
    }));

    try {
      const endpoint = source === "resume" ? "/api/student/extract/resume" : "/api/student/extract/transcript";
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(endpoint, { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { artifacts?: unknown[]; signals?: Record<string, unknown> } }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !payload || !payload.ok) {
        const errorCode = payload && !payload.ok && typeof payload.error === "string" ? payload.error : "extraction_failed";
        throw new Error(errorCode);
      }

      await refreshSourceExtractionState();
      const addedArtifacts = Array.isArray(payload.data.artifacts) ? payload.data.artifacts.length : 0;
      const artifactLabel = addedArtifacts === 1 ? "artifact" : "artifacts";
      const defaultSummary =
        addedArtifacts === 0
          ? "No new artifacts found. Your profile is already up to date."
          : `${addedArtifacts} new ${artifactLabel} added from ${sourceLabel[source]}.`;
      const lowConfidence = asBoolean(toRecord(payload.data.signals).low_extraction_confidence, false);
      setStatusMessage(
        lowConfidence
          ? `${defaultSummary} Extraction confidence was low; consider uploading a clearer file.`
          : defaultSummary
      );
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "extraction_failed";
      const message =
        errorCode === "unsupported_file_type"
          ? "Only PDF or DOCX files are supported."
          : errorCode === "claim_under_review"
            ? "Profile claim is under review. Extraction is paused until review completes."
            : `${sourceLabel[source]} extraction failed. Please try again.`;
      setStatusMessage(message);
      setSourceExtractionLog((current) => ({
        ...current,
        [source]: {
          ...(current[source] ?? {}),
          status: "failed",
          error_message: message
        }
      }));
    } finally {
      setSourceLoadingState(source, false);
    }
  };

  const handleSourceDocumentInput = (source: "resume" | "transcript", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void runDocumentSourceExtraction({ source, file });
    event.currentTarget.value = "";
  };

  const uploadAvatar = async (file: File) => {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setStatusMessage("Profile photo must be PNG, JPG, or WEBP.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setStatusMessage("Profile photo must be under 5MB.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const uploadForm = new FormData();
      uploadForm.set("file", file);

      const uploadResponse = await fetch("/api/student/artifacts/files", {
        method: "POST",
        body: uploadForm
      });
      const uploadPayload = (await uploadResponse.json().catch(() => null)) as
        | { ok: true; data: { file_ref: Record<string, unknown> } }
        | { ok: false; error?: string }
        | null;

      if (!uploadResponse.ok || !uploadPayload || !uploadPayload.ok) {
        throw new Error("avatar_file_upload_failed");
      }

      const saveResponse = await fetch("/api/student/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          personal_info: {
            avatar_file_ref: uploadPayload.data.file_ref
          }
        })
      });
      const savePayload = (await saveResponse.json().catch(() => null)) as
        | { ok: true; data: { profile?: { personal_info?: Record<string, unknown> } } }
        | { ok: false; error?: string }
        | null;

      if (!saveResponse.ok || !savePayload || !savePayload.ok) {
        throw new Error("avatar_profile_save_failed");
      }

      const savedPersonalInfo = toRecord(savePayload.data.profile?.personal_info);
      setAvatarUrl(asTrimmedString(savedPersonalInfo.avatar_url) || asTrimmedString(savedPersonalInfo.avatarUrl));
      setStatusMessage("Profile photo updated.");
      notifyStudentProfileUpdated();
    } catch {
      setStatusMessage("Unable to update profile photo right now.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadAvatar(file);
    event.currentTarget.value = "";
  };

  const saveExternalSignals = async () => {
    const hasLinks = Object.values(profileLinks).some((value) => value.trim().length > 0);
    const hasIntroVideo = introVideoUrl.trim().length > 0;

    if (!hasLinks && !hasIntroVideo) {
      setStatusMessage("Add at least one profile link or video URL before saving.");
      return;
    }

    if (!isAllowedVideoUrl(introVideoUrl)) {
      setStatusMessage("Intro video link must be a valid YouTube or Loom URL.");
      return;
    }

    setIsSavingExternalSignals(true);
    try {
      const response = await fetch("/api/student/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          student_data: {
            artifact_profile_links: {
              linkedin: profileLinks.linkedin.trim(),
              handshake: profileLinks.handshake.trim(),
              github: profileLinks.github.trim(),
              kaggle: profileLinks.kaggle.trim(),
              other_repo: profileLinks.otherRepo.trim(),
              portfolio_url: profileLinks.portfolio.trim()
            },
            profile_links: {
              linkedin: profileLinks.linkedin.trim(),
              github: profileLinks.github.trim(),
              kaggle: profileLinks.kaggle.trim()
            },
            video_links: {
              intro_video_url: introVideoUrl.trim()
            }
          }
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error("external_links_save_failed");
      }

      const sourceCount =
        Object.values(profileLinks).filter((value) => value.trim().length > 0).length +
        (hasIntroVideo ? 1 : 0);
      setHasSavedExternalSignals(true);
      setStatusMessage(`Saved ${sourceCount} external signal source${sourceCount === 1 ? "" : "s"}.`);
    } catch {
      setStatusMessage("Unable to save profile/video links right now.");
    } finally {
      setIsSavingExternalSignals(false);
    }
  };

  const saveSelections = async ({
    visibilityOverride,
    rolesOverride,
    employersOverride,
    successMessage,
  }: {
    visibilityOverride?: boolean;
    rolesOverride?: string[];
    employersOverride?: string[];
    successMessage?: string;
  } = {}) => {
    const rolesToSave = rolesOverride ?? selectedRoles;
    const employersToSave = employersOverride ?? selectedEmployers;
    if (rolesToSave.length === 0 || employersToSave.length === 0) {
      setStatusMessage("Choose at least one role and one employer before saving.");
      return false;
    }

    const visibilityToSave = visibilityOverride ?? isVisibleToTargetEmployers;
    setIsSaving(true);
    try {
      const response = await fetch("/api/student/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          personal_info: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim()
          },
          student_data: {
            target_roles: rolesToSave,
            target_companies: employersToSave,
            employer_visibility_opt_in: visibilityToSave
          }
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { student_data?: Record<string, unknown> } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("profile_save_failed");
      }

      const savedStudentData = payload.data.student_data ?? {};
      const savedRoles = toStringArray(savedStudentData.target_roles);
      const savedEmployers = toStringArray(savedStudentData.target_companies);
      const savedVisibility = asBoolean(
        savedStudentData.employer_visibility_opt_in ?? savedStudentData.target_employer_visibility_opt_in,
        visibilityToSave
      );
      setSelectedRoles(savedRoles);
      setSelectedEmployers(savedEmployers);
      setIsVisibleToTargetEmployers(savedVisibility);
      setRoleOptions((current) => mergeOptionList(current, savedRoles));
      setEmployerOptions((current) => mergeOptionList(current, savedEmployers));
      setStatusMessage(
        successMessage ??
          (savedVisibility
            ? `You are now visible to ${savedEmployers.length} selected employer${savedEmployers.length === 1 ? "" : "s"}.`
            : "Targets saved. You are currently private to selected employers.")
      );
      notifyStudentProfileUpdated();
      return true;
    } catch {
      setStatusMessage("We couldn't save your profile right now. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfileDetails = async () => {
    if (!hasNameFields) {
      setStatusMessage("Add first and last name before saving profile details.");
      return;
    }

    setIsSavingProfileDetails(true);
    try {
      const response = await fetch("/api/student/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          personal_info: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim()
          }
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { profile?: { personal_info?: Record<string, unknown> } } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("profile_details_save_failed");
      }

      const savedPersonalInfo = toRecord(payload.data.profile?.personal_info);
      setFirstName(asTrimmedString(savedPersonalInfo.first_name) || firstName.trim());
      setLastName(asTrimmedString(savedPersonalInfo.last_name) || lastName.trim());
      setHasSavedProfileDetails(true);
      setStatusMessage("Profile details updated.");
      notifyStudentProfileUpdated();
    } catch {
      setStatusMessage("Unable to save profile details right now.");
    } finally {
      setIsSavingProfileDetails(false);
    }
  };

  const handleEnableVisibilityRecommendation = () => {
    if (!canEnableEmployerVisibility) {
      setStatusMessage("Complete the visibility checklist before enabling recruiter visibility.");
      return;
    }
    void saveSelections({ visibilityOverride: true });
  };

  const renderTargetSelectionSkeleton = (prefix: string) => (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`${prefix}-chip-${index}`} className={`${skeletonBlockClassName} h-8 w-24`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className={`${skeletonBlockClassName} h-10 min-w-[220px] flex-1`} />
        <div className={`${skeletonBlockClassName} h-10 w-24`} />
      </div>
    </>
  );

  const renderProfileDetailsSkeleton = () => (
    <>
      <div className="mt-3 grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className={`${skeletonBlockClassName} h-20 w-20 rounded-2xl`} />
          <div className={`${skeletonBlockClassName} h-9 w-28`} />
          <div className={`${skeletonBlockClassName} h-3 w-28`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`profile-detail-skeleton-${index}`} className={`${skeletonBlockClassName} h-11 w-full`} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <div className={`${skeletonBlockClassName} h-9 w-40`} />
      </div>
    </>
  );

  const renderProfileLinksSkeleton = () => (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`profile-link-skeleton-${index}`} className={`${skeletonBlockClassName} h-11 w-full`} />
        ))}
      </div>
      <div className="mt-4">
        <div className={`${skeletonBlockClassName} h-11 w-full`} />
      </div>
      <div className={`${skeletonBlockClassName} mt-2 h-3 w-40`} />
      <div className="mt-3 flex justify-end">
        <div className={`${skeletonBlockClassName} h-9 w-48`} />
      </div>
    </>
  );

  return (
    <section aria-labelledby="student-manage-roles-title" className="w-full px-4 py-6 lg:px-8 lg:py-12">
      <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:border-[#cfddd6] lg:bg-[#f8fcfa] lg:p-6 lg:shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-0 dark:bg-transparent lg:dark:border-slate-700 lg:dark:bg-slate-900/75">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
            {showTargetSections && !showProfileSections ? "Student Coaching Targets" : "Student Profile"}
          </p>
          <h2 id="student-manage-roles-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            {showProfileSections && showTargetSections
              ? "Manage profile and focus targets"
              : showProfileSections
                ? "Manage profile"
                : "My Positions & Employers"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
            {showProfileSections && showTargetSections
              ? "Edit your profile details and update which positions and employers you want coaching to prioritize."
              : showProfileSections
                ? "Update your profile details, links, and avatar used across student experiences."
                : "Set role and employer targets, then use dedicated coaching tools to focus your next actions."}
          </p>
          <div className="mt-4">
            {showProfileSections && !showTargetSections ? (
              <Link
                href="/student/targets"
                className="inline-flex rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Go to My Positions & Employers
              </Link>
            ) : null}
            {showTargetSections && !showProfileSections ? (
              <Link
                href="/student/profile"
                className="inline-flex rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Back to Profile
              </Link>
            ) : null}
          </div>
        </header>

        {showProfileSections ? (
          <>
            <div className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              {isLoading ? (
                renderProfileDetailsSkeleton()
              ) : (
                <>
                  <div className="mt-3 grid gap-4 lg:grid-cols-[auto_1fr]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#bfd2ca] bg-[#e8f2ed] text-lg font-semibold text-[#1f4338] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
                        ) : (
                          <span>{avatarFallbackInitials}</span>
                        )}
                      </div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {isUploadingAvatar ? "Uploading..." : "Upload photo"}
                      </button>
                      <p className="text-[11px] text-[#557168] dark:text-slate-400">PNG, JPG, or WEBP up to 5MB</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        First name
                        <input
                          value={firstName}
                          onChange={(event) => {
                            setFirstName(event.target.value);
                            setHasSavedProfileDetails(false);
                          }}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Last name
                        <input
                          value={lastName}
                          onChange={(event) => {
                            setLastName(event.target.value);
                            setHasSavedProfileDetails(false);
                          }}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Email
                        <input
                          value={email}
                          readOnly
                          className="mt-2 h-11 w-full cursor-not-allowed rounded-xl border border-[#bfd2ca] bg-[#f3f7f5] px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveProfileDetails()}
                      disabled={!canSaveProfileDetails}
                      className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingProfileDetails ? "Saving..." : hasSavedProfileDetails ? "Saved" : "Save profile details"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Profile links and intro video</h3>
              <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
                Add profile links and an optional YouTube/Loom intro video so recruiters can review context quickly.
              </p>
              {isLoading ? (
                renderProfileLinksSkeleton()
              ) : (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      LinkedIn URL
                      <input
                        value={profileLinks.linkedin}
                        onChange={(event) => handleProfileLinkChange("linkedin", event.target.value)}
                        placeholder="https://linkedin.com/in/username"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Handshake URL
                      <input
                        value={profileLinks.handshake}
                        onChange={(event) => handleProfileLinkChange("handshake", event.target.value)}
                        placeholder="https://joinhandshake.com/..."
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      GitHub URL
                      <input
                        value={profileLinks.github}
                        onChange={(event) => handleProfileLinkChange("github", event.target.value)}
                        placeholder="https://github.com/username"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Kaggle URL
                      <input
                        value={profileLinks.kaggle}
                        onChange={(event) => handleProfileLinkChange("kaggle", event.target.value)}
                        placeholder="https://www.kaggle.com/username"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Other repo URL
                      <input
                        value={profileLinks.otherRepo}
                        onChange={(event) => handleProfileLinkChange("otherRepo", event.target.value)}
                        placeholder="GitLab / Bitbucket / other"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Portfolio URL
                      <input
                        value={profileLinks.portfolio}
                        onChange={(event) => handleProfileLinkChange("portfolio", event.target.value)}
                        placeholder="https://your-portfolio.com"
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                      Intro video link
                      <input
                        value={introVideoUrl}
                        onChange={(event) => {
                          setIntroVideoUrl(event.target.value);
                          setHasSavedExternalSignals(false);
                        }}
                        placeholder="https://www.youtube.com/... or https://www.loom.com/..."
                        className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">Accepted hosts: YouTube and Loom.</p>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveExternalSignals()}
                      disabled={isLoading || isSavingExternalSignals}
                      className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {isSavingExternalSignals ? "Saving links..." : hasSavedExternalSignals ? "Saved" : "Save profile and video links"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div id="capability-sources" className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 scroll-mt-24 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Capability Sources</h3>
              <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
                Manage source extraction here. Resume and transcript are primary artifacts; LinkedIn, GitHub, and Kaggle add supporting evidence.
              </p>
              {sourcesNeedingUpdate.length > 0 ? (
                <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  Your {sourcesNeedingUpdate.map((source) => sourceLabel[source]).join(" and ")} source
                  {sourcesNeedingUpdate.length > 1 ? "s have" : " has"} changed. Extract to update your profile.
                </p>
              ) : null}
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(event) => handleSourceDocumentInput("resume", event)}
              />
              <input
                ref={transcriptInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(event) => handleSourceDocumentInput("transcript", event)}
              />

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Primary artifacts</p>
                  <div className="mt-2 space-y-2">
                    {(["resume", "transcript"] as const).map((source) => {
                      const state = sourceRows[source];
                      const entry = sourceExtractionLog[source];
                      const lastSummary = asTrimmedString(entry?.last_run_summary);
                      const lastExtractedAt = asTrimmedString(entry?.last_extracted_at);
                      const fileName = asTrimmedString(entry?.extracted_from_filename);
                      const isExtracting = Boolean(extractingSources[source] || state === "Extracting");
                      return (
                        <div
                          key={`source-row-${source}`}
                          className="rounded-xl border border-[#d2dfd9] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[#0a1f1a] dark:text-slate-100">{sourceLabel[source]}</p>
                              <p className="text-xs text-[#557168] dark:text-slate-400">
                                {fileName ? `Latest file: ${fileName}` : "PDF or DOCX upload"}
                              </p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sourceStateToneClass[state]}`}>
                              {state}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => (source === "resume" ? resumeInputRef.current?.click() : transcriptInputRef.current?.click())}
                              disabled={isExtracting}
                              className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {isExtracting ? "Extracting..." : state === "Up to date" ? "Upload new and re-extract" : "Upload and extract"}
                            </button>
                            {lastExtractedAt ? (
                              <span className="text-[11px] text-[#557168] dark:text-slate-400">
                                Last run: {new Date(lastExtractedAt).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                          {lastSummary ? <p className="mt-2 text-xs text-[#4f6a62] dark:text-slate-300">{lastSummary}</p> : null}
                          {entry?.error_message ? (
                            <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">{entry.error_message}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">External sources</p>
                  <div className="mt-2 space-y-2">
                    {(["linkedin", "github", "kaggle"] as const).map((source) => {
                      const state = sourceRows[source];
                      const entry = sourceExtractionLog[source];
                      const urlValue =
                        source === "linkedin"
                          ? normalizedExternalLinks.linkedin
                          : source === "github"
                            ? normalizedExternalLinks.github
                            : normalizedExternalLinks.kaggle;
                      const isExtracting = Boolean(extractingSources[source] || state === "Extracting");
                      const lastExtractedAt = asTrimmedString(entry?.last_extracted_at);
                      const lastSummary = asTrimmedString(entry?.last_run_summary);
                      const warning = asTrimmedString(entry?.warning_message);

                      return (
                        <div
                          key={`source-row-${source}`}
                          className="rounded-xl border border-[#d2dfd9] bg-[#f8fcfa] p-3 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[#0a1f1a] dark:text-slate-100">{sourceLabel[source]}</p>
                              <p className="text-xs text-[#557168] dark:text-slate-400">{urlValue || "Add URL in Profile links above"}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sourceStateToneClass[state]}`}>
                              {state}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void runExternalSourceExtraction({ source })}
                              disabled={isExtracting || urlValue.length === 0}
                              className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {isExtracting ? "Extracting..." : state === "Up to date" ? "Re-extract" : "Extract"}
                            </button>
                            {lastExtractedAt ? (
                              <span className="text-[11px] text-[#557168] dark:text-slate-400">
                                Last run: {new Date(lastExtractedAt).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                          {lastSummary ? <p className="mt-2 text-xs text-[#4f6a62] dark:text-slate-300">{lastSummary}</p> : null}
                          {warning ? <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{warning}</p> : null}
                          {entry?.error_message ? (
                            <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">{entry.error_message}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Referrals and endorsements</h3>
              <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
                Share this profile URL with referrers so they can submit endorsements on your behalf.
              </p>

              {isLoading ? (
                <>
                  <div className={`${skeletonBlockClassName} mt-3 h-11 w-full`} />
                  <div className={`${skeletonBlockClassName} mt-3 h-9 w-36`} />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-hidden="true">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={`endorsement-skeleton-${index}`} className="rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3">
                        <div className={`${skeletonBlockClassName} h-4 w-32`} />
                        <div className={`${skeletonBlockClassName} mt-2 h-3 w-44`} />
                        <div className={`${skeletonBlockClassName} mt-3 h-3 w-full`} />
                        <div className={`${skeletonBlockClassName} mt-2 h-3 w-5/6`} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={studentShareUrl}
                      readOnly
                      className="h-11 min-w-[260px] flex-1 rounded-xl border border-[#bfd2ca] bg-[#f3f7f5] px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => void copyShareUrl()}
                      disabled={!canCopyShareUrl}
                      className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {isCopyingShareUrl ? "Copying..." : "Copy URL"}
                    </button>
                  </div>

                  {endorsements && endorsements.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {endorsements.map((endorsement) => (
                        <article
                          key={endorsement.endorsement_id}
                          className="rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3 text-xs leading-6 text-[#48635b] dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                        >
                          <p className="text-sm font-semibold text-[#0a1f1a] dark:text-slate-100">{endorsement.referrer_full_name}</p>
                          <p className="text-[11px] text-[#557168] dark:text-slate-400">
                            {[endorsement.referrer_position, endorsement.referrer_company].filter(Boolean).join(" · ") || "Referrer"}
                          </p>
                          <p className="mt-2">{endorsement.endorsement_text}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-[#557168] dark:text-slate-400">No endorsements yet. Share your URL to start collecting referrals.</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}

        {showTargetSections ? (
          <>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Target Positions</h3>
                <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">Your coaching and pathway plans prioritize these role tracks.</p>
                {isLoading ? (
                  renderTargetSelectionSkeleton("target-positions")
                ) : (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {roleOptions.map((role) => {
                        const isSelected = selectedRoles.some(
                          (value) => normalizeOptionSearchKey(value) === normalizeOptionSearchKey(role)
                        );
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(role)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${isSelected ? toggledClassName : untoggledClassName}`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={customRoleName}
                        onChange={(event) => {
                          setCustomRoleName(event.target.value);
                        }}
                        placeholder="Add role title"
                        className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={addCustomRole}
                        disabled={customRoleName.trim().length < 2}
                        className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Add role
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Target Employers</h3>
                    {isLoading ? (
                      <span className={`${skeletonBlockClassName} h-5 w-14 rounded-full`} aria-hidden="true" />
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          isVisibleToTargetEmployers
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {isVisibleToTargetEmployers ? "Visible" : "Private"}
                      </span>
                    )}
                  </div>
                  {isLoading ? (
                    <span className={`${skeletonBlockClassName} h-8 w-52 rounded-full`} aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isVisibleToTargetEmployers}
                      onClick={() => {
                        if (isLoading || isSaving) return;
                        const nextVisibility = !isVisibleToTargetEmployers;
                        if (!isVisibleToTargetEmployers && !canEnableEmployerVisibility) {
                          setStatusMessage("Complete the visibility checklist before enabling recruiter visibility.");
                          return;
                        }
                        setIsVisibleToTargetEmployers(nextVisibility);
                        setStatusMessage("Saving visibility preference...");
                        void saveSelections({
                          rolesOverride: selectedRoles,
                          employersOverride: selectedEmployers,
                          visibilityOverride: nextVisibility,
                          successMessage: nextVisibility
                            ? "You are now visible to selected employers."
                            : "Visibility updated. Your profile is private to selected employers."
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#bfd2ca] bg-[#f5faf7] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#ebf5f0] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <span>{isVisibleToTargetEmployers ? "Visible to selected employers" : "Private to you"}</span>
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          isVisibleToTargetEmployers ? "bg-[#12f987]" : "bg-[#c8d9d1] dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isVisibleToTargetEmployers ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  )}
                </div>
                {isLoading ? (
                  <>
                    <div className={`${skeletonBlockClassName} mt-2 h-3 w-3/4`} />
                    <div className={`${skeletonBlockClassName} mt-2 h-3 w-5/6`} />
                    <div className={`${skeletonBlockClassName} mt-2 h-3 w-2/3`} />
                    <div className="mt-3 rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className={`${skeletonBlockClassName} h-3 w-40`} />
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={`employer-check-skeleton-${index}`} className={`${skeletonBlockClassName} h-3 w-full`} />
                        ))}
                      </div>
                    </div>
                    {renderTargetSelectionSkeleton("target-employers")}
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">Recruiter signal and role guidance are tuned to these employers.</p>
                    <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">
                      {isVisibleToTargetEmployers
                        ? "Employers in this list can view your profile and signals when applicable."
                        : "Your selected employers are saved, but your profile remains hidden from them."}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#47645b] dark:text-slate-300">
                      Scope: visibility is limited to employers listed in My Employers.
                    </p>
                    <div className="mt-3 rounded-xl border border-[#d7e3dd] bg-[#f7fbf9] p-3 dark:border-slate-700 dark:bg-slate-800/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#47645b] dark:text-slate-300">
                        Visibility readiness {completedVisibilityChecks}/{visibilityReadinessChecks.length}
                      </p>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {visibilityReadinessChecks.map((check) => (
                          <p
                            key={check.key}
                            className={`text-xs ${check.done ? "text-[#1f5a45] dark:text-emerald-300" : "text-[#5a786e] dark:text-slate-400"}`}
                          >
                            {check.done ? "✓" : "•"} {check.label}
                          </p>
                        ))}
                      </div>
                      {!isVisibleToTargetEmployers && canEnableEmployerVisibility ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={handleEnableVisibilityRecommendation}
                            disabled={isSaving}
                            className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? "Saving..." : "Go Visible to Selected Employers"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {employerOptions.map((employer) => {
                        const isSelected = selectedEmployers.some(
                          (value) => normalizeOptionSearchKey(value) === normalizeOptionSearchKey(employer)
                        );
                        return (
                          <button
                            key={employer}
                            type="button"
                            onClick={() => toggleEmployer(employer)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${isSelected ? toggledClassName : untoggledClassName}`}
                          >
                            {employer}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={customEmployerName}
                        onChange={(event) => {
                          setCustomEmployerName(event.target.value);
                        }}
                        placeholder="Add employer"
                        className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={addCustomEmployer}
                        disabled={customEmployerName.trim().length < 2}
                        className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Add employer
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            {isLoading ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <div className={`${skeletonBlockClassName} h-3 w-48`} />
                <div className="flex items-center gap-2">
                  <div className={`${skeletonBlockClassName} h-9 w-16`} />
                  <div className={`${skeletonBlockClassName} h-9 w-28`} />
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-medium text-[#4a665d] dark:text-slate-300">
                  {selectedRoles.length} role{selectedRoles.length === 1 ? "" : "s"} and {selectedEmployers.length} employer
                  {selectedEmployers.length === 1 ? "" : "s"} selected
                </p>
                <p className="text-xs font-medium text-[#4a665d] dark:text-slate-300">
                  {isSaving ? "Saving changes..." : "Changes auto-save as you select roles and employers."}
                </p>
              </div>
            )}

          </>
        ) : null}

        {showProfileSections ? (
          <div className="mt-4 rounded-2xl border border-[#d2dfd9] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">Account actions</p>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-[#cddbd5] bg-[#f5fbf8] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#2a4d41] transition-colors hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        ) : null}

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
