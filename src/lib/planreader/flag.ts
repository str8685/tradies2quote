import { isOwnerEmail } from "@/lib/owner";

/**
 * Plan-reader feature flag.
 *
 * Posture: SHIP the code, keep the flag OFF. The plan-reading + takeoff
 * backend (ingest/classify/extract) is internal-only until fixture-based
 * evaluation proves acceptable behaviour. Mirrors the existing
 * `XXX_ENABLED === "true"` flag convention (see kits.ts, payments.ts).
 *
 *   PLAN_READER_ENABLED   env flag. DEFAULT OFF (unset / not "true").
 *                         When "true", the flow is open to all authenticated
 *                         users — this is the GA / wider-rollout switch.
 *
 * The owner (OWNER_EMAIL) is ALWAYS allowed regardless of the flag, so
 * internal testing can happen in production with the flag still off for
 * everyone else.
 *
 * Cleanup path (when the feature goes GA and the flag is no longer needed):
 *   1. Set PLAN_READER_ENABLED=true in Vercel (enables for all users).
 *   2. Soak; confirm eval metrics + runtime logs are healthy.
 *   3. Delete this file and the `planReaderAllowed()` guard at the top of
 *      src/app/api/plans/{ingest,classify,extract}/route.ts, leaving the
 *      routes open. Remove the env var from Vercel.
 */
export function planReaderEnabled(): boolean {
  return process.env.PLAN_READER_ENABLED === "true";
}

/**
 * May this caller use the plan-reader flow? Owner always; everyone else only
 * when the flag is on. Returns false for anonymous callers.
 */
export function planReaderAllowed(email: string | null | undefined): boolean {
  return isOwnerEmail(email) || planReaderEnabled();
}
