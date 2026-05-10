import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatIssueDate,
  quoteNumber,
} from "@/lib/quote-defaults";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { AppHeader } from "./_components/AppHeader";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "border-ink-600 bg-ink-800 text-ink-300",
  sent: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  viewed: "border-hivis/40 bg-hivis/10 text-hivis",
  accepted: "border-brand/40 bg-brand/10 text-brand",
  declined: "border-red-500/40 bg-red-500/10 text-red-300",
  expired: "border-ink-600 bg-ink-800 text-ink-400",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, status, total_amount, currency, quote_data, created_at, sent_at, accepted_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const recent = (quotes ?? []).map((q) => {
    const qd = q.quote_data as QuoteData | null;
    return {
      id: q.id,
      status: (q.status ?? "draft") as QuoteStatus,
      total: Number(q.total_amount) || 0,
      currency: (q.currency as string) ?? "NZD",
      clientName: qd?.client?.name ?? "—",
      number: quoteNumber(q.id, q.created_at),
      created_at: q.created_at,
    };
  });

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6">
          <div className="t2q-section-label mb-3">{"// dashboard"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Welcome, <span className="text-brand">{user.email?.split("@")[0]}.</span>
          </h1>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
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
            <p
              data-testid="dashboard-empty"
              className="rounded-sm border border-dashed border-ink-700 bg-ink-800 p-8 text-center font-mono text-xs uppercase tracking-[0.2em] text-ink-400"
            >
              {"// no quotes yet — start with new quote"}
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((q) => (
                <li
                  key={q.id}
                  data-testid={`dashboard-quote-${q.id}`}
                  className="rounded-sm border border-ink-700 bg-ink-800 p-3 hover:border-brand"
                >
                  <Link
                    href={`/app/quotes/preview/${q.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
                          {q.number}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${STATUS_STYLES[q.status]}`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-display text-sm uppercase tracking-tight text-white">
                        {q.clientName}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                        {formatIssueDate(q.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg tabular-nums text-brand">
                        {formatCurrency(q.total, q.currency)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
