// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
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

const enableReplay = process.env.NEXT_PUBLIC_SENTRY_ENABLE_REPLAY === "true";
const enableLogs = process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS === "true";

Sentry.init({
  dsn: resolveSentryDsn("client"),
  enabled: resolveSentryEnabled("client"),
  environment: resolveSentryEnvironment(),
  release: resolveSentryRelease(),
  tracesSampler: resolveTracesSampler(),
  sendDefaultPii: false,
  enableLogs,
  integrations: enableReplay ? [Sentry.replayIntegration()] : [],
  replaysSessionSampleRate: enableReplay ? 0.05 : 0,
  replaysOnErrorSampleRate: enableReplay ? 0.2 : 0,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubSentryBreadcrumb(breadcrumb);
  }
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
