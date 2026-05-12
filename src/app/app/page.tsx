import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bug,
  Plus,
  Robot,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, quoteNumber } from "@/lib/quote-defaults";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { isOwnerEmail } from "@/lib/owner";
import { STAGE_LABELS } from "@/lib/lifecycle/stages";
import { AppHeader } from "./_components/AppHeader";
import { DashboardSkeleton } from "./_components/DashboardSkeleton";
import {
  QuotesListClient,
  type QuoteListRow,
} from "./_components/QuotesListClient";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

/**
 * /app — dashboard.
 *
 * Wave 10 — lean overview that:
 *   - Welcomes the user by name.
 *   - Shows the 5 most recent ACTIVE quotes (archived + deleted filtered
 *     out server-side).
 *   - Provides one-click access to the full management hub at
 *     `/app/quotes` for search + filter + archive + soft-delete.
 *   - Keeps the existing "New quote" and "Materials" jump buttons.
 *
 * The recent-quotes block re-uses `<QuotesListClient />` so the same row
 * affordances (status pill, archived badge, ⋯ menu) are available here
 * too, without duplicating markup. Search + filter UI is hidden on the
 * dashboard by passing `isHub={false}`.
 */
const DASHBOARD_RECENT_LIMIT = 5;

export default async function DashboardPage() {
  // Wave 17 — perf — auth runs in the page so we can paint the static
  // frame (header + welcome heading) before the dashboard's Supabase
  // queries finish. The data-driven sections (stats card, recent
  // quotes, agents card, debug footer) live in `<DashboardData />` and
  // stream in under a `<Suspense>` boundary backed by
  // `<DashboardSkeleton />`. Previously the entire page waited for two
  // queries before sending ANY HTML, which read as a blank screen on
  // first /app entry over 4G.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = user.email?.split("@")[0] ?? "tradie";
  // Owner-only Debug link + Agents card visibility. Server-rendered,
  // no client check, so neither is serialised into the client bundle
  // for non-owner accounts. Wave 13 — extended to also gate the
  // Agents card below; previously the card was visible to all tradies.
  const isOwner = isOwnerEmail(user.email);

  return (
    <div className="min-h-screen text-white">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6">
          <div className="t2q-section-label mb-3">{"// dashboard"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Welcome, <span className="text-brand">{username}.</span>
          </h1>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData userId={user.id} isOwner={isOwner} />
        </Suspense>
      </main>
    </div>
  );
}

/**
 * Wave 17 — perf — data-driven body of the dashboard.
 *
 * Split out from `DashboardPage` so a `<Suspense>` boundary above can
 * stream the welcome heading + skeleton to the browser BEFORE the two
 * quotes queries land. Once they resolve, the real markup swaps in
 * with zero layout shift (the skeleton mirrors the same card padding
 * + border widths).
 *
 * Receives `userId` instead of calling `auth.getUser()` itself — the
 * parent has already done that, and a second auth round-trip would
 * defeat the streaming win.
 */
async function DashboardData({
  userId,
  isOwner,
}: {
  userId: string;
  isOwner: boolean;
}) {
  const supabase = await createClient();
  // Wave 10.5 — pull lightweight aggregates for the dashboard stats
  // panel (no platform-wide hype numbers, just this user's own data).
  // Stats query is intentionally separate from the recent-quotes query
  // so it can scan all the user's non-deleted rows for accurate counts
  // and totals without bloating the recent-list payload.
  const [{ data: quotes }, { data: statsRows }] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, status, total_amount, currency, quote_data, created_at, archived_at",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_RECENT_LIMIT),
    supabase
      .from("quotes")
      .select("status, total_amount, currency, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  // Aggregate this user's own quote stats. Pure JS so no extra Postgres
  // RPC needed, and the query already RLS-scopes by user_id.
  // Wave 13 — extended to count every lifecycle stage so the dashboard
  // tiles surface the orchestrator's view of the pipeline.
  const stats = computeLifecycleStats(statsRows ?? []);

  const recent: QuoteListRow[] = (quotes ?? []).map((q) => {
    const qd = q.quote_data as QuoteData | null;
    const jobSummary =
      (qd?.job_summary as string | undefined) ??
      (qd?.line_items?.[0]?.description as string | undefined) ??
      "";
    return {
      id: q.id,
      status: (q.status ?? "draft") as QuoteStatus,
      total: Number(q.total_amount) || 0,
      currency: (q.currency as string) ?? "NZD",
      clientName: qd?.client?.name ?? "—",
      jobSummary,
      number: quoteNumber(q.id, q.created_at),
      created_at: q.created_at,
      archived_at: q.archived_at,
    };
  });

  const statsCurrency = stats.currency;

  return (
    <>
      {/* Wave 13 — lifecycle stage tiles. Each tile is a real DB
          count for this user, keyed by the same quote_status enum
          the orchestrator drives. Tiles link into /app/quotes with
          a stage filter pre-applied so the owner can drill in. The
          secondary KPI row (Quotes this month + Total quoted) keeps
          the Wave 10.5 honest-numbers idea alive without taking up
          screen-space the lifecycle tiles need. */}
      <section
        data-testid="dashboard-stats"
        aria-label="Pipeline by lifecycle stage"
        className="t2q-premium-card-static mb-6 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
            {"// pipeline"}
          </p>
        </div>
        {stats.totalQuotes === 0 ? (
          /* Empty pipeline used to render a grid of zero-count tiles
             plus a "$0.00 Total quoted" KPI — which reads as fake
             placeholder data on a fresh account. Replaced with a
             single quiet line so the dashboard introduces the
             pipeline concept without faking activity. */
          <p
            data-testid="dashboard-pipeline-empty"
            className="mt-3 text-sm leading-relaxed text-ink-300"
          >
            Your live pipeline appears here once your first quote moves
            through a stage. Hit{" "}
            <span className="text-white">New quote</span> below to start.
          </p>
        ) : (
          <>
            <div
              data-testid="dashboard-stage-tiles"
              // Wave 15.3 — mobile compaction. 3-col on phones (7 stages
              // fit in 3 rows instead of 4) with tighter gap. Desktop
              // grids unchanged.
              className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:grid-cols-4 sm:gap-2 lg:grid-cols-7"
            >
              {DASHBOARD_STAGES.map((s) => (
                <StageTile
                  key={s}
                  stage={s}
                  label={STAGE_LABELS[s]}
                  count={stats.byStage[s]}
                />
              ))}
            </div>

            {/* Secondary KPI strip — keeps the Wave 10.5 honest numbers
                without competing with the stage tiles. */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-700/60 pt-4">
              <SecondaryStat
                label="Quotes this month"
                value={stats.thisMonth.toLocaleString()}
              />
              <SecondaryStat
                label="Total quoted"
                value={formatCurrency(stats.totalAmount, statsCurrency)}
                tone="brand"
              />
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          data-testid="dashboard-recent-label"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500"
        >
          {`// ${recent.length} recent quote${recent.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex gap-2">
          <Link href="/app/materials" className="t2q-btn-ghost">
            Materials
          </Link>
          <Link
            href="/app/quotes/new"
            data-testid="dashboard-new-quote"
            className="t2q-btn-primary"
          >
            <Plus size={18} weight="bold" />
            New quote
          </Link>
        </div>
      </div>

      {/* Wave 13 — Agents card is now owner-only. Was visible to
          every tradie in Wave 10.4; now hidden from non-owners so
          the hub doesn't show pre-launch automation features. The
          link is server-rendered behind `isOwner`, so it isn't even
          present in the HTML payload for non-owner accounts. */}
      {isOwner ? (
        <Link
          href="/app/agents"
          data-testid="dashboard-agents-card"
          className="t2q-premium-card mt-6 flex items-center gap-4 p-4 sm:p-5"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand"
          >
            <Robot size={22} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              AI Agents.
            </p>
            {/* Wave 14 — honest subtitle. Previously claimed
                "automations" we don't run; every agent is owner-
                approval-only and synchronous. The directory page is
                owner-only; the tools themselves render on the
                per-quote preview for every tradie. */}
            <p className="mt-0.5 text-sm text-ink-300">
              Directory of agents — quote review, compliance, voice cleanup, follow-up, admin, invoice draft.
            </p>
          </div>
          <span className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-brand sm:inline-flex">
            Open agents
            <ArrowRight size={12} weight="bold" />
          </span>
          <ArrowRight
            size={18}
            weight="bold"
            className="shrink-0 text-brand sm:hidden"
            aria-hidden="true"
          />
        </Link>
      ) : null}

      <section className="mt-6">
        {recent.length === 0 ? (
          <div
            data-testid="dashboard-empty"
            className="t2q-premium-card-static flex flex-col items-center gap-3 p-10 text-center"
          >
            <p className="font-display text-lg uppercase tracking-tight text-white">
              No quotes yet.
            </p>
            <p className="max-w-sm text-sm text-ink-300">
              Your first quote takes about 60 seconds — talk through the job
              and we&apos;ll turn it into a branded PDF.
            </p>
            <Link
              href="/app/quotes/new"
              data-testid="dashboard-empty-cta"
              className="t2q-btn-primary mt-2"
            >
              <Plus size={18} weight="bold" />
              Start your first quote
            </Link>
          </div>
        ) : (
          <QuotesListClient rows={recent} />
        )}
      </section>

      {recent.length > 0 ? (
        <div className="mt-5 flex justify-end">
          <Link
            href="/app/quotes"
            data-testid="dashboard-all-quotes"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-brand"
          >
            All quotes
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      ) : null}

      {/* Wave 14.5 — mobile tail-nav (Clients/Settings/Debug links)
          removed. The avatar tile + account sheet in
          <MobileBottomNav /> is the single home for these on mobile.
          Desktop still has Settings (cog icon) in the AppHeader, so
          Debug stays here as a small owner-only desktop footer. */}
      {isOwner ? (
        <p
          data-testid="dashboard-debug-footer"
          className="mt-10 hidden text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400 sm:block"
        >
          <Link
            href="/app/debug"
            className="inline-flex items-center gap-1.5 hover:text-brand"
          >
            <Bug size={12} weight="bold" />
            Owner debug
          </Link>
        </p>
      ) : null}
    </>
  );
}

/**
 * Wave 13 — lifecycle-aware dashboard aggregates.
 *
 * Counts every non-deleted quote owned by the caller, bucketed by
 * status. The set of stages shown on the dashboard is `DASHBOARD_STAGES`
 * below — kept short so the tile row fits on a phone. Declined/expired
 * still get counted in `byStage` so /app/quotes filters can use the
 * same shape, but they don't appear as primary tiles.
 */
const DASHBOARD_STAGES: readonly QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
];

interface LifecycleStats {
  totalQuotes: number;
  thisMonth: number;
  totalAmount: number;
  currency: string;
  byStage: Record<QuoteStatus, number>;
}

function computeLifecycleStats(
  rows: Array<{
    status: QuoteStatus | null;
    total_amount: number | string | null;
    currency: string | null;
    created_at: string;
  }>,
): LifecycleStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let thisMonth = 0;
  let totalAmount = 0;
  let currency = "NZD";
  const byStage: Record<QuoteStatus, number> = {
    draft: 0,
    sent: 0,
    viewed: 0,
    accepted: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    declined: 0,
    expired: 0,
  };
  for (const row of rows) {
    const total = Number(row.total_amount) || 0;
    totalAmount += total;
    if (row.currency) currency = row.currency;
    const stage = (row.status ?? "draft") as QuoteStatus;
    if (stage in byStage) byStage[stage] += 1;
    const created = Date.parse(row.created_at);
    if (!Number.isNaN(created) && created >= monthStart) thisMonth += 1;
  }
  return {
    totalQuotes: rows.length,
    thisMonth,
    totalAmount: Math.round(totalAmount * 100) / 100,
    currency,
    byStage,
  };
}

/**
 * One lifecycle stage tile. Acts as a `Link` into the quotes hub with
 * a `?stage=` filter pre-applied, so clicking "Sent · 3" lands on the
 * filtered list view.
 */
function StageTile({
  stage,
  label,
  count,
}: {
  stage: QuoteStatus;
  label: string;
  count: number;
}) {
  const active = count > 0;
  return (
    <Link
      href={`/app/quotes?stage=${stage}`}
      data-testid={`stage-tile-${stage}`}
      data-count={count}
      // Wave 15.3 — mobile compaction. Tighter padding + smaller
      // count font on phones; desktop visuals unchanged via sm:
      // overrides.
      className={`group flex flex-col gap-0.5 rounded-sm border px-2.5 py-2 transition-colors sm:gap-1 sm:px-3 sm:py-3 ${
        active
          ? "border-ink-700/60 bg-ink-900/40 hover:border-brand/60 hover:bg-brand/5"
          : "border-ink-800 bg-ink-900/20 text-ink-500 hover:border-ink-600"
      }`}
    >
      <p
        className={`font-display tabular-nums leading-none ${active ? "text-white group-hover:text-brand" : "text-ink-500"} text-base sm:text-2xl`}
      >
        {count}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300 sm:text-[10px] sm:tracking-[0.2em]">
        {label}
      </p>
    </Link>
  );
}

/** Secondary KPI strip (Quotes-this-month + Total-quoted). */
function SecondaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "brand";
}) {
  return (
    <div
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-3 py-3"
    >
      <p
        className={`font-display tabular-nums leading-none ${tone === "brand" ? "text-brand" : "text-white"} text-lg sm:text-xl`}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
    </div>
  );
}
