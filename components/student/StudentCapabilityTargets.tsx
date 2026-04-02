"use client";

import { useEffect, useMemo, useState } from "react";

type RoleOption = {
  role_id: string;
  role_label: string;
};

type CompanyOption = {
  company_id: string;
  company_label: string;
};

type CapabilityProfileOption = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  capability_ids: string[];
};

type ActiveCapabilityProfile = {
  capability_profile_id: string;
  company_id: string;
  company_label: string;
  role_id: string;
  role_label: string;
  selected_at: string;
  selection_source: "manual" | "agent_recommended" | "agent_confirmed" | "migrated_legacy";
  status: "active";
};

type CapabilityProfilesPayload = {
  roles: RoleOption[];
  companies: CompanyOption[];
  capability_profiles: CapabilityProfileOption[];
  active_capability_profiles: ActiveCapabilityProfile[];
  employer_visibility_opt_in: boolean;
  fit_by_capability_profile_id: Record<string, unknown>;
};

type SelectionSavePayload = {
  active_capability_profiles: ActiveCapabilityProfile[];
};

type RequestCapabilityProfilePayload = {
  status: "sent" | "duplicate_recent_request";
  request_key: string;
  requested_at: string | null;
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

export function StudentCapabilityTargets() {
  const [payload, setPayload] = useState<CapabilityProfilesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [requestStatusMessage, setRequestStatusMessage] = useState<string | null>(null);
  const [requestRoleLabel, setRequestRoleLabel] = useState("");
  const [requestCompanyLabel, setRequestCompanyLabel] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const loadCapabilityProfiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/student/capability-profiles", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; data: CapabilityProfilesPayload }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !body || !body.ok) throw new Error("capability_profiles_load_failed");
      setPayload(body.data);
    } catch {
      setError("Unable to load role targets.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCapabilityProfiles();
  }, []);

  const capabilityProfiles = useMemo(() => payload?.capability_profiles ?? [], [payload?.capability_profiles]);
  const activeSelections = useMemo(
    () => payload?.active_capability_profiles ?? [],
    [payload?.active_capability_profiles]
  );
  const activeSelectionIds = useMemo(
    () => new Set(activeSelections.map((selection) => selection.capability_profile_id)),
    [activeSelections]
  );

  const availableRoleFilters = useMemo(() => {
    const deduped = new Map<string, RoleOption>();
    for (const profile of capabilityProfiles) {
      const key = normalize(profile.role_label);
      if (!deduped.has(key)) {
        deduped.set(key, {
          role_id: profile.role_id,
          role_label: profile.role_label,
        });
      }
    }
    return Array.from(deduped.values()).sort((a, b) => a.role_label.localeCompare(b.role_label));
  }, [capabilityProfiles]);

  const availableCompanyFilters = useMemo(() => {
    const deduped = new Map<string, CompanyOption>();
    for (const profile of capabilityProfiles) {
      if (!deduped.has(profile.company_id)) {
        deduped.set(profile.company_id, {
          company_id: profile.company_id,
          company_label: profile.company_label,
        });
      }
    }
    return Array.from(deduped.values()).sort((a, b) => a.company_label.localeCompare(b.company_label));
  }, [capabilityProfiles]);

  const filteredRoleOptions = useMemo(() => {
    if (!companyFilter) return availableRoleFilters;
    const allowedRoleKeys = new Set(
      capabilityProfiles
        .filter((profile) => profile.company_id === companyFilter)
        .map((profile) => normalize(profile.role_label))
    );
    return availableRoleFilters.filter((role) => allowedRoleKeys.has(normalize(role.role_label)));
  }, [availableRoleFilters, capabilityProfiles, companyFilter]);

  const filteredCompanyOptions = useMemo(() => {
    if (!roleFilter) return availableCompanyFilters;
    const normalizedSelectedRole = normalize(roleFilter);
    const allowedCompanyIds = new Set(
      capabilityProfiles
        .filter((profile) => normalize(profile.role_label) === normalizedSelectedRole)
        .map((profile) => profile.company_id)
    );
    return availableCompanyFilters.filter((company) => allowedCompanyIds.has(company.company_id));
  }, [availableCompanyFilters, capabilityProfiles, roleFilter]);

  useEffect(() => {
    if (!roleFilter) return;
    const stillAvailable = filteredRoleOptions.some((role) => role.role_label === roleFilter);
    if (!stillAvailable) setRoleFilter("");
  }, [filteredRoleOptions, roleFilter]);

  useEffect(() => {
    if (!companyFilter) return;
    const stillAvailable = filteredCompanyOptions.some((company) => company.company_id === companyFilter);
    if (!stillAvailable) setCompanyFilter("");
  }, [companyFilter, filteredCompanyOptions]);

  const filteredProfiles = useMemo(() => {
    const normalizedRoleFilter = roleFilter ? normalize(roleFilter) : "";
    return capabilityProfiles
      .filter((profile) => {
        if (companyFilter && profile.company_id !== companyFilter) return false;
        if (normalizedRoleFilter && normalize(profile.role_label) !== normalizedRoleFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const roleCompare = a.role_label.localeCompare(b.role_label);
        if (roleCompare !== 0) return roleCompare;
        return a.company_label.localeCompare(b.company_label);
      });
  }, [capabilityProfiles, companyFilter, roleFilter]);

  const saveSelections = async (nextIds: string[]) => {
    if (nextIds.length > 2) {
      setStatusMessage("You can select up to 2 role targets.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/student/capability-profiles/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability_profile_ids: nextIds }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; data: SelectionSavePayload }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !body || !body.ok) throw new Error("selection_save_failed");
      setStatusMessage("Selections saved.");
      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          active_capability_profiles: body.data.active_capability_profiles ?? [],
        };
      });
    } catch {
      setStatusMessage("Unable to save selections.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (capabilityProfileId: string) => {
    if (activeSelectionIds.has(capabilityProfileId)) {
      const next = activeSelections
        .filter((selection) => selection.capability_profile_id !== capabilityProfileId)
        .map((selection) => selection.capability_profile_id);
      void saveSelections(next);
      return;
    }

    if (activeSelections.length >= 2) {
      setStatusMessage("You can only keep 2 selected role targets at a time.");
      return;
    }

    const next = [...activeSelections.map((selection) => selection.capability_profile_id), capabilityProfileId];
    void saveSelections(next);
  };

  const submitNewTargetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roleLabel = requestRoleLabel.trim();
    const companyLabel = requestCompanyLabel.trim();

    if (!roleLabel || !companyLabel) {
      setRequestStatusMessage("Enter both role and employer.");
      return;
    }

    setIsSubmittingRequest(true);
    setRequestStatusMessage(null);

    try {
      const response = await fetch("/api/student/capability-profiles/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role_label: roleLabel,
          company_label: companyLabel,
          source_mode: "role_first",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; data: RequestCapabilityProfilePayload }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !body || !body.ok) {
        setRequestStatusMessage("Unable to submit request right now.");
        return;
      }

      if (body.data.status === "duplicate_recent_request") {
        setRequestStatusMessage("You already requested this role and employer recently.");
        return;
      }

      setRequestRoleLabel("");
      setRequestCompanyLabel("");
      setRequestStatusMessage("Request submitted. We'll review it and follow up.");
      setIsRequestDialogOpen(false);
    } catch {
      setRequestStatusMessage("Unable to submit request right now.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 text-[#0a1f1a] lg:px-8 lg:py-10 dark:text-slate-100">
      <section className="mx-auto max-w-6xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">My Roles & Employers</h1>
          <p className="mt-2 text-sm text-[#48635b] dark:text-slate-300">
            Select up to 2 role targets. Filter by role or company to find the best fit.
          </p>
        </header>

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#557168] dark:text-slate-400">
              Missing a role + employer option?
            </p>
            <button
              type="button"
              onClick={() => {
                setRequestStatusMessage(null);
                setIsRequestDialogOpen(true);
              }}
              className="rounded-md bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a]"
            >
              Request new target
            </button>
          </div>
          {!isRequestDialogOpen && requestStatusMessage ? (
            <p className="mt-3 rounded-md border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-sm text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {requestStatusMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">
              Selected ({activeSelections.length}/2)
            </p>
            <p className="text-xs text-[#557168] dark:text-slate-400">Selections stay visible while filtering</p>
          </div>
          {activeSelections.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {activeSelections.map((selection, index) => (
                <span
                  key={selection.capability_profile_id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#bfd2ca] bg-[#f4faf7] px-3 py-1 text-xs text-[#21453a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>
                    {index === 0 ? "Primary" : "Secondary"}: {selection.role_label} @ {selection.company_label}
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggleSelection(selection.capability_profile_id)}
                    className="rounded-full border border-[#9dbeb0] px-1.5 py-0 text-[10px] font-semibold text-[#245244] hover:bg-[#e6f3ed] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                    aria-label={`Remove ${selection.role_label} at ${selection.company_label}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#557168] dark:text-slate-400">No role targets selected yet.</p>
          )}
        </section>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              Filter by Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">All roles</option>
                {filteredRoleOptions.map((role) => (
                  <option key={role.role_id} value={role.role_label}>
                    {role.role_label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              Filter by Company
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">All companies</option>
                {filteredCompanyOptions.map((company) => (
                  <option key={company.company_id} value={company.company_id}>
                    {company.company_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">
              Selected {activeSelections.length}/2
            </p>
            <p className="text-xs text-[#557168] dark:text-slate-400">Showing {filteredProfiles.length} options</p>
          </div>
          {isLoading ? (
            <p className="text-sm text-[#557168] dark:text-slate-400">Loading role targets...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-sm text-[#557168] dark:text-slate-400">No role targets match the current filters.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredProfiles.map((profile) => {
                const isSelected = activeSelectionIds.has(profile.capability_profile_id);
                const showLimitState = activeSelections.length >= 2 && !isSelected;
                return (
                  <button
                    type="button"
                    key={profile.capability_profile_id}
                    disabled={isSaving}
                    onClick={() => toggleSelection(profile.capability_profile_id)}
                    aria-pressed={isSelected}
                    className={`rounded-lg border p-3 text-left transition-colors ${isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10"
                      : "border-[#d7e3dd] bg-[#f7fbf9] hover:border-[#9fc7b4] dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-500"
                      } ${showLimitState ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0a1f1a] dark:text-slate-100">{profile.role_label}</p>
                        <p className="mt-0.5 text-sm text-[#48635b] dark:text-slate-300">{profile.company_label}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${isSelected
                          ? "border-emerald-500 bg-emerald-100 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-400/20 dark:text-emerald-300"
                          : "border-[#bfd2ca] bg-white text-[#3f6055] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {statusMessage ? (
          <p className="rounded-md border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-sm text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {statusMessage}
          </p>
        ) : null}
      </section>

      {isRequestDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-target-title"
            className="w-full max-w-lg rounded-xl border border-[#d2dfd9] bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="request-target-title"
                className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300"
              >
                Request new role + employer target
              </h2>
              <button
                type="button"
                onClick={() => setIsRequestDialogOpen(false)}
                className="rounded-md border border-[#bfd2ca] px-2 py-1 text-xs font-semibold text-[#335b4d] dark:border-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-sm text-[#557168] dark:text-slate-400">
              Submit the missing target and we'll notify the team.
            </p>

            <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitNewTargetRequest}>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Role
                <input
                  type="text"
                  value={requestRoleLabel}
                  onChange={(event) => setRequestRoleLabel(event.target.value)}
                  placeholder="Software Engineer"
                  className="mt-2 h-11 w-full rounded-md border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
                Employer
                <input
                  type="text"
                  value={requestCompanyLabel}
                  onChange={(event) => setRequestCompanyLabel(event.target.value)}
                  placeholder="Adobe"
                  className="mt-2 h-11 w-full rounded-md border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  required
                />
              </label>
              <div className="flex items-center gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsRequestDialogOpen(false)}
                  className="rounded-md border border-[#bfd2ca] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#335b4d] dark:border-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="rounded-md bg-[#12f987] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingRequest ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>

            {isRequestDialogOpen && requestStatusMessage ? (
              <p className="mt-3 rounded-md border border-[#cde0d8] bg-[#f4faf7] px-3 py-2 text-sm text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {requestStatusMessage}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
