// ─────────────────────────────────────────────────────────────────────────
// Internal error monitoring — DB sink (server-only, FAILURE-SAFE).
//
// Writes one bounded, PII-free row via the `record_app_error` RPC (atomic
// group upsert + event insert; see the migration). Uses the service-role
// admin client so it works regardless of RLS.
//
// This function NEVER throws. It returns a small WriteResult so a caller that
// WANTS to observe the outcome (the flag-gated diagnostic path) can, while the
// normal `captureError` path simply ignores the return and stays fire-and-
// forget. If the migration is not applied, the service-role key is missing, or
// the RPC errors, the failure is captured in the result (and logged) — never
// rethrown: logging failure must never affect the request.
//
// Verbose markers are gated behind DEBUG_INTERNAL_OBSERVABILITY so general
// operation stays quiet; the unconditional RPC-error line is preserved.
// ─────────────────────────────────────────────────────────────────────────

import { adminClient } from "@/lib/supabase/admin";
import type { AppErrorRow } from "./fingerprint";

export interface WriteResult {
  ok: boolean;
  /** Error message when the write did not succeed. */
  error?: string;
  /** Set when the write was a deliberate no-op (e.g. admin client unavailable). */
  skipped?: string;
}

function debugEnabled(): boolean {
  return process.env.DEBUG_INTERNAL_OBSERVABILITY === "1";
}

export async function writeAppError(row: AppErrorRow): Promise<WriteResult> {
  const debug = debugEnabled();
  try {
    if (debug) {
      console.error("observability: writeAppError invoked", {
        fingerprint: row.fingerprint,
        route: row.route,
        surface: row.surface,
        environment: row.environment,
      });
    }

    // adminClient() throws if the service-role key / URL is absent. Previously
    // this throw was swallowed with no trace — the silent failure we were
    // chasing. Now it surfaces as a structured result (and a debug line).
    let supabase;
    try {
      supabase = adminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (debug) {
        console.error("observability: writeAppError adminClient unavailable:", msg);
      }
      return { ok: false, skipped: "admin_client_unavailable", error: msg };
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
      // Always log a single line for a genuine RPC failure (e.g. migration not
      // applied, grant missing). Never rethrown.
      console.error("[observability] writeAppError failed:", error.message);
      return { ok: false, error: error.message };
    }

    if (debug) {
      console.error("observability: writeAppError rpc ok", {
        fingerprint: row.fingerprint,
      });
    }
    return { ok: true };
  } catch (e) {
    // Any unexpected throw (network, serialization, …) — surface one line,
    // never rethrow.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[observability] writeAppError threw:", msg);
    return { ok: false, error: msg };
  }
}
