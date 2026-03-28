import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

type RuntimeTarget = "client" | "server" | "edge";

type SamplingContextLike = {
  name?: string;
  parentSampled?: boolean;
};

type ApiExceptionContext = {
  requestId: string;
  routeTemplate: string;
  method: string;
  component: string;
  operation: string;
  persona?: string;
  orgId?: string;
};

type SentryObsTagsInput = {
  route: string;
  persona?: string;
  org_id?: string;
  request_id: string;
  outcome?: string;
};

const SENTRY_SERVICE_NAME = "stu-recruiting-app";
const REDACTED = "[redacted]";
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CRITICAL_TRANSACTION_MATCHES = [
  "/api/auth/login/student",
  "/api/auth/login/recruiter",
  "/api/auth/login/referrer",
  "/api/auth/login/staff",
  "/api/student/extract/resume",
  "/api/student/artifacts/transcripts/[sessionId]/parse",
  "/api/student/artifacts/transcripts/[sessionId]/materialize"
];
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-forwarded-for",
  "x-real-ip"
]);

const clampSampleRate = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const readSampleRate = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return clampSampleRate(parsed);
};

const parseOptionalEnv = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseBooleanEnv = (value: string | undefined): boolean | undefined => {
  const normalized = parseOptionalEnv(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeText = (value: string): string => value.replace(EMAIL_PATTERN, REDACTED);

const sanitizeUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("?")[0] ?? value;
  }
};

const sanitizeRecord = (value: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      next[key] = sanitizeText(entry);
      continue;
    }
    if (Array.isArray(entry)) {
      next[key] = entry.map((row) => (typeof row === "string" ? sanitizeText(row) : row));
      continue;
    }
    next[key] = entry;
  }
  return next;
};

const scrubHeaders = (value: unknown): Record<string, unknown> | undefined => {
  if (!isObject(value)) return undefined;
  const headers: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) {
      headers[key] = REDACTED;
      continue;
    }
    headers[key] = typeof rawValue === "string" ? sanitizeText(rawValue) : rawValue;
  }
  return headers;
};

const scrubRequestContext = (value: unknown): Record<string, unknown> | undefined => {
  if (!isObject(value)) return undefined;
  const requestContext = { ...value };
  if (typeof requestContext.url === "string") {
    requestContext.url = sanitizeUrl(requestContext.url);
  }
  if ("headers" in requestContext) {
    requestContext.headers = scrubHeaders(requestContext.headers);
  }
  if ("data" in requestContext && isObject(requestContext.data)) {
    requestContext.data = sanitizeRecord(requestContext.data);
  } else if (typeof requestContext.data === "string") {
    requestContext.data = sanitizeText(requestContext.data);
  }
  return requestContext;
};

const scrubUserContext = (value: unknown): Record<string, unknown> | undefined => {
  if (!isObject(value)) return undefined;
  const userContext = { ...value };
  if ("email" in userContext) {
    userContext.email = REDACTED;
  }
  if ("ip_address" in userContext) {
    userContext.ip_address = REDACTED;
  }
  return userContext;
};

const isCriticalTransaction = (name: string | undefined): boolean => {
  if (!name) return false;
  return CRITICAL_TRANSACTION_MATCHES.some((match) => name.includes(match));
};

const safeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const resolveSentryDsn = (target: RuntimeTarget): string | undefined => {
  const publicDsn = parseOptionalEnv(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (target === "client") return publicDsn;

  const serverDsn = parseOptionalEnv(process.env.SENTRY_DSN);
  return serverDsn ?? publicDsn;
};

export const resolveSentryEnvironment = (): string => {
  const explicit = parseOptionalEnv(process.env.SENTRY_ENVIRONMENT);
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "development") return "local";
  if (process.env.NODE_ENV === "test") return "test";
  return "preview";
};

export const resolveSentryRelease = (): string | undefined => parseOptionalEnv(process.env.SENTRY_RELEASE);

export const resolveSentryEnabled = (target: RuntimeTarget): boolean => Boolean(resolveSentryDsn(target));

export const resolveSentryLogsEnabled = (target: RuntimeTarget): boolean => {
  if (!resolveSentryEnabled(target)) return false;

  const serverSetting = parseBooleanEnv(process.env.SENTRY_ENABLE_LOGS);
  const clientSetting = parseBooleanEnv(process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS);

  if (target === "client") {
    return clientSetting ?? serverSetting ?? true;
  }

  return serverSetting ?? clientSetting ?? true;
};

export const resolveTracesSampler = () => {
  const isProd = resolveSentryEnvironment() === "production";
  const defaultBase = isProd ? 0.02 : 0.1;
  const defaultCritical = isProd ? 0.15 : 1;

  const baseRate = readSampleRate("SENTRY_TRACE_SAMPLE_RATE_BASE", defaultBase);
  const criticalRate = readSampleRate("SENTRY_TRACE_SAMPLE_RATE_CRITICAL", defaultCritical);

  return (samplingContext: SamplingContextLike): number => {
    if (typeof samplingContext.parentSampled === "boolean") {
      return samplingContext.parentSampled ? 1 : 0;
    }
    if (isCriticalTransaction(samplingContext.name)) {
      return criticalRate;
    }
    return baseRate;
  };
};

export const scrubSentryEvent = (event: ErrorEvent): ErrorEvent => {
  event.request = scrubRequestContext(event.request);
  event.user = scrubUserContext(event.user);

  if (isObject(event.extra)) {
    event.extra = sanitizeRecord(event.extra);
  }

  if (typeof event.message === "string") {
    event.message = sanitizeText(event.message);
  }

  return event;
};

export const scrubSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => {
  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = sanitizeText(breadcrumb.message);
  }

  if (isObject(breadcrumb.data)) {
    breadcrumb.data = sanitizeRecord(breadcrumb.data);
  }

  return breadcrumb;
};

const applySentryObsTags = (
  scope: {
    setTag: (key: string, value: string) => void;
  },
  input: SentryObsTagsInput
) => {
  scope.setTag("service", SENTRY_SERVICE_NAME);
  scope.setTag("route", input.route);
  scope.setTag("route_template", input.route);
  scope.setTag("request_id", input.request_id);
  if (input.persona) scope.setTag("persona", input.persona);
  if (input.org_id) scope.setTag("org_id", input.org_id);
  if (input.outcome) scope.setTag("outcome", input.outcome);
};

export const setSentryObsTags = (input: SentryObsTagsInput) => {
  if (!resolveSentryEnabled("server")) return;
  Sentry.setTag("service", SENTRY_SERVICE_NAME);
  Sentry.setTag("route", input.route);
  Sentry.setTag("route_template", input.route);
  Sentry.setTag("request_id", input.request_id);
  if (input.persona) Sentry.setTag("persona", input.persona);
  if (input.org_id) Sentry.setTag("org_id", input.org_id);
  if (input.outcome) Sentry.setTag("outcome", input.outcome);
};

export const captureServerExceptionWithId = (
  error: unknown,
  context: Record<string, unknown>
): string | undefined => {
  if (!resolveSentryEnabled("server")) return undefined;

  return Sentry.withScope((scope) => {
    const route = safeString(context.route) ?? safeString(context.route_template) ?? "unknown_route";
    const requestId = safeString(context.request_id) ?? "unknown_request";

    applySentryObsTags(scope, {
      route,
      request_id: requestId,
      persona: safeString(context.persona),
      org_id: safeString(context.org_id),
      outcome: safeString(context.outcome)
    });

    const eventName = safeString(context.event_name);
    const component = safeString(context.component);
    const operation = safeString(context.operation);
    const provider = safeString(context.provider);
    const method = safeString(context.method);

    if (eventName) scope.setTag("event_name", eventName);
    if (component) scope.setTag("component", component);
    if (operation) scope.setTag("operation", operation);
    if (provider) scope.setTag("provider", provider);

    const details = isObject(context.details) ? sanitizeRecord(context.details) : undefined;
    scope.setContext("observability", sanitizeRecord(context));
    scope.setContext("api", {
      method,
      route_template: route,
      operation: operation ?? "unknown_operation"
    });
    if (details) {
      scope.setContext("details", details);
    }

    return Sentry.captureException(error);
  });
};

export const captureApiUnexpectedException = ({
  context,
  eventName,
  error,
  provider,
  details
}: {
  context: ApiExceptionContext;
  eventName: string;
  error: unknown;
  provider?: string;
  details?: Record<string, unknown>;
}): string | undefined =>
  captureServerExceptionWithId(error, {
    event_name: eventName,
    route: context.routeTemplate,
    route_template: context.routeTemplate,
    request_id: context.requestId,
    method: context.method,
    component: context.component,
    operation: context.operation,
    provider,
    persona: context.persona,
    org_id: context.orgId,
    outcome: "unexpected_failure",
    error_class: "unexpected_exception",
    details
  });
