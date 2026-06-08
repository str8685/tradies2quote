import * as Sentry from "@sentry/nextjs";

/**
 * Report a CAUGHT error to Sentry.
 *
 * Why this exists: Next's `onRequestError` instrumentation only sees
 * errors that BUBBLE OUT of a handler. Our API routes catch their errors
 * and return a JSON response, so those failures never reach Sentry on
 * their own. Call this in those catch blocks (alongside the existing
 * `console.error`) so caught failures are reported, not just logged.
 *
 * Safe by construction:
 *   - No-op when Sentry isn't initialised (DSN absent) — `captureException`
 *     simply drops the event.
 *   - Never throws: reporting must not change request behaviour.
 *   - No PII added here; the Sentry config controls `sendDefaultPii`.
 */
export function captureError(
  error: unknown,
  context?: { route?: string; extra?: Record<string, unknown> },
): void {
  try {
    Sentry.captureException(error, {
      tags: context?.route ? { route: context.route } : undefined,
      extra: context?.extra,
    });
  } catch {
    /* reporting must never throw */
  }
}
