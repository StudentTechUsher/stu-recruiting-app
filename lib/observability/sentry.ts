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
}) => {
  if (!resolveSentryEnabled("server")) return;

  Sentry.withScope((scope) => {
    scope.setTag("service", SENTRY_SERVICE_NAME);
    scope.setTag("route_template", context.routeTemplate);
    scope.setTag("component", context.component);
    scope.setTag("operation", context.operation);
    scope.setTag("outcome", "failure");
    scope.setTag("error_class", "unexpected_exception");
    scope.setTag("event_name", eventName);
    scope.setTag("request_id", context.requestId);
    if (provider) {
      scope.setTag("provider", provider);
    }
    scope.setContext("api", {
      method: context.method,
      route_template: context.routeTemplate,
      operation: context.operation
    });
    if (details) {
      scope.setContext("details", sanitizeRecord(details));
    }

    Sentry.captureException(error);
  });
};
