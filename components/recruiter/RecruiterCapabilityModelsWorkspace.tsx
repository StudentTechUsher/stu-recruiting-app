"use client";

import { useEffect, useMemo, useState } from "react";
import type { CapabilityModelVersion, RecruiterCapabilityModel } from "@/lib/recruiter/types";

const defaultWeights = {
  problem_solving: 30,
  data_communication: 25,
  execution_reliability: 20,
  collaboration: 15,
  business_judgment: 10,
};

const defaultThresholds = {
  emerging_max: 54,
  developing_max: 69,
  ready_max: 84,
};

const defaultEvidence = ["Course performance artifacts", "Applied project outcomes"];

const skeletonBlockClassName = "animate-pulse rounded-lg bg-[#dbe8e2] dark:bg-slate-700/70";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        active
          ? "bg-[#dcf3e8] text-[#1a6641] dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-[#e9eff0] text-[#4c6860] dark:bg-slate-700 dark:text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#22a05a]" : "bg-[#8da8a0]"}`}
        aria-hidden="true"
      />
      {active ? "Live" : "Draft"}
    </span>
  );
}

function VersionStatusBadge({ status }: { status: CapabilityModelVersion["status"] }) {
  const map = {
    published: "bg-[#dcf3e8] text-[#1a6641] dark:bg-emerald-900/40 dark:text-emerald-300",
    draft: "bg-[#e9eff0] text-[#4c6860] dark:bg-slate-700 dark:text-slate-400",
    archived: "bg-[#f0ece9] text-[#7a5a48] dark:bg-slate-800 dark:text-slate-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function RecruiterCapabilityModelsWorkspace() {
  const [models, setModels] = useState<RecruiterCapabilityModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelVersions, setSelectedModelVersions] = useState<CapabilityModelVersion[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelDescription, setNewModelDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "info" | "error" } | null>(null);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/recruiter/capability-models", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { models: RecruiterCapabilityModel[] } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("capability_models_load_failed");
      }

      setModels(payload.data.models ?? []);
    } catch {
      setStatusMessage({ text: "Unable to load capability models right now.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadVersions = async () => {
      if (!selectedModelId) {
        setSelectedModelVersions([]);
        return;
      }

      try {
        const response = await fetch(`/api/recruiter/capability-models/${selectedModelId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { model: RecruiterCapabilityModel; versions: CapabilityModelVersion[] } }
          | { ok: false; error?: string }
          | null;

        if (!isActive) return;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error("capability_model_versions_load_failed");
        }

        setSelectedModelVersions(payload.data.versions ?? []);
      } catch {
        if (!isActive) return;
        setSelectedModelVersions([]);
      }
    };

    void loadVersions();

    return () => {
      isActive = false;
    };
  }, [selectedModelId]);

  const selectedModel = useMemo(
    () => models.find((model) => model.capability_model_id === selectedModelId) ?? null,
    [models, selectedModelId]
  );

  const createModel = async () => {
    if (newModelName.trim().length < 2) {
      setStatusMessage({ text: "Model name must be at least 2 characters.", type: "error" });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/recruiter/capability-models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model_name: newModelName.trim(),
          description: newModelDescription.trim() || undefined,
          weights: defaultWeights,
          thresholds: defaultThresholds,
          required_evidence: defaultEvidence,
          notes: null,
          publish: false,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { model: RecruiterCapabilityModel } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("capability_model_create_failed");
      }

      setStatusMessage({ text: `Model "${payload.data.model.model_name}" created.`, type: "info" });
      setNewModelName("");
      setNewModelDescription("");
      setShowCreateForm(false);
      await loadModels();
      setSelectedModelId(payload.data.model.capability_model_id);
    } catch {
      setStatusMessage({ text: "Unable to create capability model.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const createVersion = async () => {
    if (!selectedModelId) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/recruiter/capability-models/${selectedModelId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weights: defaultWeights,
          thresholds: defaultThresholds,
          required_evidence: defaultEvidence,
          notes: null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { version: CapabilityModelVersion } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("capability_model_version_create_failed");
      }

      setStatusMessage({ text: `Version ${payload.data.version.version_number} created as draft.`, type: "info" });
      setSelectedModelVersions((current) => [payload.data.version, ...current]);
    } catch {
      setStatusMessage({ text: "Unable to create new version.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const publishVersion = async (version: CapabilityModelVersion) => {
    if (!selectedModelId) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/recruiter/capability-models/${selectedModelId}/versions/${version.capability_model_version_id}/publish`,
        { method: "POST" }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { version: CapabilityModelVersion } }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error("capability_model_publish_failed");
      }

      setStatusMessage({ text: `Version ${payload.data.version.version_number} is now live.`, type: "info" });
      setSelectedModelVersions((current) =>
        current.map((item) => {
          if (item.capability_model_version_id === payload.data.version.capability_model_version_id) {
            return payload.data.version;
          }
          if (item.status === "published") {
            return { ...item, status: "archived" as const };
          }
          return item;
        })
      );
      await loadModels();
    } catch {
      setStatusMessage({ text: "Unable to publish selected version.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="w-full px-6 py-8 lg:px-8">
      <div className="rounded-[28px] border border-[#cfddd6] bg-[#f8fcfa] p-6 shadow-[0_22px_52px_-34px_rgba(10,31,26,0.45)] dark:border-slate-700 dark:bg-slate-900/75">

        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4d675f] dark:text-slate-400">
              Capability Models
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a1f1a] dark:text-slate-100">
              My Capability Models
            </h2>
            {!isLoading && (
              <p className="mt-0.5 text-sm text-[#567168] dark:text-slate-400">
                {models.length === 0
                  ? "No models yet — create one to start scoring candidates."
                  : `${models.length} model${models.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v);
              setStatusMessage(null);
            }}
            className="rounded-xl border border-[#b8cdc3] bg-white px-4 py-2 text-sm font-semibold text-[#1a3d31] transition-colors hover:bg-[#eef7f2] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {showCreateForm ? "Cancel" : "+ New Model"}
          </button>
        </header>

        {/* Create form (inline, toggleable) */}
        {showCreateForm && (
          <div className="mb-5 rounded-2xl border border-[#c8ddd5] bg-white p-4 dark:border-slate-600 dark:bg-slate-800/60">
            <h3 className="mb-3 text-sm font-semibold text-[#173e33] dark:text-slate-200">New capability model</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Model name
                <input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g. Early-Career Data Analyst"
                  className="mt-1 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm font-normal text-[#0a1f1a] placeholder:text-[#a0b8b0] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4c6860] dark:text-slate-400">
                Description
                <input
                  value={newModelDescription}
                  onChange={(e) => setNewModelDescription(e.target.value)}
                  placeholder="Optional short description"
                  className="mt-1 w-full rounded-lg border border-[#bfd2ca] bg-white px-3 py-2 text-sm font-normal text-[#0a1f1a] placeholder:text-[#a0b8b0] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={createModel}
                disabled={isSaving}
                className="rounded-lg bg-[#1a3d31] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-emerald-800 dark:text-white"
              >
                {isSaving ? "Creating…" : "Create model"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#4c6860] hover:text-[#173e33] dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Model list */}
        {isLoading ? (
          <div aria-hidden="true" className="space-y-3">
            <div className={`${skeletonBlockClassName} h-[72px] w-full`} />
            <div className={`${skeletonBlockClassName} h-[72px] w-full`} />
            <div className={`${skeletonBlockClassName} h-[72px] w-full`} />
          </div>
        ) : models.length === 0 && !showCreateForm ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c8ddd5] py-14 text-center dark:border-slate-700">
            <p className="text-base font-semibold text-[#173e33] dark:text-slate-300">No capability models yet</p>
            <p className="mt-1 text-sm text-[#567168] dark:text-slate-500">
              Create a model to define how you evaluate candidates.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="mt-4 rounded-xl border border-[#b8cdc3] bg-white px-4 py-2 text-sm font-semibold text-[#1a3d31] hover:bg-[#eef7f2] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              + New Model
            </button>
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {models.map((model) => {
              const isSelected = selectedModelId === model.capability_model_id;
              return (
                <li key={model.capability_model_id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedModelId(isSelected ? null : model.capability_model_id)
                    }
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      isSelected
                        ? "border-[#3f6d5d] bg-[#eef7f2] dark:border-emerald-700 dark:bg-slate-800"
                        : "border-[#d7e4dd] bg-white hover:border-[#a8c4b8] hover:bg-[#f4faf7] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <StatusBadge active={Boolean(model.active_version_id)} />
                        <span className="text-sm font-semibold text-[#173e33] dark:text-slate-200">
                          {model.model_name}
                        </span>
                      </div>
                      <span className="text-xs text-[#7a9d8e] dark:text-slate-500">
                        Updated {formatDate(model.updated_at)}
                      </span>
                    </div>
                    {model.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#567168] dark:text-slate-400">
                        {model.description}
                      </p>
                    )}
                  </button>

                  {/* Versions panel — inline under selected model */}
                  {isSelected && (
                    <div className="mx-1 rounded-b-2xl border border-t-0 border-[#3f6d5d] bg-[#f4faf7] px-4 py-3 dark:border-emerald-700 dark:bg-slate-800/60">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#456158] dark:text-slate-400">
                          Versions
                        </p>
                        <button
                          type="button"
                          onClick={createVersion}
                          disabled={isSaving}
                          className="rounded-lg border border-[#b8cdc3] bg-white px-3 py-1 text-xs font-semibold text-[#244a3d] disabled:opacity-60 hover:bg-[#eef7f2] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        >
                          + Add version
                        </button>
                      </div>

                      {selectedModelVersions.length === 0 ? (
                        <p className="text-xs text-[#567168] dark:text-slate-500">No versions yet.</p>
                      ) : (
                        <ul className="space-y-1.5" role="list">
                          {selectedModelVersions.map((version) => (
                            <li
                              key={version.capability_model_version_id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d7e4dd] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                            >
                              <div className="flex items-center gap-2">
                                <VersionStatusBadge status={version.status} />
                                <span className="text-xs font-semibold text-[#173e33] dark:text-slate-200">
                                  v{version.version_number}
                                </span>
                                <span className="text-xs text-[#7a9d8e] dark:text-slate-500">
                                  {formatDate(version.created_at)}
                                </span>
                              </div>
                              {version.status !== "published" && (
                                <button
                                  type="button"
                                  onClick={() => publishVersion(version)}
                                  disabled={isSaving}
                                  className="rounded-md border border-[#b8cdc3] bg-white px-2 py-0.5 text-xs font-semibold text-[#244a3d] disabled:opacity-60 hover:bg-[#eef7f2] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  Publish
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Status message */}
        {statusMessage ? (
          <p
            className={`mt-4 rounded-xl border px-3 py-2 text-xs font-medium ${
              statusMessage.type === "error"
                ? "border-[#e8cdc8] bg-[#fdf5f4] text-[#8b3a2e] dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                : "border-[#cde0d8] bg-[#f4faf7] text-[#44645b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {statusMessage.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
