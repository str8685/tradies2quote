/**
 * Sentry — browser-side init (Next 16 native client instrumentation).
 *
 * Next.js 16 auto-loads `instrumentation-client.ts` on the client, which is
 * how the browser Sentry SDK now activates (this replaces the legacy
 * `sentry.client.config.ts`, which was NOT auto-loaded under Turbopack).
 *
 * `Sentry.init` is a no-op when `dsn` is undefined, and `enabled` is
 * production-only, so this file is safe with or without
 * `NEXT_PUBLIC_SENTRY_DSN` set — no events are sent until a DSN exists.
 *
 * Session Replay is sampled at 0% normally and 100% on error, with all text
 * + media masked so a tradie's transcript / client PII is never captured.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  sendDefaultPii: true,
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
});

// Next 16 client navigation instrumentation — lets Sentry tie errors to the
// route transition the user was on. Required hook export for the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
