import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { quoteNumber } from "@/lib/quote-defaults";
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

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, status, total_amount, currency, quote_data, created_at, archived_at",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(DASHBOARD_RECENT_LIMIT);

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
      </main>
    </div>
  );
}
