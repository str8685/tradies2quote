// ─────────────────────────────────────────────────────────────────────────
// Internal error monitoring — DB sink (server-only, FAILURE-SAFE).
//
// Writes one bounded, PII-free row via the `record_app_error` RPC (atomic
// group upsert + event insert; see the migration). Uses the service-role
// admin client so it works regardless of RLS.
//
// This function NEVER throws and NEVER blocks the caller's response in a way
// that matters — it is invoked from `captureError` via `after()` / fire-and-
// forget. If the migration is not yet applied (RPC/tables missing), the RPC
// returns an error which is swallowed here: logging failure must never affect
// the request.
// ─────────────────────────────────────────────────────────────────────────

import { adminClient } from "@/lib/supabase/admin";
import type { AppErrorRow } from "./fingerprint";

export async function writeAppError(row: AppErrorRow): Promise<void> {
  try {
    const supabase = adminClient(); // throws if SERVICE_ROLE key absent → caught
    // The generated Database types don't include `record_app_error` until the
    // migration is applied + types regenerated, so call through a permissive
    // cast. Behaviour is unchanged; this only relaxes the compile-time check.
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;

    const { error } = await rpc("record_app_error", {
      p_fingerprint: row.fingerprint,
      p_title: row.title,
      p_surface: row.surface,
      p_route: row.route,
      p_environment: row.environment,
      p_release_sha: row.release_sha,
      p_top_stack_frame: row.top_stack_frame,
      p_name: row.name,
      p_message: row.message,
      p_stack: row.stack,
      p_http_status: row.http_status,
      p_request_id: row.request_id,
      p_extra: row.extra,
    });

    if (error) {
      // Swallow (e.g. migration not applied yet). One quiet console line for
      // local/preview visibility; never rethrown.
      console.error("[observability] writeAppError failed:", error.message);
    }
  } catch {
    /* reporting must never throw */
  }
}
