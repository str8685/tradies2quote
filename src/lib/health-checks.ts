/**
 * Server-only health probes used by `/app/debug`.
 *
 * Each function returns `{ status: "ok" | "missing" | "error" }` plus a
 * short human-readable detail string. **No secret values, key prefixes,
 * key lengths, or anything else that could leak into a screenshot are
 * ever included** — we only ever say "configured" / "not set" / "error".
 *
 * This module is imported only from server components (the debug page
 * is a server component) so it never enters the client bundle, but we
 * keep secrets out of every return value anyway as a defence-in-depth.
 */

import { createClient } from "@/lib/supabase/server";

export type HealthStatus = "ok" | "missing" | "error";

export interface HealthCheck {
  /** Stable id used as React key. */
  id: string;
  /** Display name. */
  name: string;
  /** Status bucket — ok / missing / error. */
  status: HealthStatus;
  /** One-line human detail. Never contains secrets. */
  detail: string;
}

/** Truthy env-var check. Avoids logging the value, only its presence. */
function envSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Returns "configured" / "not set" — never the value itself. */
function envStatus(name: string): { status: HealthStatus; detail: string } {
  return envSet(name)
    ? { status: "ok", detail: "Configured" }
    : { status: "missing", detail: `Env var ${name} is not set` };
}

async function checkSupabase(): Promise<HealthCheck> {
  try {
    const supabase = await createClient();
    // Cheap read against `profiles` — RLS-scoped to the caller, so this
    // either returns the caller's own row, no rows, or an error. We
    // don't inspect the data; we only need to know the round-trip works.
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) {
      return {
        id: "supabase",
        name: "Supabase",
        status: "error",
        detail: "Connected but the test query failed",
      };
    }
    return {
      id: "supabase",
      name: "Supabase",
      status: "ok",
      detail: "Auth + DB reachable from the server",
    };
  } catch {
    return {
      id: "supabase",
      name: "Supabase",
      status: "error",
      detail: "Could not reach Supabase",
    };
  }
}

function checkAnthropic(): HealthCheck {
  const r = envStatus("ANTHROPIC_API_KEY");
  return {
    id: "anthropic",
    name: "AI quote generator (Anthropic)",
    status: r.status,
    detail: r.detail,
  };
}

function checkTranscription(): HealthCheck {
  const r = envStatus("OPENAI_API_KEY");
  return {
    id: "transcription",
    name: "Voice transcription (OpenAI Whisper)",
    status: r.status,
    detail: r.detail,
  };
}

function checkResend(): HealthCheck {
  const r = envStatus("RESEND_API_KEY");
  return {
    id: "resend",
    name: "Quote email (Resend)",
    status: r.status,
    detail: r.detail,
  };
}

function checkStorage(): HealthCheck {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return {
      id: "storage",
      name: "Supabase storage",
      status: "missing",
      detail: "NEXT_PUBLIC_SUPABASE_URL is not set",
    };
  }
  return {
    id: "storage",
    name: "Supabase storage",
    status: "ok",
    detail: "Storage endpoint configured",
  };
}

/**
 * Aggregate all health checks. Caller is expected to be the owner-only
 * debug page; this function does NO authorization itself.
 */
export async function getAllHealthChecks(): Promise<HealthCheck[]> {
  // Supabase needs a server-side fetch; everything else is sync.
  const [supabase] = await Promise.all([checkSupabase()]);
  return [
    supabase,
    checkAnthropic(),
    checkTranscription(),
    checkResend(),
    checkStorage(),
  ];
}

/**
 * Build-time / deploy-time identity, sourced entirely from
 * Vercel-injected env vars. None of these are secrets — Vercel sets them
 * automatically on every build and they're already visible in the
 * x-vercel-id response header.
 */
export interface BuildIdentity {
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  vercelEnv: string | null;
  vercelUrl: string | null;
  nodeEnv: string;
}

export function getBuildIdentity(): BuildIdentity {
  return {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    nodeEnv: process.env.NODE_ENV,
  };
}
