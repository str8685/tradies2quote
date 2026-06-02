/**
 * Sentry — Node.js runtime config.
 *
 * Loaded lazily by `instrumentation.ts → register()` only when
 * `NEXT_PUBLIC_SENTRY_DSN` is present, so this file never executes
 * (and `@sentry/nextjs` never enters the bundle) for builds without
 * Sentry configured.
 *
 * Conservative defaults:
 *   - `tracesSampleRate: 0.1` — keep performance-sampling cost low
 *   - `replaysOnErrorSampleRate: 1.0` — capture replays only on
 *     errors, not on every session
 *   - `enabled: production-only` — local dev errors don't flood the
 *     project; flip the comment to also capture preview/development
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  // Don't drop PII for now — useful for debugging signup/quote flows.
  // Revisit before scaling beyond beta if it becomes a privacy concern.
  sendDefaultPii: true,
  // Tag the environment so production / preview events stay separable
  // in the Sentry UI.
  environment:
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
});
