"use client";

import { recordCandidateApiMetric } from "@/lib/client/student-perf";

export type StudentQueryResource =
  | "profile_identity"
  | "profile_full"
  | "dashboard"
  | "capability_profiles"
  | "artifacts"
  | "ai_literacy_map";

type CacheEntry = {
  resource: StudentQueryResource;
  scope: string;
  expiresAt: number;
  payload: unknown;
};

const ttlByResourceMs: Record<StudentQueryResource, number> = {
  profile_identity: 5 * 60 * 1000,
  profile_full: 30 * 1000,
  dashboard: 20 * 1000,
  capability_profiles: 20 * 1000,
  artifacts: 20 * 1000,
  ai_literacy_map: 20 * 1000,
};

const mutationInvalidationMap: Array<{ predicate: (path: string) => boolean; resources: StudentQueryResource[] }> = [
  {
    predicate: (path) => path === "/api/student/profile",
    resources: ["profile_full", "profile_identity", "dashboard"],
  },
  {
    predicate: (path) =>
      path === "/api/student/capability-profiles/selection" || path === "/api/student/capability-profiles/request",
    resources: ["capability_profiles", "dashboard", "ai_literacy_map"],
  },
  {
    predicate: (path) =>
      path.startsWith("/api/student/artifacts") ||
      path.startsWith("/api/student/extract/") ||
      path.includes("/api/student/artifacts/transcripts/"),
    resources: ["artifacts", "dashboard", "ai_literacy_map", "capability_profiles"],
  },
  {
    predicate: (path) => path === "/api/student/onboarding/signals",
    resources: ["dashboard"],
  },
  {
    predicate: (path) => path === "/api/student/ai-literacy-map",
    resources: ["ai_literacy_map", "dashboard"],
  },
];

const responseCache = new Map<string, CacheEntry>();
const inflightCache = new Map<string, Promise<unknown>>();
let currentStudentCacheScope = "";

const normalizePath = (path: string): string => {
  if (typeof window === "undefined") return path;
  const url = new URL(path, window.location.origin);
  const params = Array.from(url.searchParams.entries()).sort(([left], [right]) => left.localeCompare(right));
  const sorted = new URLSearchParams(params);
  const query = sorted.toString();
  return `${url.pathname}${query.length > 0 ? `?${query}` : ""}`;
};

const buildCacheKey = ({
  method,
  normalizedPath,
  scope,
}: {
  method: string;
  normalizedPath: string;
  scope: string;
}): string => `${method.toUpperCase()}|${normalizedPath}|${scope}`;

const extractCacheScopeFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const identity = (data as Record<string, unknown>).identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) return null;
  const scope = (identity as Record<string, unknown>).cache_scope;
  if (typeof scope !== "string") return null;
  const normalized = scope.trim();
  return normalized.length > 0 ? normalized : null;
};

const setScopeFromPayload = (payload: unknown) => {
  const scope = extractCacheScopeFromPayload(payload);
  if (scope && scope !== currentStudentCacheScope) {
    currentStudentCacheScope = scope;
  }
};

const shouldUseStudentQueryCache = (method: string, path: string): boolean =>
  method.toUpperCase() === "GET" && path.startsWith("/api/student/");

const readCacheEntry = (key: string): CacheEntry | null => {
  const entry = responseCache.get(key);
  if (!entry) return null;
  return entry;
};

const writeCacheEntry = ({
  key,
  resource,
  scope,
  payload,
}: {
  key: string;
  resource: StudentQueryResource;
  scope: string;
  payload: unknown;
}) => {
  responseCache.set(key, {
    resource,
    scope,
    payload,
    expiresAt: Date.now() + ttlByResourceMs[resource],
  });
};

const fetchAndCache = async ({
  path,
  key,
  resource,
  scope,
}: {
  path: string;
  key: string;
  resource: StudentQueryResource;
  scope: string;
}): Promise<unknown> => {
  const requestPromise = (async () => {
    recordCandidateApiMetric({ metric: "network_request" });
    const response = await fetch(path, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    setScopeFromPayload(payload);
    if (!response.ok) {
      throw new Error("student_query_request_failed");
    }
    writeCacheEntry({ key, resource, scope, payload });
    return payload;
  })();

  inflightCache.set(key, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightCache.delete(key);
  }
};

export const setStudentQueryCacheScope = (scope: string) => {
  const normalized = scope.trim();
  if (normalized.length === 0) return;
  currentStudentCacheScope = normalized;
};

export const getStudentQueryCacheScope = (): string => currentStudentCacheScope;

export const fetchStudentQuery = async <TPayload>({
  path,
  resource,
}: {
  path: string;
  resource: StudentQueryResource;
}): Promise<TPayload> => {
  if (!shouldUseStudentQueryCache("GET", path)) {
    const response = await fetch(path, { cache: "no-store" });
    return (await response.json().catch(() => null)) as TPayload;
  }

  const normalizedPath = normalizePath(path);
  const scope = currentStudentCacheScope;
  if (!scope) {
    recordCandidateApiMetric({ metric: "cache_miss" });
    recordCandidateApiMetric({ metric: "network_request" });
    const response = await fetch(path, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as TPayload;
    setScopeFromPayload(payload);
    return payload;
  }

  const key = buildCacheKey({ method: "GET", normalizedPath, scope });
  const now = Date.now();
  const entry = readCacheEntry(key);

  if (entry && entry.expiresAt > now) {
    recordCandidateApiMetric({ metric: "cache_hit_fresh" });
    return entry.payload as TPayload;
  }

  if (entry && entry.expiresAt <= now) {
    recordCandidateApiMetric({ metric: "cache_hit_stale" });
    if (!inflightCache.has(key)) {
      recordCandidateApiMetric({ metric: "revalidate" });
      void fetchAndCache({ path, key, resource, scope });
    } else {
      recordCandidateApiMetric({ metric: "duplicate_get" });
    }
    return entry.payload as TPayload;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    recordCandidateApiMetric({ metric: "duplicate_get" });
    return (await inflight) as TPayload;
  }

  recordCandidateApiMetric({ metric: "cache_miss" });
  return (await fetchAndCache({ path, key, resource, scope })) as TPayload;
};

export const invalidateStudentQueryResources = (resources: StudentQueryResource[]) => {
  if (resources.length === 0) return;
  const set = new Set(resources);
  for (const [key, entry] of responseCache.entries()) {
    if (!set.has(entry.resource)) continue;
    if (currentStudentCacheScope && entry.scope !== currentStudentCacheScope) continue;
    responseCache.delete(key);
  }
};

export const invalidateStudentCacheForMutation = (path: string) => {
  const normalizedPath = normalizePath(path).split("?")[0] ?? path;
  const matchedResources = mutationInvalidationMap.find((entry) => entry.predicate(normalizedPath))?.resources ?? [];
  invalidateStudentQueryResources(matchedResources);
};

export const __unsafe__resetStudentQueryCache = () => {
  responseCache.clear();
  inflightCache.clear();
  currentStudentCacheScope = "";
};

export const __unsafe__ttlByResourceMs = ttlByResourceMs;
