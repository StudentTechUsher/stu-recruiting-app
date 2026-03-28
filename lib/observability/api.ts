import { createHash, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { captureApiUnexpectedException, resolveSentryEnabled } from "@/lib/observability/sentry";

export type ObsOutcome =
  | "start"
  | "success"
  | "handled_failure"
  | "unexpected_failure"
  | "failure"
  | "timeout"
  | "retry"
  | "dropped";
export type ObsSeverity = "debug" | "info" | "warn" | "error" | "fatal";

export type ProductMetricName =
  | "auth.login_requested"
  | "auth.login_completed"
  | "student.onboarding_completed"
  | "student.onboarding_completed.failed"
  | "student.profile_saved"
  | "student.profile_saved.failed"
  | "student.transcript_upload_started"
  | "student.transcript_upload_started.failed"
  | "student.transcript_materialized"
  | "recruiter.candidate_search_performed"
  | "recruiter.candidate_search_performed.failed"
  | "recruiter.candidate_profile_opened"
  | "recruiter.candidate_profile_opened.failed"
  | (string & {});

type ObsEvent = {
  event_name: string;
  event_version: "1.0";
  timestamp: string;
  env: string;
  service: string;
  component: string;
  operation: string;
  route: string;
  route_template: string;
  outcome: ObsOutcome;
  severity: ObsSeverity;
  request_id: string;
  trace_id?: string;
  method?: string;
  http_status?: number;
  status_code?: number;
  duration_ms?: number;
  provider?: string;
  persona?: string;
  org_id?: string;
  actor_id_surrogate?: string;
  domain_ids?: Record<string, string>;
  error_code?: string;
  error_class?: "expected_domain" | "unexpected_exception" | "dependency_failure" | "validation";
  is_expected?: boolean;
  sentry_event_id?: string;
  details?: Record<string, unknown>;
};

type StartEventInput = {
  eventName: string;
  details?: Record<string, unknown>;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
};

type ResultEventInput = {
  statusCode: number;
  eventName: string;
  outcome: ObsOutcome;
  severity?: ObsSeverity;
  errorCode?: string;
  provider?: string;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
  sentryEventId?: string;
  details?: Record<string, unknown>;
  durationMs?: number;
};

type UnexpectedEventInput = {
  eventName: string;
  error: unknown;
  provider?: string;
  details?: Record<string, unknown>;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
  errorCode?: string;
};

type ProductMetricFields = {
  outcome?: ObsOutcome;
  severity?: ObsSeverity;
  statusCode?: number;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
  errorCode?: string;
  sentryEventId?: string;
  details?: Record<string, unknown>;
  durationMs?: number;
};

export type ApiObsContext = {
  requestId: string;
  routeTemplate: string;
  method: string;
  component: string;
  operation: string;
  startedAtMs: number;
  traceId?: string;
  recordStart: (input: StartEventInput) => void;
  recordResult: (input: ResultEventInput) => void;
  recordUnexpected: (input: UnexpectedEventInput) => string | undefined;
};

const DEFAULT_SERVICE_NAME = "stu-recruiting-app";
const TRACE_ID_PATTERN = /^[a-f0-9]{32}$/i;
const TRACEPARENT_PATTERN = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i;
const SENTRY_TRACE_PATTERN = /^([\da-f]{32})-[\da-f]{16}(?:-[01])?$/i;
const B3_TRACE_PATTERN = /^[\da-f]{16,32}$/i;

const resolveEnv = () => {
  const normalized = process.env.NODE_ENV?.trim().toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "test") return "test";
  return normalized === "development" ? "local" : "preview";
};

const safeTrimmed = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeTraceId = (value: string | null): string | undefined => {
  const normalized = safeTrimmed(value);
  if (!normalized) return undefined;
  if (TRACE_ID_PATTERN.test(normalized)) return normalized.toLowerCase();
  if (B3_TRACE_PATTERN.test(normalized)) {
    return normalized.toLowerCase().padStart(32, "0");
  }
  return undefined;
};

const resolveTraceId = (request: Request): string | undefined => {
  const traceParent = safeTrimmed(request.headers.get("traceparent"));
  if (traceParent) {
    const match = traceParent.match(TRACEPARENT_PATTERN);
    if (match?.[1]) return match[1].toLowerCase();
  }

  const sentryTrace = safeTrimmed(request.headers.get("sentry-trace"));
  if (sentryTrace) {
    const match = sentryTrace.match(SENTRY_TRACE_PATTERN);
    if (match?.[1]) return match[1].toLowerCase();
  }

  return (
    normalizeTraceId(request.headers.get("x-trace-id")) ??
    normalizeTraceId(request.headers.get("x-b3-traceid")) ??
    undefined
  );
};

const toSentryLevel = (severity: ObsSeverity): Sentry.SeverityLevel => {
  if (severity === "fatal") return "fatal";
  if (severity === "error") return "error";
  if (severity === "warn") return "warning";
  if (severity === "debug") return "debug";
  return "info";
};

const emit = (event: ObsEvent): string | undefined => {
  if (!resolveSentryEnabled("server")) return undefined;
  const level = toSentryLevel(event.severity);

  const metricAttributes: Record<string, string> = {
    event_name: event.event_name,
    outcome: event.outcome,
    component: event.component,
    operation: event.operation
  };
  if (event.persona) metricAttributes.persona = event.persona;
  if (event.route_template) metricAttributes.route = event.route_template;
  if (event.provider) metricAttributes.provider = event.provider;
  if (event.error_code) metricAttributes.error_code = event.error_code;

  Sentry.metrics.count("stu.obs.events_total", 1, { attributes: metricAttributes });
  if (typeof event.duration_ms === "number" && Number.isFinite(event.duration_ms)) {
    Sentry.metrics.distribution("stu.obs.duration_ms", event.duration_ms, { attributes: metricAttributes });
  }
  if (event.event_name.startsWith("student.") || event.event_name.startsWith("recruiter.") || event.event_name.startsWith("auth.")) {
    Sentry.metrics.count("stu.product.events_total", 1, { attributes: metricAttributes });
  }

  return Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag("event_name", event.event_name);
    scope.setTag("service", event.service);
    scope.setTag("route", event.route_template);
    scope.setTag("component", event.component);
    scope.setTag("operation", event.operation);
    scope.setTag("outcome", event.outcome);
    scope.setTag("request_id", event.request_id);

    if (event.trace_id) scope.setTag("trace_id", event.trace_id);
    if (event.persona) scope.setTag("persona", event.persona);
    if (event.org_id) scope.setTag("org_id", event.org_id);
    if (event.provider) scope.setTag("provider", event.provider);
    if (event.error_code) scope.setTag("error_code", event.error_code);

    scope.setContext("observability_event", event);
    return Sentry.captureMessage(event.event_name, level);
  });
};

const toErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error
    };
  }

  return {
    name: "Error",
    message: "unknown_error"
  };
};

const resolveSeverityForOutcome = (outcome: ObsOutcome): ObsSeverity => {
  if (outcome === "unexpected_failure" || outcome === "failure") return "error";
  if (outcome === "handled_failure" || outcome === "timeout" || outcome === "dropped") return "warn";
  return "info";
};

const buildBaseEvent = ({
  context,
  eventName,
  outcome,
  severity
}: {
  context: ApiObsContext;
  eventName: string;
  outcome: ObsOutcome;
  severity: ObsSeverity;
}): ObsEvent => ({
  event_name: eventName,
  event_version: "1.0",
  timestamp: new Date().toISOString(),
  env: resolveEnv(),
  service: DEFAULT_SERVICE_NAME,
  component: context.component,
  operation: context.operation,
  route: context.routeTemplate,
  route_template: context.routeTemplate,
  outcome,
  severity,
  request_id: context.requestId,
  trace_id: context.traceId,
  method: context.method
});

const resolveDurationMs = (context: ApiObsContext, override?: number): number =>
  typeof override === "number" && Number.isFinite(override) && override >= 0
    ? override
    : Date.now() - context.startedAtMs;

const emitStartEvent = (context: ApiObsContext, input: StartEventInput) => {
  emit({
    ...buildBaseEvent({
      context,
      eventName: input.eventName,
      outcome: "start",
      severity: "info"
    }),
    persona: input.persona,
    org_id: input.orgId,
    actor_id_surrogate: input.actorIdSurrogate,
    domain_ids: input.domainIds,
    details: input.details
  });
};

const emitResultEvent = (context: ApiObsContext, input: ResultEventInput) => {
  const severity = input.severity ?? resolveSeverityForOutcome(input.outcome);
  emit({
    ...buildBaseEvent({
      context,
      eventName: input.eventName,
      outcome: input.outcome,
      severity
    }),
    http_status: input.statusCode,
    status_code: input.statusCode,
    duration_ms: resolveDurationMs(context, input.durationMs),
    error_code: input.errorCode,
    provider: input.provider,
    persona: input.persona,
    org_id: input.orgId,
    actor_id_surrogate: input.actorIdSurrogate,
    domain_ids: input.domainIds,
    sentry_event_id: input.sentryEventId,
    details: input.details
  });
};

const emitUnexpectedEvent = (context: ApiObsContext, input: UnexpectedEventInput): string | undefined => {
  const errorDetails = toErrorDetails(input.error);
  const sentryEventId = captureApiUnexpectedException({
    context: {
      requestId: context.requestId,
      routeTemplate: context.routeTemplate,
      method: context.method,
      component: context.component,
      operation: context.operation,
      persona: input.persona,
      orgId: input.orgId
    },
    eventName: input.eventName,
    error: input.error,
    provider: input.provider,
    details: input.details
  });

  emit({
    ...buildBaseEvent({
      context,
      eventName: input.eventName,
      outcome: "unexpected_failure",
      severity: "error"
    }),
    http_status: 500,
    status_code: 500,
    duration_ms: resolveDurationMs(context),
    provider: input.provider,
    error_code: input.errorCode ?? "unexpected_exception",
    error_class: "unexpected_exception",
    is_expected: false,
    persona: input.persona,
    org_id: input.orgId,
    actor_id_surrogate: input.actorIdSurrogate,
    domain_ids: input.domainIds,
    sentry_event_id: sentryEventId,
    details: {
      ...input.details,
      error_name: errorDetails.name,
      error_message: errorDetails.message
    }
  });

  return sentryEventId;
};

export const resolveCorrelation = (request: Request): { request_id: string; trace_id?: string } => ({
  request_id:
    safeTrimmed(request.headers.get("x-request-id")) ??
    safeTrimmed(request.headers.get("x-correlation-id")) ??
    randomUUID(),
  trace_id: resolveTraceId(request)
});

export const toActorSurrogate = (rawId?: string): string | undefined => {
  if (!rawId) return undefined;
  const normalized = rawId.trim();
  if (normalized.length === 0) return undefined;
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `h_${digest}`;
};

export const createApiObsContext = ({
  request,
  routeTemplate,
  component,
  operation
}: {
  request: Request;
  routeTemplate: string;
  component: string;
  operation: string;
}): ApiObsContext => {
  const correlation = resolveCorrelation(request);
  const context: ApiObsContext = {
    requestId: correlation.request_id,
    traceId: correlation.trace_id,
    routeTemplate,
    method: request.method.toUpperCase(),
    component,
    operation,
    startedAtMs: Date.now(),
    recordStart: (input) => emitStartEvent(context, input),
    recordResult: (input) => emitResultEvent(context, input),
    recordUnexpected: (input) => emitUnexpectedEvent(context, input)
  };

  return context;
};

export const attachRequestIdHeader = (response: Response, requestId: string) => {
  response.headers.set("x-request-id", requestId);
  return response;
};

export const logApiRequestStart = (context: ApiObsContext, details?: Record<string, unknown>) => {
  emit({
    ...buildBaseEvent({
      context,
      eventName: "stu.api.request.start.success",
      outcome: "success",
      severity: "info"
    }),
    details
  });
};

export const logApiRequestResult = ({
  context,
  statusCode,
  eventName,
  outcome,
  severity = resolveSeverityForOutcome(outcome),
  errorCode,
  provider,
  persona,
  orgId,
  actorIdSurrogate,
  domainIds,
  sentryEventId,
  details
}: {
  context: ApiObsContext;
  statusCode: number;
  eventName: string;
  outcome: ObsOutcome;
  severity?: ObsSeverity;
  errorCode?: string;
  provider?: string;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
  sentryEventId?: string;
  details?: Record<string, unknown>;
}) =>
  emitResultEvent(context, {
    statusCode,
    eventName,
    outcome,
    severity,
    errorCode,
    provider,
    persona,
    orgId,
    actorIdSurrogate,
    domainIds,
    sentryEventId,
    details
  });

export const logApiUnexpectedError = ({
  context,
  eventName,
  error,
  provider,
  details,
  persona,
  orgId,
  actorIdSurrogate,
  domainIds,
  errorCode
}: {
  context: ApiObsContext;
  eventName: string;
  error: unknown;
  provider?: string;
  details?: Record<string, unknown>;
  persona?: string;
  orgId?: string;
  actorIdSurrogate?: string;
  domainIds?: Record<string, string>;
  errorCode?: string;
}) =>
  emitUnexpectedEvent(context, {
    eventName,
    error,
    provider,
    details,
    persona,
    orgId,
    actorIdSurrogate,
    domainIds,
    errorCode
  });

export const recordProductMetric = (
  context: ApiObsContext,
  metric: ProductMetricName,
  fields: ProductMetricFields = {}
) => {
  const outcome = fields.outcome ?? "success";
  const severity = fields.severity ?? resolveSeverityForOutcome(outcome);

  emit({
    ...buildBaseEvent({
      context,
      eventName: metric,
      outcome,
      severity
    }),
    http_status: fields.statusCode,
    status_code: fields.statusCode,
    duration_ms: resolveDurationMs(context, fields.durationMs),
    persona: fields.persona,
    org_id: fields.orgId,
    actor_id_surrogate: fields.actorIdSurrogate,
    domain_ids: fields.domainIds,
    error_code: fields.errorCode,
    sentry_event_id: fields.sentryEventId,
    details: fields.details
  });
};
