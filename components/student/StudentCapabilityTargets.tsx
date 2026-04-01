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
  debug?: {
    has_service_role_client: boolean;
    query_errors: {
      students: string | null;
      capability_models: string | null;
      companies: string | null;
      job_roles: string | null;
      artifacts: string | null;
    };
    row_counts: {
      capability_models: number;
      companies: number;
      job_roles: number;
      artifacts: number;
      capability_profiles: number;
    };
    dropped_model_counts: {
      missing_company_id: number;
    };
  };
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

export function StudentCapabilityTargets() {
  const [payload, setPayload] = useState<CapabilityProfilesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
      if (process.env.NODE_ENV !== "production") {
        console.log("[student-targets-simple] payload", {
          roles: body.data.roles.length,
          companies: body.data.companies.length,
          capability_profiles: body.data.capability_profiles.length,
          active: body.data.active_capability_profiles.length,
          debug: body.data.debug,
        });
      }
    } catch {
      setError("Unable to load capability models.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCapabilityProfiles();
  }, []);

  const capabilityProfiles = payload?.capability_profiles ?? [];
  const activeSelections = payload?.active_capability_profiles ?? [];
  const activeSelectionIds = useMemo(
    () => new Set(activeSelections.map((selection) => selection.capability_profile_id)),
    [activeSelections]
  );

  const availableRoleFilters = useMemo(() => {
    if ((payload?.roles ?? []).length > 0) return payload?.roles ?? [];
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
  }, [capabilityProfiles, payload?.roles]);

  const availableCompanyFilters = useMemo(() => {
    if ((payload?.companies ?? []).length > 0) return payload?.companies ?? [];
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
  }, [capabilityProfiles, payload?.companies]);

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
      setStatusMessage("You can select up to 2 models.");
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
        | { ok: true; data?: unknown }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !body || !body.ok) throw new Error("selection_save_failed");
      setStatusMessage("Selections saved.");
      await loadCapabilityProfiles();
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
      setStatusMessage("You can only keep 2 selected models at a time.");
      return;
    }

    const next = [...activeSelections.map((selection) => selection.capability_profile_id), capabilityProfileId];
    void saveSelections(next);
  };

  return (
    <main className="min-h-screen px-4 py-6 text-[#0a1f1a] lg:px-8 lg:py-10 dark:text-slate-100">
      <section className="mx-auto max-w-6xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Capability Models</h1>
          <p className="mt-2 text-sm text-[#48635b] dark:text-slate-300">
            Select up to 2 capability models. Filter by role name or company to find the best fit.
          </p>
        </header>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {process.env.NODE_ENV !== "production" && payload?.debug ? (
          <section className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold uppercase tracking-[0.08em]">Debug</p>
            <p className="mt-1">has_service_role_client: {String(payload.debug.has_service_role_client)}</p>
            <p className="mt-1">
              row_counts: models={payload.debug.row_counts.capability_models}, companies={payload.debug.row_counts.companies}, roles={payload.debug.row_counts.job_roles}, profiles={payload.debug.row_counts.capability_profiles}
            </p>
            <p className="mt-1">missing_company_id: {payload.debug.dropped_model_counts.missing_company_id}</p>
            {Object.entries(payload.debug.query_errors).map(([key, value]) => (
              <p key={key} className="mt-1">
                {key}: {value ?? "none"}
              </p>
            ))}
          </section>
        ) : null}

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6a62] dark:text-slate-400">
              Filter by Role Name
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#bfd2ca] bg-white px-3 text-sm normal-case text-[#0a1f1a] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">All roles</option>
                {availableRoleFilters.map((role) => (
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
                {availableCompanyFilters.map((company) => (
                  <option key={company.company_id} value={company.company_id}>
                    {company.company_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#3f6055] dark:text-slate-300">
              Selected Models ({activeSelections.length}/2)
            </h2>
            <p className="text-xs text-[#557168] dark:text-slate-400">Showing {filteredProfiles.length} models</p>
          </div>
          {activeSelections.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeSelections.map((selection, index) => (
                <span
                  key={selection.capability_profile_id}
                  className="rounded-full border border-[#bfd2ca] bg-[#f4faf7] px-3 py-1 text-xs text-[#21453a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {index === 0 ? "Primary" : "Secondary"}: {selection.role_label} @ {selection.company_label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#557168] dark:text-slate-400">No models selected yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-[#d2dfd9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          {isLoading ? (
            <p className="text-sm text-[#557168] dark:text-slate-400">Loading capability models...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-sm text-[#557168] dark:text-slate-400">No capability models match the current filters.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredProfiles.map((profile) => {
                const isSelected = activeSelectionIds.has(profile.capability_profile_id);
                const atLimit = activeSelections.length >= 2 && !isSelected;
                return (
                  <article
                    key={profile.capability_profile_id}
                    className="rounded-lg border border-[#d7e3dd] bg-[#f7fbf9] p-3 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <p className="text-sm font-semibold text-[#0a1f1a] dark:text-slate-100">{profile.role_label}</p>
                    <p className="mt-1 text-sm text-[#48635b] dark:text-slate-300">{profile.company_label}</p>
                    <p className="mt-1 text-xs text-[#557168] dark:text-slate-400">
                      Model ID: {profile.capability_profile_id}
                    </p>
                    <button
                      type="button"
                      disabled={isSaving || atLimit}
                      onClick={() => toggleSelection(profile.capability_profile_id)}
                      className="mt-3 rounded-md bg-[#12f987] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a1f1a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSelected ? "Remove" : atLimit ? "Limit reached" : "Select"}
                    </button>
                  </article>
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
    </main>
  );
}
