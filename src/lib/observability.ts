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
 *   - No-op-safe if the DB tables/RPC aren't applied yet — the sink returns a
 *     failed WriteResult (which this fire-and-forget path ignores).
 *   - No customer data / request bodies / secrets stored — see fingerprint.ts.
 */
export function captureError(error: unknown, context?: CaptureContext): void {
  try {
    const row = buildErrorRow(error, context);
    const flush = () => writeAppError(row); // never throws; result ignored here
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

/**
 * DIAGNOSTIC ONLY — awaits the sink write in the CALLER's (guaranteed-alive)
 * scope and emits unique log markers plus the RPC outcome. Unlike
 * `captureError`, this does not use `after()`: it awaits inside the request so
 * the serverless function cannot suspend before the write completes. Intended
 * to be called behind an env flag in a single preview route to prove the write
 * path end-to-end and surface any RPC error.
 *
 * Never throws. Returns the structured WriteResult outcome for the caller's
 * benefit (currently only logged).
 */
export async function captureErrorAwait(
  error: unknown,
  context?: CaptureContext,
): Promise<void> {
  try {
    const row = buildErrorRow(error, context);
    console.error("observability: starting writeAppError diagnostic", {
      fingerprint: row.fingerprint,
      route: row.route,
      surface: row.surface,
      environment: row.environment,
    });
    const result = await writeAppError(row);
    if (result.ok) {
      console.error("observability: writeAppError diagnostic succeeded", {
        fingerprint: row.fingerprint,
      });
    } else {
      console.error("observability: writeAppError diagnostic FAILED", {
        fingerprint: row.fingerprint,
        reason: result.skipped ?? "rpc_error",
        error: result.error,
      });
    }
  } catch (e) {
    // Defensive: the diagnostic itself must never throw into the route.
    console.error(
      "observability: writeAppError diagnostic threw",
      e instanceof Error ? e.message : String(e),
    );
  }
}
