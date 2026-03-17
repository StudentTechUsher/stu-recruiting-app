"use client";

import type { EndpointDef } from "./GreenhouseExplorer";

type Props = {
  endpoints: EndpointDef[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function EndpointSidebar({ endpoints, selectedId, onSelect }: Props) {
  const groups = Array.from(new Set(endpoints.map((e) => e.group)));

  return (
    <nav className="w-48 shrink-0 border-r border-gray-800 overflow-y-auto bg-gray-900">
      {groups.map((group) => (
        <div key={group} className="mb-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {group}
          </div>
          {endpoints
            .filter((e) => e.group === group)
            .map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className={`w-full text-left px-4 py-1.5 text-xs truncate transition-colors ${
                  e.id === selectedId
                    ? "bg-green-900 text-green-300"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {e.label}
              </button>
            ))}
        </div>
      ))}
    </nav>
  );
}
