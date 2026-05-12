"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  X,
  CheckCircle,
  Warning,
  Wrench,
} from "@phosphor-icons/react";
import { CopyButton } from "./CopyButton";
import { runVariationAgent } from "@/lib/agents/variation";
import type { QuoteData } from "@/lib/quote-types";

/**
 * Variation Agent — generate a variation draft from a base quote.
 *
 * Pure client component (no API call needed). Uses
 * `runVariationAgent` directly. Builds an approval-ready text the
 * tradie can copy and send. NEVER mutates the original quote.
 *
 * Stand-alone mode (current): user types base totals + lines.
 * Quote-bound mode (future): pre-fill from a selected accepted quote.
 */
type LineRow = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
};

function newRow(): LineRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    description: "",
    quantity: "1",
    unit: "ea",
    unit_price: "0",
  };
}

export function VariationAgent() {
  const [clientName, setClientName] = useState("");
  const [baseTotal, setBaseTotal] = useState("0");
  const [currency, setCurrency] = useState("NZD");
  const [taxRatePct, setTaxRatePct] = useState("15");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<LineRow[]>([newRow()]);

  const draft = useMemo(() => {
    const baseQuote: QuoteData = {
      client: clientName ? { name: clientName } : undefined,
      currency,
      tax_rate: Number(taxRatePct) || 0,
      total: Number(baseTotal) || 0,
      line_items: [],
    } as unknown as QuoteData;
    return runVariationAgent({
      baseQuote,
      reason,
      lines: rows.map((r) => ({
        description: r.description,
        quantity: Number(r.quantity) || 0,
        unit: r.unit || null,
        unit_price: Number(r.unit_price) || 0,
      })),
      taxRatePct: Number(taxRatePct) || 0,
    });
  }, [clientName, baseTotal, currency, taxRatePct, reason, rows]);

  function updateRow(id: string, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  return (
    <section
      data-testid="variation-agent"
      className="t2q-premium-card-static p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
          <Wrench size={20} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Variation Agent
          </h2>
          <p className="mt-1 text-sm text-ink-300">
            Build a variation draft for scope changes mid-job. Calculates the
            added cost, GST, and new total without touching the original
            quote. Copy the approval text to your client.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Client name (optional)
          </span>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Sarah at 42 Te Aroha St"
            data-testid="variation-client"
            className="mt-1 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-brand focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Original quote total
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={baseTotal}
            onChange={(e) => setBaseTotal(e.target.value)}
            data-testid="variation-base-total"
            className="mt-1 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Currency
          </span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          >
            <option>NZD</option>
            <option>AUD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>CAD</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Tax / GST rate (%)
          </span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={taxRatePct}
            onChange={(e) => setTaxRatePct(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
          Reason for the variation
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Client requested an extra power point in the kitchen + repositioning the existing pendant — discovered mid-rough-in."
          data-testid="variation-reason"
          className="mt-1 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-brand focus:outline-none"
        />
      </label>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            New work
          </span>
          <button
            type="button"
            onClick={addRow}
            data-testid="variation-add-line"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-brand hover:text-hivis"
          >
            <Plus size={12} weight="bold" />
            Add line
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 gap-2 rounded-sm border border-ink-700 bg-ink-900/40 p-2"
            >
              <input
                type="text"
                value={r.description}
                placeholder="Description"
                onChange={(e) => updateRow(r.id, { description: e.target.value })}
                className="col-span-12 rounded-sm bg-ink-900 px-2 py-1 text-sm text-white placeholder:text-ink-500 focus:outline-none sm:col-span-5"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={r.quantity}
                placeholder="Qty"
                onChange={(e) => updateRow(r.id, { quantity: e.target.value })}
                className="col-span-3 rounded-sm bg-ink-900 px-2 py-1 text-sm text-white focus:outline-none sm:col-span-2"
              />
              <input
                type="text"
                value={r.unit}
                placeholder="Unit"
                onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                className="col-span-3 rounded-sm bg-ink-900 px-2 py-1 text-sm text-white focus:outline-none sm:col-span-2"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={r.unit_price}
                placeholder="Unit price"
                onChange={(e) => updateRow(r.id, { unit_price: e.target.value })}
                className="col-span-4 rounded-sm bg-ink-900 px-2 py-1 text-sm text-white focus:outline-none sm:col-span-2"
              />
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                aria-label="Remove line"
                disabled={rows.length <= 1}
                className="col-span-2 inline-flex items-center justify-center text-ink-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {draft.blockers.length > 0 ? (
        <div
          role="alert"
          data-testid="variation-blockers"
          className="mt-5 rounded-sm border border-hivis/40 bg-hivis/5 px-3 py-2 text-sm text-ink-200"
        >
          <Warning
            size={12}
            weight="bold"
            className="mr-1 inline-block text-hivis"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
            Finish the draft
          </span>
          <ul className="mt-1 list-inside list-disc text-xs text-ink-300">
            {draft.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Variation subtotal" value={draft.variationSubtotal} currency={draft.currency} />
            <SummaryStat label={`Tax (${draft.taxRatePct}%)`} value={draft.variationTax} currency={draft.currency} />
            <SummaryStat label="Variation total" value={draft.variationTotal} currency={draft.currency} tone="brand" />
            <SummaryStat label="New quote total" value={draft.newTotal} currency={draft.currency} />
          </div>

          <div className="rounded-sm border border-ink-600 bg-ink-900/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                <CheckCircle size={12} weight="bold" className="text-brand" />
                Approval text (copy &amp; send)
              </span>
              <CopyButton
                text={draft.approvalText}
                testId="variation-copy"
                label="Copy approval text"
              />
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-100">
              {draft.approvalText}
            </pre>
          </div>

          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-500">
            {"// original quote total unchanged · awaits client approval · no DB write"}
          </p>
        </div>
      )}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  currency,
  tone = "neutral",
}: {
  label: string;
  value: number;
  currency: string;
  tone?: "neutral" | "brand";
}) {
  const formatted = (() => {
    try {
      return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  })();
  return (
    <div className="rounded-sm border border-ink-700 bg-ink-900/40 px-3 py-3">
      <p
        className={`font-display tabular-nums leading-none ${tone === "brand" ? "text-brand" : "text-white"} text-base sm:text-lg`}
      >
        {formatted}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
    </div>
  );
}
