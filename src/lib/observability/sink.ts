// ─────────────────────────────────────────────────────────────────────────
// Internal error monitoring — DB sink (server-only, FAILURE-SAFE).
//
// Writes one bounded, PII-free row via the `record_app_error` RPC (atomic
// group upsert + event insert; see the migration). Uses the service-role
// admin client so it works regardless of RLS.
//
// This function NEVER throws. It is invoked from `captureError` via `after()`
// / fire-and-forget, so the caller never awaits it. If the service-role key is
// absent or the RPC errors, the failure is swallowed (one console line on a
// genuine RPC error) — logging failure must never affect the request.
// ─────────────────────────────────────────────────────────────────────────

import { adminClient } from "@/lib/supabase/admin";
import type { AppErrorRow } from "./fingerprint";

export async function writeAppError(row: AppErrorRow): Promise<void> {
  try {
    // adminClient() throws if the service-role key / URL is absent — treat as a
    // no-op (nothing we can do; never surface to the caller).
    let supabase;
    try {
      supabase = adminClient();
    } catch {
      return;
    }

    // The generated Database types don't include `record_app_error` until the
    // types are regenerated, so call through a permissive cast. IMPORTANT: cast
    // the CLIENT and call `.rpc(...)` directly on it — do NOT extract the method
    // into a local (`const rpc = supabase.rpc`), which loses the `this` binding
    // and throws "Cannot read properties of undefined (reading 'rest')" inside
    // supabase-js. Calling `db.rpc(...)` keeps `this` bound to the client.
    const db = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };

    const { error } = await db.rpc("record_app_error", {
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
      // Genuine RPC failure (e.g. migration not applied, grant missing). One
      // line for visibility; never rethrown.
      console.error("[observability] writeAppError failed:", error.message);
    }
  } catch {
    /* reporting must never throw */
  }
}
