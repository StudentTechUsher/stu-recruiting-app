import { randomUUID } from "node:crypto";

export type ObsOutcome = "success" | "failure" | "timeout" | "retry" | "dropped";
export type ObsSeverity = "debug" | "info" | "warn" | "error" | "fatal";

type ObsEvent = {
  event_name: string;
  event_version: "1.0";
  timestamp: string;
  env: string;
  service: string;
  component: string;
  operation: string;
  route_template: string;
  outcome: ObsOutcome;
  severity: ObsSeverity;
  request_id: string;
  trace_id?: string;
  method?: string;
  status_code?: number;
  duration_ms?: number;
  provider?: string;
  persona?: string;
  error_code?: string;
  error_class?: "expected_domain" | "unexpected_exception" | "dependency_failure" | "validation";
  is_expected?: boolean;
  details?: Record<string, unknown>;
};

export type ApiObsContext = {
  requestId: string;
  routeTemplate: string;
  method: string;
  component: string;
  operation: string;
  startedAtMs: number;
};

const DEFAULT_SERVICE_NAME = "stu-recruiting-app";

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

const emit = (event: ObsEvent) => {
  const payload = JSON.stringify(event);
  if (event.severity === "error" || event.severity === "fatal") {
    console.error(payload);
    return;
  }
  if (event.severity === "warn") {
    console.warn(payload);
    return;
  }
  if (event.severity === "debug") {
    console.debug(payload);
    return;
  }
  console.info(payload);
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
  route_template: context.routeTemplate,
  outcome,
  severity,
  request_id: context.requestId,
  method: context.method
});

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
  const requestId =
    safeTrimmed(request.headers.get("x-request-id")) ??
    safeTrimmed(request.headers.get("x-correlation-id")) ??
    randomUUID();

  return {
    requestId,
    routeTemplate,
    method: request.method.toUpperCase(),
    component,
    operation,
    startedAtMs: Date.now()
  };
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
  severity = outcome === "failure" ? "error" : "info",
  errorCode,
  provider,
  persona,
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
  details?: Record<string, unknown>;
}) => {
  emit({
    ...buildBaseEvent({
      context,
      eventName,
      outcome,
      severity
    }),
    status_code: statusCode,
    duration_ms: Date.now() - context.startedAtMs,
    error_code: errorCode,
    provider,
    persona,
    details
  });
};

export const logApiUnexpectedError = ({
  context,
  eventName,
  error,
  provider,
  details
}: {
  context: ApiObsContext;
  eventName: string;
  error: unknown;
  provider?: string;
  details?: Record<string, unknown>;
}) => {
  const errorDetails = toErrorDetails(error);
  emit({
    ...buildBaseEvent({
      context,
      eventName,
      outcome: "failure",
      severity: "error"
    }),
    status_code: 500,
    duration_ms: Date.now() - context.startedAtMs,
    provider,
    error_code: "unexpected_exception",
    error_class: "unexpected_exception",
    is_expected: false,
    details: {
      ...details,
      error_name: errorDetails.name,
      error_message: errorDetails.message
    }
  });
};
