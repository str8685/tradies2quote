import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle,
  Clock,
  Info,
  Pause,
  Users,
  Warning,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/owner";
import { AppHeader } from "../../_components/AppHeader";
import { DiagnoseButton } from "./_components/DiagnoseButton";

export const metadata: Metadata = {
  title: "Agent monitor",
};

// The dashboard tails live data, so always fetch fresh on each visit.
export const dynamic = "force-dynamic";

/**
 * Owner-only agent monitoring dashboard.
 *
 * Reads `public.agent_runs` (last 50 by started_at desc) and
 * `public.agent_events` (last 100 by created_at desc) — both written
 * by `src/lib/agent-monitor/logger.ts` from every agent call site
 * across the app. Tables are RLS-on with no policies (service-role-
 * only), so this page uses the admin client; non-owners get a 404
 * before any DB read so the route's existence isn't advertised.
 *
 * No client-side polling — the data is dense enough that the operator
 * can just reload the page. A WebSocket / supabase-realtime channel is
 * the natural follow-up if this becomes a "watch it live" workflow.
 */
export default async function AgentMonitorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) notFound();

  const admin = adminClient();
  const [runsRes, eventsRes, usersRes] = await Promise.all([
    admin
      .from("agent_runs")
      .select(
        "run_id, agent_name, status, started_at, finished_at, duration_ms, last_step, last_message, error_message, approval_required, quote_id",
      )
      .order("started_at", { ascending: false })
      .limit(50),
    admin
      .from("agent_events")
      .select(
        "id, run_id, agent_name, event_type, status, step, message, quote_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    // `auth.admin.listUsers` pages 1000 at a time. The MVP user base
    // fits in one page for a long time; if it grows we can paginate or
    // sort here instead of fetching everything and slicing.
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const runs = runsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const runsError = runsRes.error?.message;
  const eventsError = eventsRes.error?.message;
  const usersError = usersRes.error?.message;
  // Most-recently-active first. Users who've never signed in (rare —
  // happens when invite flow stalls) sort last by created_at desc.
  const users = (usersRes.data?.users ?? [])
    .slice()
    .sort((a, b) => {
      const aT = a.last_sign_in_at ?? a.created_at ?? "";
      const bT = b.last_sign_in_at ?? b.created_at ?? "";
      return bT.localeCompare(aT);
    });

  // Quick KPIs — counts grouped by status, useful at a glance.
  const counts = runs.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Agent monitor" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// owner"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Agent monitor.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Live telemetry from every server-side agent — quote generation,
            voice cleanup, compliance, follow-up, the SMS / email senders.
            Owner-only.
          </p>
        </div>

        {/* KPI strip — top-level counts from the last 50 runs. */}
        <section
          aria-label="Agent counts"
          data-testid="monitor-kpis"
          className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          <KpiTile label="Running" value={counts.running ?? 0} tone="brand" />
          <KpiTile label="Complete" value={counts.complete ?? 0} tone="ok" />
          <KpiTile label="Failed" value={counts.failed ?? 0} tone="error" />
          <KpiTile
            label="Awaiting"
            value={counts.waiting_approval ?? 0}
            tone="hivis"
          />
          <KpiTile label="Pending" value={counts.pending ?? 0} tone="muted" />
        </section>

        {/* Runs — denormalized lifecycle table. One row per run id. */}
        <section
          aria-label="Recent runs"
          data-testid="monitor-runs"
          className="t2q-premium-card-static mb-5 p-4 sm:p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              Runs <span className="text-ink-400">({runs.length})</span>
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              last 50
            </span>
          </div>

          {runsError && (
            <p
              data-testid="monitor-runs-error"
              className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              Could not load runs: {runsError}
            </p>
          )}

          {!runsError && runs.length === 0 && (
            <p
              data-testid="monitor-runs-empty"
              className="mt-5 text-sm text-ink-300"
            >
              No agent runs recorded yet. Fire any agent (record a quote, send
              one, run a clarification) and refresh.
            </p>
          )}

          {runs.length > 0 && (
            <ul className="mt-4 space-y-2">
              {runs.map((r) => (
                <li
                  key={r.run_id}
                  data-testid={`monitor-run-${r.run_id}`}
                  data-run-status={r.status}
                  className="border-b border-ink-700/60 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 shrink-0">
                      {statusGlyph(r.status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="font-display text-sm uppercase tracking-tight text-white">
                          {r.agent_name}
                        </p>
                        {r.last_step && (
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                            · {r.last_step}
                          </p>
                        )}
                        {r.approval_required && (
                          <span className="inline-flex items-center gap-1 rounded-sm border border-hivis/40 bg-hivis/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
                            <Pause size={10} weight="bold" /> approval
                          </span>
                        )}
                      </div>
                      {r.last_message && (
                        <p className="mt-1 text-xs text-ink-200">
                          {r.last_message}
                        </p>
                      )}
                      {r.error_message && (
                        <p className="mt-1 text-xs text-red-300">
                          {r.error_message}
                        </p>
                      )}
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                        {formatRunTime(r.started_at, r.finished_at, r.duration_ms)}
                        {" · "}
                        run {r.run_id.slice(-8)}
                        {r.quote_id ? ` · quote ${r.quote_id.slice(0, 8)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${statusPill(r.status)}`}
                      >
                        {r.status}
                      </span>
                      {/* Diagnose available on anything that failed,
                          or anything still claiming to be running long
                          after it should have finished (5+ min). The
                          two cases the operator actually wants help
                          with — everything else is fine. */}
                      {(r.status === "failed" ||
                        (r.status === "running" &&
                          isStale(r.started_at, 5))) && (
                        <DiagnoseButton runId={r.run_id} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Users — who's signed up, who's logging in. Reads
            auth.users via the service-role admin API so even users
            with no public.profiles row appear. PII is intentional
            here: the dashboard is owner-only. */}
        <section
          aria-label="Recent users"
          data-testid="monitor-users"
          className="t2q-premium-card-static mb-5 p-4 sm:p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              <Users
                size={18}
                weight="bold"
                className="inline -mt-1 mr-1.5 text-brand"
              />
              Users <span className="text-ink-400">({users.length})</span>
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              sorted by last activity
            </span>
          </div>

          {usersError && (
            <p
              data-testid="monitor-users-error"
              className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              Could not load users: {usersError}
            </p>
          )}

          {!usersError && users.length === 0 && (
            <p
              data-testid="monitor-users-empty"
              className="mt-5 text-sm text-ink-300"
            >
              No users yet.
            </p>
          )}

          {users.length > 0 && (
            <ul className="mt-4 space-y-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  data-testid={`monitor-user-${u.id}`}
                  className="flex items-start gap-3 border-b border-ink-700/60 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm uppercase tracking-tight text-white">
                      {u.email ?? "—"}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                      Signed up {relativeTime(u.created_at)}
                      {u.last_sign_in_at
                        ? ` · Last seen ${relativeTime(u.last_sign_in_at)}`
                        : " · Never signed in"}
                      {u.email_confirmed_at ? "" : " · Email unconfirmed"}
                    </p>
                  </div>
                  {u.last_sign_in_at && isWithin(u.last_sign_in_at, 24 * 60) && (
                    <span className="inline-flex shrink-0 items-center rounded-sm border border-brand/40 bg-brand/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
                      active
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Events — raw append-only stream. Useful when a run misbehaves
            and you need the step-by-step. */}
        <section
          aria-label="Recent events"
          data-testid="monitor-events"
          className="t2q-premium-card-static mb-5 p-4 sm:p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              Events <span className="text-ink-400">({events.length})</span>
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              last 100
            </span>
          </div>

          {eventsError && (
            <p
              data-testid="monitor-events-error"
              className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              Could not load events: {eventsError}
            </p>
          )}

          {!eventsError && events.length === 0 && (
            <p
              data-testid="monitor-events-empty"
              className="mt-5 text-sm text-ink-300"
            >
              No events yet.
            </p>
          )}

          {events.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {events.map((e) => (
                <li
                  key={e.id}
                  data-testid={`monitor-event-${e.id}`}
                  className="flex items-start gap-3 border-b border-ink-700/40 pb-2 last:border-b-0 last:pb-0"
                >
                  <span aria-hidden="true" className="mt-0.5 shrink-0">
                    {statusGlyph(e.status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="font-display text-xs uppercase tracking-tight text-white">
                        {e.agent_name}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
                        {e.event_type}
                      </p>
                      {e.step && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                          · {e.step}
                        </p>
                      )}
                    </div>
                    {e.message && (
                      <p className="mt-0.5 text-xs text-ink-200">{e.message}</p>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                      {new Date(e.created_at).toLocaleTimeString()}
                      {e.run_id ? ` · run ${e.run_id.slice(-8)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          Owner-only. PII (user ids, customer details, metadata) is dropped
          server-side before insert — only agent name, status, run id, step,
          message and quote id reach the database.
        </p>
      </main>
    </div>
  );
}

type RunStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "waiting_approval"
  | string;

function statusGlyph(status: RunStatus) {
  if (status === "complete")
    return <CheckCircle size={18} weight="fill" className="text-brand" />;
  if (status === "failed")
    return <XCircle size={18} weight="fill" className="text-red-400" />;
  if (status === "waiting_approval")
    return <Pause size={18} weight="fill" className="text-hivis" />;
  if (status === "running")
    return <Clock size={18} weight="fill" className="text-blue-300" />;
  return <Warning size={18} weight="fill" className="text-ink-300" />;
}

function statusPill(status: RunStatus) {
  if (status === "complete") return "border-brand/40 bg-brand/10 text-brand";
  if (status === "failed") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (status === "waiting_approval")
    return "border-hivis/40 bg-hivis/10 text-hivis";
  if (status === "running")
    return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  return "border-ink-600 bg-ink-800 text-ink-300";
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "ok" | "error" | "hivis" | "muted";
}) {
  const cls = {
    brand: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    ok: "border-brand/40 bg-brand/10 text-brand",
    error: "border-red-500/40 bg-red-500/10 text-red-300",
    hivis: "border-hivis/40 bg-hivis/10 text-hivis",
    muted: "border-ink-600 bg-ink-800 text-ink-300",
  }[tone];
  return (
    <div
      className={`rounded-sm border px-3 py-2 ${cls}`}
      data-testid={`monitor-kpi-${label.toLowerCase()}`}
    >
      <p className="font-display text-xl leading-tight tracking-tight text-white">
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em]">
        {label}
      </p>
    </div>
  );
}

function formatRunTime(
  startedAt: string,
  finishedAt: string | null,
  durationMs: number | null,
): string {
  const started = new Date(startedAt);
  const startedLabel = started.toLocaleTimeString();
  // Prefer the stored duration_ms when present; fall back to a computed
  // delta between start and finish; otherwise show "in flight" for runs
  // that never wrote a finish event.
  let durLabel: string;
  if (durationMs !== null && durationMs >= 0) {
    durLabel = humanDuration(durationMs);
  } else if (finishedAt) {
    durLabel = humanDuration(
      Math.max(0, new Date(finishedAt).getTime() - started.getTime()),
    );
  } else {
    durLabel = "in flight";
  }
  return `${startedLabel} · ${durLabel}`;
}

function humanDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86_400)}d ago`;
}

function isWithin(iso: string | null | undefined, minutes: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60 * 1000;
}

function isStale(iso: string | null | undefined, minutes: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > minutes * 60 * 1000;
}
