"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { findBestOptionMatch, normalizeOptionLabel, normalizeOptionSearchKey } from "@/lib/text/fuzzy-option-match";

const toggledClassName =
  "border-[#0fd978] bg-[#e8fff3] text-[#0b3f2d] dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100";
const untoggledClassName =
  "border-[#d1e0d9] bg-white text-[#1f4035] hover:bg-[#f2f8f5] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#e4efe9] dark:bg-slate-700/70";

type StudentProfileApiData = {
  profile: {
    personal_info?: Record<string, unknown>;
  };
  student_data?: Record<string, unknown>;
  role_options?: string[];
  company_options?: string[];
};

type ProfileLinkKey = "linkedin" | "handshake" | "github" | "otherRepo" | "portfolio";
type StudentManageRolesView = "all" | "profile" | "targets";

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
    otherRepo: "",
    portfolio: ""
  });
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfileDetails, setIsSavingProfileDetails] = useState(false);
  const [isSavingExternalSignals, setIsSavingExternalSignals] = useState(false);
  const [isVisibleToTargetEmployers, setIsVisibleToTargetEmployers] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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
        const savedLinks = toRecord(studentData.artifact_profile_links);
        const savedVideoLinks = toRecord(studentData.video_links);
        const availableRoles = mergeOptionList(toStringArray(payload.data.role_options ?? []), loadedRoles);
        const availableEmployers = mergeOptionList(toStringArray(payload.data.company_options ?? []), loadedEmployers);

        setFirstName(asTrimmedString(personalInfo.first_name));
        setLastName(asTrimmedString(personalInfo.last_name));
        setEmail(asTrimmedString(personalInfo.email));
        setAvatarUrl(asTrimmedString(personalInfo.avatar_url) || asTrimmedString(personalInfo.avatarUrl));
        setSelectedRoles(loadedRoles);
        setSelectedEmployers(loadedEmployers);
        setIsVisibleToTargetEmployers(loadedEmployerVisibility);
        setRoleOptions(availableRoles);
        setEmployerOptions(availableEmployers);
        setProfileLinks({
          linkedin: asTrimmedString(savedLinks.linkedin),
          handshake: asTrimmedString(savedLinks.handshake),
          github: asTrimmedString(savedLinks.github),
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

  const hasSelections = useMemo(() => selectedRoles.length > 0 && selectedEmployers.length > 0, [selectedEmployers.length, selectedRoles.length]);
  const hasNameFields = useMemo(() => firstName.trim().length > 1 && lastName.trim().length > 1, [firstName, lastName]);
  const canSaveTargets = !isLoading && !isSaving && hasSelections;
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

  const notifyStudentProfileUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("student-profile-updated"));
  };

  const toggleRole = (role: string) => {
    const normalized = normalizeOptionSearchKey(role);
    setSelectedRoles((current) =>
      current.some((value) => normalizeOptionSearchKey(value) === normalized)
        ? current.filter((value) => normalizeOptionSearchKey(value) !== normalized)
        : [...current, role]
    );
    setStatusMessage(null);
  };

  const toggleEmployer = (employer: string) => {
    const normalized = normalizeOptionSearchKey(employer);
    setSelectedEmployers((current) =>
      current.some((value) => normalizeOptionSearchKey(value) === normalized)
        ? current.filter((value) => normalizeOptionSearchKey(value) !== normalized)
        : [...current, employer]
    );
    setStatusMessage(null);
  };

  const addCustomRole = () => {
    const normalized = normalizeOptionLabel(customRoleName);
    const normalizedKey = normalizeOptionSearchKey(normalized);
    if (normalizedKey.length < 2) {
      setStatusMessage("Enter a valid role name before adding.");
      return;
    }

    const matched = findBestOptionMatch(normalized, roleOptions);
    const resolvedRole = matched?.option ?? normalized;
    const resolvedKey = normalizeOptionSearchKey(resolvedRole);

    setRoleOptions((current) => {
      if (current.some((value) => normalizeOptionSearchKey(value) === resolvedKey)) return current;
      return mergeOptionList(current, [resolvedRole]);
    });
    setSelectedRoles((current) =>
      current.some((value) => normalizeOptionSearchKey(value) === resolvedKey) ? current : [...current, resolvedRole]
    );
    setCustomRoleName("");
    if (matched) {
      setStatusMessage(`Matched your input to existing role: ${resolvedRole}.`);
      return;
    }
    setStatusMessage(`Added ${resolvedRole} to your role targets.`);
  };

  const addCustomEmployer = () => {
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
    setSelectedEmployers((current) =>
      current.some((value) => normalizeOptionSearchKey(value) === resolvedKey) ? current : [...current, resolvedEmployer]
    );
    setCustomEmployerName("");
    if (matched) {
      setStatusMessage(`Matched your input to existing employer: ${resolvedEmployer}.`);
      return;
    }
    setStatusMessage(`Added ${resolvedEmployer} to your employer targets.`);
  };

  const clearSelections = () => {
    setSelectedRoles([]);
    setSelectedEmployers([]);
    setIsVisibleToTargetEmployers(false);
    setStatusMessage(null);
  };

  const handleProfileLinkChange = (key: ProfileLinkKey, value: string) => {
    setProfileLinks((current) => ({
      ...current,
      [key]: value
    }));
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
              other_repo: profileLinks.otherRepo.trim(),
              portfolio_url: profileLinks.portfolio.trim()
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
      setStatusMessage(`Saved ${sourceCount} external signal source${sourceCount === 1 ? "" : "s"}.`);
    } catch {
      setStatusMessage("Unable to save profile/video links right now.");
    } finally {
      setIsSavingExternalSignals(false);
    }
  };

  const saveSelections = async ({ visibilityOverride }: { visibilityOverride?: boolean } = {}) => {
    if (!hasSelections) {
      setStatusMessage("Choose at least one role and one employer before saving.");
      return;
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
            target_roles: selectedRoles,
            target_companies: selectedEmployers,
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
        savedVisibility
          ? `You are now visible to ${savedEmployers.length} selected employer${savedEmployers.length === 1 ? "" : "s"}.`
          : "Targets saved. You are currently private to selected employers."
      );
      notifyStudentProfileUpdated();
    } catch {
      setStatusMessage("We couldn't save your profile right now. Please try again.");
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
        {Array.from({ length: 5 }).map((_, index) => (
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
    <section aria-labelledby="student-manage-roles-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">
            {showTargetSections && !showProfileSections ? "Student Coaching Targets" : "Student Profile"}
          </p>
          <h2 id="student-manage-roles-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            {showProfileSections && showTargetSections
              ? "Manage profile and focus targets"
              : showProfileSections
                ? "Manage profile"
                : "My Positions and My Employers"}
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
                          onChange={(event) => setFirstName(event.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#bfd2ca] bg-white px-3 text-sm text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                        Last name
                        <input
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
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
                      {isSavingProfileDetails ? "Saving..." : "Save profile details"}
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
                        onChange={(event) => setIntroVideoUrl(event.target.value)}
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
                      {isSavingExternalSignals ? "Saving links..." : "Save profile and video links"}
                    </button>
                  </div>
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
                        onChange={(event) => setCustomRoleName(event.target.value)}
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
                        if (!isVisibleToTargetEmployers && !canEnableEmployerVisibility) {
                          setStatusMessage("Complete the visibility checklist before enabling recruiter visibility.");
                          return;
                        }
                        setIsVisibleToTargetEmployers((current) => !current);
                        setStatusMessage(null);
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
                        onChange={(event) => setCustomEmployerName(event.target.value)}
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelections}
                    className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSelections()}
                    disabled={!canSaveTargets}
                    className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save targets"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Coaching tools</h3>
                <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-200">
                  Coming Soon
                </span>
              </div>
              <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
                Use these views to work directly against your selected positions and employers.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/student/capability-coach"
                  className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Open Capability Coach
                </Link>
                <Link
                  href="/student/pathway"
                  className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Open Pathway Planner
                </Link>
                <Link
                  href="/student/interview-prep"
                  className="rounded-xl border border-[#bfd2ca] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#21453a] transition-colors hover:bg-[#eef5f2] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Open Interview Prep
                </Link>
              </div>
            </div>
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
