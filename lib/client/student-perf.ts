"use client";

type CandidateApiMetric =
  | "network_request"
  | "duplicate_get"
  | "cache_hit_fresh"
  | "cache_hit_stale"
  | "cache_miss"
  | "revalidate";

type CandidateBoundary = "shell" | "dashboard" | "artifacts" | "profile" | "targets";

type CounterSnapshot = {
  network_request: number;
  duplicate_get: number;
  cache_hit_fresh: number;
  cache_hit_stale: number;
  cache_miss: number;
  revalidate: number;
};

type PerfState = {
  counters: CounterSnapshot;
  perRouteRequests: Record<string, number>;
};

type BoundaryHandle = {
  boundary: CandidateBoundary;
  route: string;
  startedAt: number;
  startSnapshot: CounterSnapshot;
};

const defaultCounters = (): CounterSnapshot => ({
  network_request: 0,
  duplicate_get: 0,
  cache_hit_fresh: 0,
  cache_hit_stale: 0,
  cache_miss: 0,
  revalidate: 0,
});

const getRoute = (): string => {
  if (typeof window === "undefined") return "unknown";
  return window.location.pathname || "unknown";
};

const cloneCounters = (snapshot: CounterSnapshot): CounterSnapshot => ({ ...snapshot });

const perfState: PerfState = {
  counters: defaultCounters(),
  perRouteRequests: {},
};

const shouldSampleProduction = (): boolean => Math.random() < 0.05;

const emitToObservability = (name: string, data: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "production") return;
  if (!shouldSampleProduction()) return;

  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        scope.setTag("perf_stream", "candidate_ui");
        scope.setContext("candidate_perf", data);
        Sentry.captureMessage(name, "info");
      });
    })
    .catch(() => {
      // Ignore observability transport failures in client perf instrumentation.
    });
};

export const recordCandidateApiMetric = ({
  metric,
  route,
}: {
  metric: CandidateApiMetric;
  route?: string;
}) => {
  const resolvedRoute = route ?? getRoute();
  perfState.counters[metric] += 1;

  if (metric === "network_request") {
    perfState.perRouteRequests[resolvedRoute] = (perfState.perRouteRequests[resolvedRoute] ?? 0) + 1;
  }
};

export const startCandidateBoundary = (boundary: CandidateBoundary): BoundaryHandle => ({
  boundary,
  route: getRoute(),
  startedAt: Date.now(),
  startSnapshot: cloneCounters(perfState.counters),
});

export const endCandidateBoundary = (handle: BoundaryHandle) => {
  const durationMs = Math.max(0, Date.now() - handle.startedAt);
  const diff: CounterSnapshot = {
    network_request: perfState.counters.network_request - handle.startSnapshot.network_request,
    duplicate_get: perfState.counters.duplicate_get - handle.startSnapshot.duplicate_get,
    cache_hit_fresh: perfState.counters.cache_hit_fresh - handle.startSnapshot.cache_hit_fresh,
    cache_hit_stale: perfState.counters.cache_hit_stale - handle.startSnapshot.cache_hit_stale,
    cache_miss: perfState.counters.cache_miss - handle.startSnapshot.cache_miss,
    revalidate: perfState.counters.revalidate - handle.startSnapshot.revalidate,
  };
  const cacheHits = diff.cache_hit_fresh + diff.cache_hit_stale;
  const cacheHitRate = cacheHits + diff.cache_miss > 0 ? Number((cacheHits / (cacheHits + diff.cache_miss)).toFixed(4)) : 0;

  const summary = {
    boundary: handle.boundary,
    route: handle.route,
    duration_ms: durationMs,
    initial_load_api_requests: diff.network_request,
    duplicate_get_requests: diff.duplicate_get,
    cache_hit_fresh: diff.cache_hit_fresh,
    cache_hit_stale: diff.cache_hit_stale,
    cache_miss: diff.cache_miss,
    cache_revalidate: diff.revalidate,
    cache_hit_rate: cacheHitRate,
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[candidate-perf]", summary);
  }

  emitToObservability("candidate_perf_boundary_ready", summary);
};
