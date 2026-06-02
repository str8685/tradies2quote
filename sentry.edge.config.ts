/**
 * Sentry — Vercel Edge runtime config (proxy.ts + any edge route
 * handlers + middleware-style hooks).
 *
 * Loaded lazily by `instrumentation.ts → register()` only when
 * `NEXT_PUBLIC_SENTRY_DSN` is present. See sentry.server.config.ts
 * for the rationale on each tuning knob.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: true,
  environment:
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
});
