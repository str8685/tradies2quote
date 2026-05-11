"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  FileText,
  Info,
  Receipt,
  Warning,
} from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/quote-defaults";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import type { InvoiceStatus, InvoiceSummary } from "@/lib/types/invoice";
import { runInvoiceAgent } from "@/lib/agents/invoice";
import { createInvoiceFromQuote } from "../actions";

/**
 * Wave 14 — Invoice draft card.
 *
 * Two modes:
 *
 *   1. No invoice exists for this quote → renders a preview of what
 *      the draft will look like (subtotal / tax / total / 7-day due),
 *      plus a "Create draft invoice" button. The button calls the
 *      `createInvoiceFromQuote` server action, which in turn calls
 *      the `create_invoice_from_quote(uuid)` Postgres RPC — the
 *      ONLY path that ever inserts into public.invoices.
 *
 *   2. Invoice already exists → renders the invoice number, status,
 *      and total. No "create another" button (the RPC is idempotent
 *      and would just return the same id).
 *
 * Visibility: renders only when `quote.status === 'completed'`. The
 * card lives inside an anchor `id="agent-invoice"` so the
 * LifecycleCard's "Suggested agent → Invoice" button scrolls here.
 *
 * No PDF, no email, no automation in Wave 14. Wave 15 brings send /
 * mark-paid / overdue cron.
 */
interface Props {
  quoteId: string;
  status: QuoteStatus;
  quoteData: QuoteData | null;
  existingInvoice: InvoiceSummary | null;
}

export function InvoiceDraftCard({
  quoteId,
  status,
  quoteData,
  existingInvoice,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "completed") return null;

  const preview = runInvoiceAgent(status, quoteData);
  const canCreate = preview.reason === "ready";

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createInvoiceFromQuote(quoteId);
      if ("error" in res) setError(res.error);
    });
  }

  return (
    <section
      id="agent-invoice"
      data-testid="invoice-draft-card"
      aria-labelledby="invoice-draft-heading"
      className="t2q-premium-card-static mt-6 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Receipt size={16} weight="bold" className="text-brand" />
        <span className="t2q-section-label">{"// invoice"}</span>
        {existingInvoice ? (
          <span
            data-testid="invoice-status-pill"
            className={`ml-auto inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${invoiceStatusPill(existingInvoice.status)}`}
          >
            {existingInvoice.status}
          </span>
        ) : null}
      </div>

      {existingInvoice ? (
        <ExistingInvoiceBody invoice={existingInvoice} />
      ) : (
        <DraftPreviewBody
          preview={preview}
          canCreate={canCreate}
          pending={pending}
          onCreate={handleCreate}
        />
      )}

      {error ? (
        <p
          data-testid="invoice-error"
          role="alert"
          className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <p className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        <Info size={12} weight="bold" />
        Drafts are stored in your records. No email or PDF is sent — that ships in Wave 15.
      </p>
    </section>
  );
}

function ExistingInvoiceBody({ invoice }: { invoice: InvoiceSummary }) {
  return (
    <>
      <h2
        id="invoice-draft-heading"
        data-testid="invoice-number"
        className="mt-3 font-display text-2xl uppercase tracking-tight text-white sm:text-3xl"
      >
        {invoice.invoice_number}
      </h2>
      <p className="mt-2 text-sm text-ink-200">
        Draft invoice created — total{" "}
        <span className="font-display text-brand">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </span>
        . Due {formatDueDate(invoice.due_date)}.
      </p>
    </>
  );
}

function DraftPreviewBody({
  preview,
  canCreate,
  pending,
  onCreate,
}: {
  preview: ReturnType<typeof runInvoiceAgent>;
  canCreate: boolean;
  pending: boolean;
  onCreate: () => void;
}) {
  return (
    <>
      <h2
        id="invoice-draft-heading"
        className="mt-3 font-display text-2xl uppercase tracking-tight text-white sm:text-3xl"
      >
        Ready to invoice.
      </h2>
      <p className="mt-2 text-sm text-ink-200">
        Generate a draft invoice from this completed quote. Nothing is
        sent — the draft lives in your records until Wave 15&apos;s send
        flow lands.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PreviewTile
          label="Subtotal"
          value={formatCurrency(preview.subtotal, preview.currency)}
        />
        <PreviewTile
          label="Tax"
          value={formatCurrency(preview.taxAmount, preview.currency)}
        />
        <PreviewTile
          label="Total"
          value={formatCurrency(preview.totalAmount, preview.currency)}
          tone="brand"
        />
        <PreviewTile label="Due" value="In 7 days" />
      </dl>

      {preview.blockers.length > 0 ? (
        <ul
          data-testid="invoice-blockers"
          className="mt-4 space-y-2 rounded-sm border border-hivis/30 bg-hivis/5 p-3"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
            {"// fix these first"}
          </p>
          {preview.blockers.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-sm text-ink-100"
            >
              <Warning
                size={14}
                weight="fill"
                className="mt-0.5 shrink-0 text-hivis"
                aria-hidden="true"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="invoice-create-button"
          onClick={onCreate}
          disabled={pending || !canCreate}
          className="t2q-btn-primary inline-flex h-11 items-center gap-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            "Creating draft…"
          ) : (
            <>
              <FileText size={16} weight="bold" />
              Create draft invoice
              <ArrowRight size={14} weight="bold" />
            </>
          )}
        </button>
      </div>
    </>
  );
}

function PreviewTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "brand";
}) {
  return (
    <div className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-3 py-3">
      <p
        className={`font-display tabular-nums leading-none text-lg sm:text-xl ${tone === "brand" ? "text-brand" : "text-white"}`}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
    </div>
  );
}

function invoiceStatusPill(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "border-ink-600 bg-ink-800 text-ink-200";
    case "sent":
      return "border-blue-500/40 bg-blue-500/10 text-blue-300";
    case "paid":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "overdue":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "cancelled":
      return "border-ink-600 bg-ink-800 text-ink-400";
  }
}

function formatDueDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "in 7 days";
  const days = Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
