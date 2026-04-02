"use client";

import { useEffect, useState } from "react";

type CopyShareUrlButtonProps = {
  value: string;
};

export function CopyShareUrlButton({ value }: CopyShareUrlButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } finally {
      setCopying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex rounded-lg border border-[#c7d8d1] bg-white px-3 py-1.5 text-xs font-semibold text-[#21453a] transition-colors hover:bg-[#f0f7f4] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {copying ? "Copying..." : copied ? "Copied" : "Copy URL"}
    </button>
  );
}
