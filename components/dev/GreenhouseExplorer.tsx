"use client";

import { useState } from "react";
import { EndpointSidebar } from "./EndpointSidebar";
import { ParamForm } from "./ParamForm";
import { ResponseViewer } from "./ResponseViewer";

export type ParamDef = {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
};

export type EndpointDef = {
  id: string;
  group: string;
  label: string;
  method: "GET";
  params: ParamDef[];
  buildUrl: (values: Record<string, string>) => string;
};

const ENDPOINTS: EndpointDef[] = [
  {
    id: "list-jobs",
    group: "Jobs",
    label: "List Jobs",
    method: "GET",
    params: [{ name: "page", label: "Page", defaultValue: "1" }],
    buildUrl: ({ page }) => `/api/recruiter/ats/greenhouse/jobs?page=${page ?? 1}`,
  },
  {
    id: "get-job",
    group: "Jobs",
    label: "Get Job",
    method: "GET",
    params: [{ name: "id", label: "Job ID", required: true, defaultValue: "1" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/jobs/${id}`,
  },
  {
    id: "job-stages",
    group: "Jobs",
    label: "Get Job Stages",
    method: "GET",
    params: [{ name: "id", label: "Job ID", required: true, defaultValue: "1" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/jobs/${id}/stages`,
  },
  {
    id: "list-candidates",
    group: "Candidates",
    label: "List Candidates",
    method: "GET",
    params: [{ name: "page", label: "Page", defaultValue: "1" }],
    buildUrl: ({ page }) => `/api/recruiter/ats/greenhouse/candidates?page=${page ?? 1}`,
  },
  {
    id: "get-candidate",
    group: "Candidates",
    label: "Get Candidate",
    method: "GET",
    params: [{ name: "id", label: "Candidate ID", required: true, defaultValue: "1" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/candidates/${id}`,
  },
  {
    id: "get-application",
    group: "Applications",
    label: "Get Application",
    method: "GET",
    params: [{ name: "id", label: "Application ID", required: true, defaultValue: "1" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/applications/${id}`,
  },
  {
    id: "get-scorecards",
    group: "Applications",
    label: "Get Scorecards",
    method: "GET",
    params: [{ name: "id", label: "Application ID", required: true, defaultValue: "1" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/applications/${id}/scorecards`,
  },
  {
    id: "get-offer",
    group: "Applications",
    label: "Get Current Offer",
    method: "GET",
    params: [{ name: "id", label: "Application ID", required: true, defaultValue: "10" }],
    buildUrl: ({ id }) => `/api/recruiter/ats/greenhouse/applications/${id}/offers/current`,
  },
  {
    id: "pipeline",
    group: "Applications",
    label: "Pipeline",
    method: "GET",
    params: [
      { name: "job_id", label: "Job ID (optional)" },
      { name: "page", label: "Page", defaultValue: "1" },
    ],
    buildUrl: ({ job_id, page }) => {
      const p = new URLSearchParams({ page: page ?? "1" });
      if (job_id) p.set("job_id", job_id);
      return `/api/recruiter/ats/greenhouse/pipeline?${p}`;
    },
  },
  {
    id: "list-departments",
    group: "Misc",
    label: "List Departments",
    method: "GET",
    params: [],
    buildUrl: () => `/api/recruiter/ats/greenhouse/departments`,
  },
];

type FetchState = {
  status: number | null;
  durationMs: number | null;
  data: unknown;
  error: string | null;
};

export function GreenhouseExplorer() {
  const [selectedId, setSelectedId] = useState<string>(ENDPOINTS[0].id);
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[0];

  async function handleRun(values: Record<string, string>) {
    const url = selected.buildUrl(values);
    setLoading(true);
    setFetchState(null);
    const start = performance.now();
    try {
      const res = await fetch(url);
      const durationMs = Math.round(performance.now() - start);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      setFetchState({ status: res.status, durationMs, data, error: null });
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      setFetchState({
        status: null,
        durationMs,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <span className="text-sm font-semibold text-green-400">Greenhouse API Explorer</span>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">dev only</span>
      </div>

      {/* Setup note */}
      <div className="px-4 py-2 bg-yellow-950 border-b border-yellow-800 text-xs text-yellow-300">
        Requires dev identity:{" "}
        <a href="/api/auth/dev-login?persona=recruiter" className="underline hover:text-yellow-100">
          /api/auth/dev-login?persona=recruiter
        </a>
        {" · "}Uses SQLite seed data when no Greenhouse API key is configured.
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <EndpointSidebar
          endpoints={ENDPOINTS}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          <ParamForm
            endpoint={selected}
            onRun={handleRun}
            loading={loading}
          />
          {fetchState && (
            <ResponseViewer
              status={fetchState.status}
              durationMs={fetchState.durationMs}
              data={fetchState.data}
              error={fetchState.error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
