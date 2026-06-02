/**
 * Sentry — browser-side config.
 *
 * Next.js auto-loads `sentry.client.config.ts` on the client when the
 * file is present. The `Sentry.init` call is internally a no-op when
 * `dsn` is undefined, so this file is safe to keep even when
 * `NEXT_PUBLIC_SENTRY_DSN` isn't set — no events get sent, but the
 * bundle is slightly larger than a guarded version. Worth it for the
 * simplicity (no module-level conditional dynamic imports on the
 * client).
 *
 * Configures Session Replay so that when an error fires the previous
 * ~10s of UI interaction can be replayed in the Sentry UI. Replays
 * are sampled at 0% normally (cost) and 100% on errors (debug value).
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  // Replay capture: zero by default, 100% on error. Catches the UI
  // sequence the user took right before the bug fired.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      // Mask all text + inputs so we never accidentally capture a
      // tradie's voice transcript / client PII in a replay.
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
