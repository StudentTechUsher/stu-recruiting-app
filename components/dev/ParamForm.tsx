"use client";

import { useState, useEffect } from "react";
import type { EndpointDef } from "./GreenhouseExplorer";

type Props = {
  endpoint: EndpointDef;
  onRun: (values: Record<string, string>) => void;
  loading: boolean;
};

export function ParamForm({ endpoint, onRun, loading }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Reset form values when endpoint changes, applying defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const p of endpoint.params) {
      defaults[p.name] = p.defaultValue ?? "";
    }
    setValues(defaults);
  }, [endpoint.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onRun(values);
  }

  const url = endpoint.buildUrl(values);

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 rounded border border-gray-800 p-4">
      <div className="mb-3">
        <span className="text-xs font-semibold text-green-400 mr-2">{endpoint.method}</span>
        <span className="text-xs text-gray-400 break-all">{url}</span>
      </div>

      {endpoint.params.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parameters</div>
          {endpoint.params.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-28 shrink-0">
                {p.label}
                {p.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type="text"
                value={values[p.name] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-green-600"
                placeholder={p.defaultValue ?? ""}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded transition-colors"
      >
        {loading ? "Running..." : "Run"}
      </button>
    </form>
  );
}
