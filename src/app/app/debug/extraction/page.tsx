import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import type { QuoteData } from "@/lib/quote-types";
import {
  filterExtractionQueue,
  suppliersInQueue,
  toExtractionQueueRows,
  type QueueFilter,
} from "@/lib/materials/extractionQueue";
import { computeExtractionMetrics } from "@/lib/materials/extractionMetrics";
import { AppHeader } from "../../_components/AppHeader";
import { ExtractionMetricsPanel } from "../_components/ExtractionMetricsPanel";
import { ExtractionQueueList } from "./_components/ExtractionQueueList";
import { AcknowledgeButton } from "./_components/AcknowledgeButton";

export const metadata: Metadata = { title: "Extraction review" };
export const dynamic = "force-dynamic";

type StatusFilter = NonNullable<QueueFilter["status"]>;
const STATUS_TABS: StatusFilter[] = ["open", "needs_review", "blocked", "handled"];

/**
 * Owner-only supplier-extraction review queue.
 *
 * Surfaces every supplier scan whose strict-extraction verdict was
 * needs_review / blocked so a human can correct it. Read-mostly: the only
 * mutation is "mark handled". Owner-scoped (RLS) like /app/debug. Reuses the
 * frozen extraction_status / reasons / row_failures + reconciliation
 * provenance — no re-scanning, no parser changes.
 */
export default async function ExtractionReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; supplier?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) notFound();

  const sp = await searchParams;
  const status: StatusFilter = STATUS_TABS.includes(sp.status as StatusFilter)
    ? (sp.status as StatusFilter)
    : "open";
  const supplier =
    typeof sp.supplier === "string" && sp.supplier.trim() ? sp.supplier.trim() : null;

  const { data: rows } = await supabase
    .from("quotes")
    .select("id, created_at, quote_data")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const allRows = toExtractionQueueRows(
    (rows ?? []).map((r) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      quote_data: (r.quote_data ?? null) as QuoteData | null,
    })),
  );

  const metrics = computeExtractionMetrics(
    allRows.map((r) => ({
      status: r.status,
      supplier: r.supplier,
      attempts: r.attempts,
      corrected: r.corrected,
    })),
  );

  const filtered = filterExtractionQueue(allRows, { status, supplier });
  const suppliers = suppliersInQueue(allRows);

  // Counts for the status tabs (independent of the supplier filter).
  const counts = {
    open: filterExtractionQueue(allRows, { status: "open" }).length,
    needs_review: filterExtractionQueue(allRows, { status: "needs_review" }).length,
    blocked: filterExtractionQueue(allRows, { status: "blocked" }).length,
    handled: filterExtractionQueue(allRows, { status: "handled" }).length,
  };

  const tabHref = (s: StatusFilter) =>
    `/app/debug/extraction?status=${s}${supplier ? `&supplier=${encodeURIComponent(supplier)}` : ""}`;
  const supplierHref = (sup: string | null) =>
    `/app/debug/extraction?status=${status}${sup ? `&supplier=${encodeURIComponent(sup)}` : ""}`;

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Debug" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// owner"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Extraction review.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Supplier scans the AI couldn&apos;t fully trust — needs_review or
            blocked. Fix them in the quote, then mark handled. Owner-only.
          </p>
          <Link
            href="/app/debug"
            className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-400 hover:text-brand"
          >
            ← back to debug
          </Link>
        </div>

        <div className="mb-8">
          <ExtractionMetricsPanel metrics={metrics} />
        </div>

        {/* Status tabs */}
        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_TABS.map((s) => (
            <Link
              key={s}
              href={tabHref(s)}
              data-testid={`extraction-tab-${s}`}
              data-active={s === status}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                s === status
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-ink-700 bg-ink-800 text-ink-200 hover:border-brand/50"
              }`}
            >
              {s.replace("_", " ")}
              <span className="text-ink-500">·</span>
              {counts[s]}
            </Link>
          ))}
        </div>

        {/* Supplier filter */}
        {suppliers.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
              supplier
            </span>
            <Link
              href={supplierHref(null)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                !supplier
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-ink-700 bg-ink-800 text-ink-300 hover:border-brand/50"
              }`}
            >
              all
            </Link>
            {suppliers.map((sup) => (
              <Link
                key={sup}
                href={supplierHref(sup)}
                className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                  supplier === sup
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-ink-700 bg-ink-800 text-ink-300 hover:border-brand/50"
                }`}
              >
                {sup}
              </Link>
            ))}
          </div>
        )}

        {/* Queue */}
        <section data-testid="extraction-queue" aria-label="Extraction queue">
          <ExtractionQueueList
            rows={filtered}
            status={status}
            renderAction={(quoteId) => <AcknowledgeButton quoteId={quoteId} />}
          />
        </section>

        <p className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          Owner-only. Source images aren&apos;t stored — provenance is each
          row&apos;s captured raw text.
        </p>
      </main>
    </div>
  );
}
