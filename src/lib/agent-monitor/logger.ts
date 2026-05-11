import "server-only";

/**
 * Server-only logger that posts agent events to the external monitoring
 * dashboard at AGENT_DASHBOARD_URL (the 685agents project).
 *
 * Hard rules — every change must preserve these:
 *  1. Server-only. The `import "server-only"` at the top makes the
 *     Next build fail if anyone tries to import this from a client
 *     component, and Vitest stubs it for tests.
 *  2. Never throws. Every helper returns void and swallows all errors —
 *     a failed log MUST NOT break the request that triggered it.
 *  3. No-op when env vars are missing. AGENT_DASHBOARD_URL and
 *     AGENT_DASHBOARD_SECRET both have to be present (and the secret
 *     must be ≥16 chars to match the dashboard's check) or the helper
 *     short-circuits with no network call.
 *  4. PII safe. The caller may pass extra fields (userId, metadata,
 *     startedAt, finishedAt) but only an allow-listed subset is
 *     forwarded. Anything else is silently dropped server-side.
 *  5. Fire and forget. The helpers do NOT return a Promise. We use
 *     `keepalive: true` so Vercel's serverless runtime allows the
 *     request to finish after the response is sent, and a 1 s timeout
 *     so a slow dashboard can never block a page render.
 *  6. No retries. No batching. No queue. If this becomes a bottleneck
 *     a follow-up wave will add a queue.
 */

export type AgentLogStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "waiting_approval";

/**
 * The input the wiring code passes in. Several fields are accepted but
 * deliberately NOT transmitted (see PII allow-list inside `send`):
 *   - userId         → dropped
 *   - metadata       → dropped
 *   - startedAt      → dropped (server stamps its own timestamp)
 *   - finishedAt     → dropped
 *   - durationMs     → folded into the human-readable message
 */
export interface AgentLogInput {
  /** Display name of the agent, e.g. "Lifecycle Orchestrator". */
  agentName: string;
  /** Opaque grouping id. Pass the same value to correlate run.start →
   * run.finish on the dashboard. Free-form; clamped to 64 chars. */
  runId?: string;
  /** Short verb describing the step ("transition", "rpc.start"). */
  stepName?: string;
  status: AgentLogStatus;
  /** Short human-readable summary; clamped to 280 chars. */
  message?: string;
  /** Opaque quote id (uuid). NEVER an email or customer name. */
  quoteId?: string;
  /** Accepted for caller convenience but NOT transmitted. */
  userId?: string;
  /** Accepted for caller convenience but NOT transmitted. */
  metadata?: Record<string, unknown>;
  /** Accepted but not transmitted. */
  startedAt?: number;
  /** Accepted but not transmitted. */
  finishedAt?: number;
  /** Folded into the message if present, e.g. "ok · 240ms". */
  durationMs?: number;
}

const PROJECT_SLUG = "tradies2quote";
const ENDPOINT_PATH = "/api/ingest/agent-event";
const HEADER_NAME = "x-agent-dashboard-secret";
const REQUEST_TIMEOUT_MS = 1000;

const SHORT_MSG_MAX = 280;
const ERROR_MSG_MAX = 500;
const AGENT_NAME_MAX = 80;
const ACTION_TYPE_MAX = 40;
const QUOTE_ID_MAX = 80;
const RUN_ID_MAX = 64;

/* ----------------------------------------------------------------------
 * Internals
 * -------------------------------------------------------------------- */

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function formatDuration(ms: number): string {
  if (ms < 0) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function envOk(): { url: string; secret: string } | null {
  const url = process.env.AGENT_DASHBOARD_URL;
  const secret = process.env.AGENT_DASHBOARD_SECRET;
  if (!url || !secret || secret.length < 16) return null;
  return { url: url.replace(/\/+$/, ""), secret };
}

/**
 * The wire body. Mirrors the dashboard's IngestEventInput allow-list —
 * if the field isn't here, it won't reach the dashboard.
 */
interface IngestBody {
  project: string;
  type: "event" | "error" | "run.start" | "run.finish";
  agent: string;
  status: AgentLogStatus;
  action?: string;
  run_id?: string;
  message?: string;
  quote_id?: string;
  error_message?: string;
  approval_required?: boolean;
}

/**
 * The actual transmit. Always fire-and-forget — no awaitable return.
 * Synchronous errors are caught and turned into console.warn so the
 * caller can never have a try/catch around this function trip on a log
 * failure.
 */
function send(body: IngestBody): void {
  try {
    const env = envOk();
    if (!env) return;
    const url = `${env.url}${ENDPOINT_PATH}`;
    // AbortController + setTimeout (rather than AbortSignal.timeout)
    // keeps this compatible with older Node runtimes that lack the
    // static. setTimeout returns NodeJS.Timeout in node + number in
    // edge; the void return type works on both.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [HEADER_NAME]: env.secret,
      },
      body: JSON.stringify(body),
      // keepalive lets Vercel's serverless runtime continue the
      // request after the page response has been sent, which is what
      // makes fire-and-forget safe on Lambda-backed deployments.
      keepalive: true,
      signal: ctrl.signal,
    })
      .then(() => clearTimeout(t))
      .catch((err: unknown) => {
        clearTimeout(t);
        // Never throw. Operator-only telemetry; one bad log line
        // cannot be allowed to break a quote-preview render.
        console.warn(
          "[agent-monitor] dashboard log failed:",
          err instanceof Error ? err.message : String(err),
        );
      });
  } catch (err) {
    console.warn(
      "[agent-monitor] log threw synchronously:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Build the wire body from a caller's AgentLogInput. The allow-list is
 * enforced here — every field on the body has to be picked explicitly,
 * which means new fields can never accidentally leak from a future
 * callsite that adds a property.
 */
function buildBody(
  type: IngestBody["type"],
  input: AgentLogInput,
): IngestBody {
  const messageWithDuration =
    input.durationMs !== undefined
      ? input.message
        ? `${input.message} · ${formatDuration(input.durationMs)}`
        : formatDuration(input.durationMs)
      : input.message;
  return {
    project: PROJECT_SLUG,
    type,
    agent: clamp(input.agentName, AGENT_NAME_MAX) ?? "Unknown Agent",
    status: input.status,
    action: clamp(input.stepName, ACTION_TYPE_MAX),
    run_id: clamp(input.runId, RUN_ID_MAX),
    quote_id: clamp(input.quoteId, QUOTE_ID_MAX),
    message: clamp(messageWithDuration, SHORT_MSG_MAX),
  };
}

/* ----------------------------------------------------------------------
 * Public API — exactly the 4 helpers the spec asked for
 * -------------------------------------------------------------------- */

/**
 * Log a generic agent event (status check, suggestion surfaced, etc.).
 * Lands in the dashboard's `monitor_agent_events` table.
 */
export function logAgentEvent(input: AgentLogInput): void {
  send(buildBody("event", input));
}

/**
 * Log a step in a multi-step run. Functionally identical to
 * `logAgentEvent` but signals caller intent. The dashboard groups
 * events by `run_id` if you pass one through.
 */
export function logAgentStep(input: AgentLogInput): void {
  send(buildBody("event", input));
}

/**
 * Log an error. Forces status=failed and type=error so the dashboard
 * also writes a row into `monitor_agent_errors`. The full message is
 * used as the dashboard's `error_message` (clamped to 500 chars).
 */
export function logAgentError(
  input: AgentLogInput & { message: string },
): void {
  const body = buildBody("error", { ...input, status: "failed" });
  body.error_message = clamp(input.message, ERROR_MSG_MAX);
  send(body);
}

/**
 * Log "owner approval needed". Forces status=waiting_approval and
 * sets approval_required=true so the dashboard surfaces it on the
 * Owner-approval KPI.
 */
export function logAgentApprovalNeeded(input: AgentLogInput): void {
  const body = buildBody("event", { ...input, status: "waiting_approval" });
  body.approval_required = true;
  send(body);
}
