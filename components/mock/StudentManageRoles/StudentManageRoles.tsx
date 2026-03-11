"use client";

import { useEffect, useMemo, useState } from "react";
import { findBestOptionMatch, normalizeOptionLabel, normalizeOptionSearchKey } from "@/lib/text/fuzzy-option-match";

const toggledClassName =
  "border-[#0fd978] bg-[#e8fff3] text-[#0b3f2d] dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100";
const untoggledClassName =
  "border-[#d1e0d9] bg-white text-[#1f4035] hover:bg-[#f2f8f5] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

type StudentProfileApiData = {
  profile: {
    personal_info?: Record<string, unknown>;
  };
  student_data?: Record<string, unknown>;
  role_options?: string[];
  company_options?: string[];
};

type ProfileLinkKey = "linkedin" | "handshake" | "github" | "otherRepo" | "portfolio";

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
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

export function StudentManageRoles() {
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
  const [isSavingExternalSignals, setIsSavingExternalSignals] = useState(false);

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
        const savedLinks = toRecord(studentData.artifact_profile_links);
        const savedVideoLinks = toRecord(studentData.video_links);
        const availableRoles = mergeOptionList(toStringArray(payload.data.role_options ?? []), loadedRoles);
        const availableEmployers = mergeOptionList(toStringArray(payload.data.company_options ?? []), loadedEmployers);

        setFirstName(asTrimmedString(personalInfo.first_name));
        setLastName(asTrimmedString(personalInfo.last_name));
        setEmail(asTrimmedString(personalInfo.email));
        setSelectedRoles(loadedRoles);
        setSelectedEmployers(loadedEmployers);
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
  const canSave = !isLoading && !isSaving && hasNameFields && hasSelections;

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
    setStatusMessage(null);
  };

  const handleProfileLinkChange = (key: ProfileLinkKey, value: string) => {
    setProfileLinks((current) => ({
      ...current,
      [key]: value
    }));
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

  const saveSelections = async () => {
    if (!hasNameFields) {
      setStatusMessage("Add first and last name before saving.");
      return;
    }

    if (!hasSelections) {
      setStatusMessage("Choose at least one role and one employer before saving.");
      return;
    }

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
            target_companies: selectedEmployers
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
      setSelectedRoles(savedRoles);
      setSelectedEmployers(savedEmployers);
      setRoleOptions((current) => mergeOptionList(current, savedRoles));
      setEmployerOptions((current) => mergeOptionList(current, savedEmployers));
      setStatusMessage("Profile updated. Student focus is saved to your account record.");
    } catch {
      setStatusMessage("We couldn't save your profile right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="student-manage-roles-title" className="w-full px-6 py-12 lg:px-8">
      <div className="rounded-[32px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_24px_54px_-36px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6860] dark:text-slate-400">Student Profile</p>
          <h2 id="student-manage-roles-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100 md:text-4xl">
            Manage profile and focus targets
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#436059] dark:text-slate-300">
            Edit your profile details and update which positions and employers you want coaching to prioritize.
          </p>
        </header>

        <div className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Profile details</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

        <div className="mt-6 rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Profile links and intro video</h3>
          <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">
            Add profile links and an optional YouTube/Loom intro video so recruiters can review context quickly.
          </p>

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
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Target Positions</h3>
            <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">Your coaching and pathway plans prioritize these role tracks.</p>
            {isLoading ? (
              <p className="mt-4 text-sm text-[#4a665d] dark:text-slate-300">Loading role options...</p>
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">Target Employers</h3>
            <p className="mt-2 text-xs text-[#557168] dark:text-slate-400">Recruiter signal and role guidance are tuned to these employers.</p>
            {isLoading ? (
              <p className="mt-4 text-sm text-[#4a665d] dark:text-slate-300">Loading employer options...</p>
            ) : (
              <>
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
              onClick={saveSelections}
              disabled={!canSave}
              className="rounded-xl bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] shadow-[0_16px_30px_-18px_rgba(10,31,26,0.65)] transition-colors hover:bg-[#0ed978] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>

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

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-xs font-medium text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
