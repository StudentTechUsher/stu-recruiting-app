// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  resolveSentryDsn,
  resolveSentryEnabled,
  resolveSentryEnvironment,
  resolveSentryRelease,
  resolveTracesSampler,
  scrubSentryBreadcrumb,
  scrubSentryEvent
} from "@/lib/observability/sentry";

Sentry.init({
  dsn: resolveSentryDsn("edge"),
  enabled: resolveSentryEnabled("edge"),
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
