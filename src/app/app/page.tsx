import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  GearSix,
  Plus,
  Robot,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, quoteNumber } from "@/lib/quote-defaults";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { AppHeader } from "./_components/AppHeader";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_RECENT_LIMIT),
    supabase
      .from("quotes")
      .select("status, total_amount, currency, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null),
  ]);

  // Aggregate this user's own quote stats. Pure JS so no extra Postgres
  // RPC needed, and the query already RLS-scopes by user_id.
  const stats = computeUserStats(statsRows ?? []);

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

  const username = user.email?.split("@")[0] ?? "tradie";
  const statsCurrency = stats.currency;

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

        {/* Wave 10.5 — honest stats from the user's own quotes. No
            platform-wide hype numbers. Empty state appears when the
            user hasn't sent a quote yet. */}
        <section
          data-testid="dashboard-stats"
          aria-label="Your quote stats"
          className="t2q-premium-card-static mb-6 p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
              {"// your numbers"}
            </p>
            {stats.totalQuotes === 0 ? (
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400 sm:inline">
                Live numbers appear after your first quote.
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Quotes this month"
              value={stats.thisMonth.toLocaleString()}
            />
            <StatTile
              label="Accepted"
              value={stats.accepted.toLocaleString()}
              tone="brand"
            />
            <StatTile label="Drafts" value={stats.drafts.toLocaleString()} />
            <StatTile
              label="Total quoted"
              value={formatCurrency(stats.totalAmount, statsCurrency)}
              tone="brand"
            />
          </div>
          {stats.totalQuotes === 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-300 sm:hidden">
              Your live job numbers will appear here after your first quote.
            </p>
          ) : null}
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

        {/* Wave 10.4 — small Agents card. Bridges the dashboard to the
            new /app/agents hub without taking over the page. */}
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
            <p className="mt-0.5 text-sm text-ink-300">
              Set up quote, materials, follow-up, and admin automations.
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

        {/* Mobile tail nav — Clients + Settings were dropped from the
            bottom nav in Wave 10.4 to make room for Agents. These small
            links keep both reachable from the dashboard. Hidden on
            desktop because the AppHeader carries them. */}
        <nav
          data-testid="dashboard-tail-links"
          aria-label="Secondary"
          className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-ink-700/60 pt-6 sm:hidden"
        >
          <Link
            href="/app/clients"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-brand"
          >
            <UsersThree size={14} weight="bold" />
            Clients
          </Link>
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-brand"
          >
            <GearSix size={14} weight="bold" />
            Settings
          </Link>
        </nav>
      </main>
    </div>
  );
}

/** Lightweight aggregates over the user's own non-deleted quotes. */
interface UserStats {
  totalQuotes: number;
  thisMonth: number;
  accepted: number;
  drafts: number;
  totalAmount: number;
  currency: string;
}

function computeUserStats(
  rows: Array<{
    status: QuoteStatus | null;
    total_amount: number | string | null;
    currency: string | null;
    created_at: string;
  }>,
): UserStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let thisMonth = 0;
  let accepted = 0;
  let drafts = 0;
  let totalAmount = 0;
  let currency = "NZD";
  for (const row of rows) {
    const total = Number(row.total_amount) || 0;
    totalAmount += total;
    if (row.currency) currency = row.currency;
    if (row.status === "accepted") accepted += 1;
    if (row.status === "draft") drafts += 1;
    const created = Date.parse(row.created_at);
    if (!Number.isNaN(created) && created >= monthStart) thisMonth += 1;
  }
  return {
    totalQuotes: rows.length,
    thisMonth,
    accepted,
    drafts,
    totalAmount: Math.round(totalAmount * 100) / 100,
    currency,
  };
}

/** One stat tile inside the "Your numbers" panel. */
function StatTile({
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
        className={`font-display tabular-nums leading-none ${tone === "brand" ? "text-brand" : "text-white"} text-xl sm:text-2xl`}
      >
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
    </div>
  );
}
