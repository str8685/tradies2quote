import { after } from "next/server";
import { buildErrorRow, type CaptureContext } from "./observability/fingerprint";
import { writeAppError } from "./observability/sink";

export type { CaptureContext } from "./observability/fingerprint";

/**
 * Report a CAUGHT error to the INTERNAL error monitor (own Supabase, owner-only
 * dashboard — not a paid 3rd party).
 *
 * Why this exists: Next's `onRequestError` only sees errors that BUBBLE OUT of
 * a handler. Our API routes catch their errors and return JSON, so those
 * failures never reach monitoring on their own. Call this in those catch blocks
 * (alongside the existing `console.error`) so caught failures are recorded.
 *
 * Safe by construction:
 *   - Runs OFF the hot path: scheduled via `after()` (post-response) when in a
 *     request scope, else fire-and-forget — the caller never awaits the write.
 *   - NEVER throws: building the row and scheduling the write are fully wrapped.
 *   - No-op-safe if the DB tables/RPC aren't applied yet — the sink swallows
 *     the RPC error.
 *   - No customer data / request bodies / secrets stored — see fingerprint.ts.
 */
export function captureError(error: unknown, context?: CaptureContext): void {
  try {
    const row = buildErrorRow(error, context);
    const flush = () => writeAppError(row); // never throws
    try {
      // Preferred: run after the response is sent (request scope only).
      after(flush);
    } catch {
      // Outside a request scope (or `after` unavailable) → fire-and-forget.
      void flush().catch(() => {});
    }
  } catch {
    /* reporting must never change request behaviour */
  }
}
