"use client";

type Props = {
  status: number | null;
  durationMs: number | null;
  data: unknown;
  error: string | null;
};

export function ResponseViewer({ status, durationMs, data, error }: Props) {
  const statusColor =
    status === null ? "text-gray-400" :
    status >= 200 && status < 300 ? "text-green-400" :
    status >= 400 ? "text-red-400" : "text-yellow-400";

  return (
    <div className="flex-1 flex flex-col bg-gray-900 rounded border border-gray-800 overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-500">Response</span>
        {status !== null && (
          <span className={`text-xs font-semibold ${statusColor}`}>{status}</span>
        )}
        {durationMs !== null && (
          <span className="text-xs text-gray-500">{durationMs}ms</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <pre className="text-xs text-red-400 whitespace-pre-wrap break-words">{error}</pre>
        ) : (
          <pre className="text-xs text-gray-200 whitespace-pre-wrap break-words">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
