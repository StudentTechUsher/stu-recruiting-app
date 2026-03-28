// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  resolveSentryDsn,
  resolveSentryEnabled,
  resolveSentryEnvironment,
  resolveSentryLogsEnabled,
  resolveSentryRelease,
  resolveTracesSampler,
  scrubSentryBreadcrumb,
  scrubSentryEvent
} from "@/lib/observability/sentry";

Sentry.init({
  dsn: resolveSentryDsn("server"),
  enabled: resolveSentryEnabled("server"),
  enableLogs: resolveSentryLogsEnabled("server"),
  environment: resolveSentryEnvironment(),
  release: resolveSentryRelease(),
  tracesSampler: resolveTracesSampler(),
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubSentryBreadcrumb(breadcrumb);
  }
});
