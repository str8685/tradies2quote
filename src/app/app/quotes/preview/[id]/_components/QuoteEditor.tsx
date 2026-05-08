"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  FloppyDisk,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import {
  formatCurrency,
  formatIssueDate,
  quoteNumber,
  round2,
  validUntilDate,
} from "@/lib/quote-defaults";
import type {
  LibraryMaterial,
  QuoteData,
  QuoteItemType,
  QuoteLineItem,
} from "@/lib/quote-types";
import { saveQuoteChanges } from "../actions";

type Props = {
  quoteId: string;
  createdAt: string;
  initialData: QuoteData;
  library: LibraryMaterial[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function QuoteEditor({ quoteId, createdAt, initialData, library }: Props) {
  const [client, setClient] = useState(initialData.client);
  const [items, setItems] = useState<QuoteLineItem[]>(initialData.line_items);
  const libraryById = useMemo(
    () => new Map(library.map((m) => [m.id, m])),
    [library],
  );
  const [terms, setTerms] = useState(initialData.terms);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const markupPct = initialData.markup_pct;
  const taxRate = initialData.tax_rate;
  const taxLabel = initialData.tax_label;
  const currency = initialData.currency;

  const totals = useMemo(() => {
    let materials_subtotal = 0;
    let labour_subtotal = 0;
    for (const it of items) {
      const lt = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      if (it.type === "labour") labour_subtotal += lt;
      else materials_subtotal += lt;
    }
    const markup_amount = materials_subtotal * (markupPct / 100);
    const subtotal_before_tax =
      materials_subtotal + markup_amount + labour_subtotal;
    const tax_amount = subtotal_before_tax * (taxRate / 100);
    const total = subtotal_before_tax + tax_amount;
    return {
      materials_subtotal: round2(materials_subtotal),
      labour_subtotal: round2(labour_subtotal),
      markup_amount: round2(markup_amount),
      subtotal_before_tax: round2(subtotal_before_tax),
      tax_amount: round2(tax_amount),
      total: round2(total),
    };
  }, [items, markupPct, taxRate]);

  function updateItem(idx: number, patch: Partial<QuoteLineItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.line_total = round2(
          (Number(next.quantity) || 0) * (Number(next.unit_price) || 0),
        );
        return next;
      }),
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem(type: QuoteItemType) {
    const blank: QuoteLineItem = {
      type,
      description: "",
      quantity: type === "labour" ? 1 : 1,
      unit: type === "labour" ? "hour" : "each",
      unit_price: 0,
      line_total: 0,
    };
    setItems((prev) => [...prev, blank]);
  }

  function handleSave() {
    setStatus("saving");
    setErrorMessage("");
    const next: QuoteData = {
      ...initialData,
      client,
      line_items: items,
      terms,
      ...totals,
      markup_pct: markupPct,
      tax_rate: taxRate,
      tax_label: taxLabel,
      currency,
    };
    startTransition(async () => {
      const result = await saveQuoteChanges(quoteId, next);
      if ("error" in result) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  const materialIndices = items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.type === "material");
  const labourIndices = items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.type === "labour");
  const otherIndices = items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.type === "other");

  const issueDate = formatIssueDate(createdAt);
  const validUntil = formatIssueDate(validUntilDate(createdAt, 30));
  const number = quoteNumber(quoteId, createdAt);
  const clientPlaceholder =
    client.name.trim().toLowerCase() === "to be confirmed";

  return (
    <div className="space-y-6">
      <section className="t2q-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
              Client
            </div>
            <input
              data-testid="quote-client-name"
              value={client.name}
              onChange={(e) =>
                setClient((c) => ({ ...c, name: e.target.value }))
              }
              placeholder="Client name"
              className={[
                "mt-2 block w-full rounded-sm border bg-ink-900 px-3 py-2 font-display text-xl uppercase tracking-tight outline-none focus:border-brand",
                clientPlaceholder ? "border-hivis text-hivis" : "border-ink-600 text-white",
              ].join(" ")}
            />
            <textarea
              data-testid="quote-client-address"
              value={client.address ?? ""}
              onChange={(e) =>
                setClient((c) => ({ ...c, address: e.target.value || null }))
              }
              rows={2}
              placeholder="Site address"
              className="mt-2 block w-full resize-none rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand"
            />
            {client.contact && (
              <p className="mt-2 text-xs text-ink-400">{client.contact}</p>
            )}
            {clientPlaceholder && (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-hivis">
                {"// add the client name before sending"}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs sm:grid-cols-1 sm:text-right">
            <Meta label="Quote #" value={number} />
            <Meta label="Issued" value={issueDate} />
            <Meta label="Valid until" value={validUntil} />
            <Meta label="Currency" value={currency} />
          </div>
        </div>
        {initialData.job_summary && (
          <p className="mt-4 border-t border-ink-700 pt-4 text-sm text-ink-300">
            {initialData.job_summary}
          </p>
        )}
      </section>

      {initialData.notes && initialData.notes.length > 0 && (
        <section
          data-testid="quote-notes"
          className="rounded-sm border border-hivis/40 bg-hivis/10 p-5"
        >
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-hivis">
            {"// review these"}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-200">
            {initialData.notes.map((note, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-hivis">
                  →
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ItemsSection
        title="Materials"
        accent="brand"
        rows={materialIndices}
        currency={currency}
        libraryById={libraryById}
        showBadges
        onUpdate={updateItem}
        onRemove={removeItem}
        onAdd={() => addItem("material")}
        addLabel="Add material"
      />

      <ItemsSection
        title="Labour"
        accent="ink"
        rows={labourIndices}
        currency={currency}
        libraryById={libraryById}
        showBadges={false}
        onUpdate={updateItem}
        onRemove={removeItem}
        onAdd={() => addItem("labour")}
        addLabel="Add labour"
      />

      {otherIndices.length > 0 && (
        <ItemsSection
          title="Other"
          accent="ink"
          rows={otherIndices}
          currency={currency}
          libraryById={libraryById}
          showBadges={false}
          onUpdate={updateItem}
          onRemove={removeItem}
          onAdd={() => addItem("other")}
          addLabel="Add line"
        />
      )}

      <section data-testid="quote-totals" className="t2q-card p-5 sm:p-6">
        <TotalsRow
          label="Materials subtotal"
          value={formatCurrency(totals.materials_subtotal, currency)}
        />
        <TotalsRow
          label={`Markup (${markupPct}%)`}
          value={formatCurrency(totals.markup_amount, currency)}
        />
        <TotalsRow
          label="Labour subtotal"
          value={formatCurrency(totals.labour_subtotal, currency)}
        />
        <TotalsRow
          label="Subtotal"
          value={formatCurrency(totals.subtotal_before_tax, currency)}
          divider
        />
        <TotalsRow
          label={`${taxLabel} (${taxRate}%)`}
          value={formatCurrency(totals.tax_amount, currency)}
        />
        <TotalsRow
          label="Total"
          value={formatCurrency(totals.total, currency)}
          emphasis
          testId="quote-total"
        />
      </section>

      <section className="t2q-card p-5 sm:p-6">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
          Terms
        </div>
        <textarea
          data-testid="quote-terms"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={6}
          className="mt-3 block w-full resize-y rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-200 outline-none focus:border-brand"
        />
      </section>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          data-testid="save-status"
          aria-live="polite"
          className="font-mono text-xs uppercase tracking-[0.2em]"
        >
          {status === "saving" && <span className="text-ink-400">Saving…</span>}
          {status === "saved" && <span className="text-brand">{"// saved"}</span>}
          {status === "error" && (
            <span className="text-red-400">{errorMessage || "Save failed"}</span>
          )}
          {status === "idle" && (
            <span className="text-ink-500">{"// edits are not saved until you click save"}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="save-changes"
            onClick={handleSave}
            disabled={isPending}
            className="t2q-btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FloppyDisk size={18} weight="bold" />
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            data-testid="next-step"
            disabled
            title="Send to client lands in Stage 3."
            className="t2q-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Looks good
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </div>
      <div className="font-display text-sm uppercase tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function ItemsSection({
  title,
  accent,
  rows,
  currency,
  libraryById,
  showBadges,
  onUpdate,
  onRemove,
  onAdd,
  addLabel,
}: {
  title: string;
  accent: "brand" | "ink";
  rows: Array<{ it: QuoteLineItem; i: number }>;
  currency: string;
  libraryById: Map<string, LibraryMaterial>;
  showBadges: boolean;
  onUpdate: (idx: number, patch: Partial<QuoteLineItem>) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <section
      data-testid={`section-${title.toLowerCase()}`}
      className="t2q-card p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg uppercase tracking-tight">
          <span className={accent === "brand" ? "text-brand" : "text-white"}>
            {title}
          </span>
        </h3>
        <button
          type="button"
          data-testid={`add-${title.toLowerCase()}`}
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
        >
          <Plus size={14} weight="bold" />
          {addLabel}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
          {"// no items — add one above"}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(({ it, i }) => {
            const libMaterial = it.library_id
              ? libraryById.get(it.library_id)
              : undefined;
            return (
            <li
              key={i}
              data-testid={`row-${i}`}
              className="rounded-sm border border-ink-700 bg-ink-900 p-3"
            >
              {showBadges && (
                <ItemBadge
                  isLibrary={!!libMaterial}
                  isAi={!!it.is_ai_estimated && !libMaterial}
                  supplierUrl={libMaterial?.supplier_url ?? null}
                  supplierName={libMaterial?.supplier ?? null}
                />
              )}
              <div className="flex items-start gap-2">
                <input
                  value={it.description}
                  onChange={(e) =>
                    onUpdate(i, { description: e.target.value })
                  }
                  placeholder="Description"
                  className="flex-1 rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand"
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => onRemove(i)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-ink-700 text-ink-400 hover:border-red-500 hover:text-red-400"
                >
                  <Trash size={16} weight="bold" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumberField
                  label="Qty"
                  value={it.quantity}
                  onChange={(v) => onUpdate(i, { quantity: v })}
                />
                <TextField
                  label="Unit"
                  value={it.unit}
                  onChange={(v) => onUpdate(i, { unit: v })}
                />
                <NumberField
                  label="Unit price"
                  value={it.unit_price}
                  onChange={(v) => onUpdate(i, { unit_price: v })}
                />
              </div>
              <div className="mt-2 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-300">
                Line total: <span className="text-white">{formatCurrency(it.line_total, currency)}</span>
              </div>
            </li>
          );
          })}
        </ul>
      )}
    </section>
  );
}

function ItemBadge({
  isLibrary,
  isAi,
  supplierUrl,
  supplierName,
}: {
  isLibrary: boolean;
  isAi: boolean;
  supplierUrl: string | null;
  supplierName: string | null;
}) {
  if (!isLibrary && !isAi) return null;
  return (
    <div className="mb-2 flex items-center gap-2">
      {isLibrary && (
        <span
          data-testid="badge-library"
          className="inline-flex items-center gap-1 rounded-sm bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-brand"
        >
          From your library
        </span>
      )}
      {isAi && (
        <span
          data-testid="badge-ai"
          className="inline-flex items-center gap-1 rounded-sm bg-hivis/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis"
          title="Price came from an AI estimate — confirm before sending"
        >
          <Sparkle size={10} weight="bold" />
          AI estimate
        </span>
      )}
      {isLibrary && supplierUrl && (
        <a
          href={supplierUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="supplier-link"
          aria-label={
            supplierName
              ? `Open ${supplierName} product page`
              : "Open supplier page"
          }
          className="inline-flex items-center gap-1 rounded-sm border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400 hover:border-brand hover:text-brand"
          title={supplierName ?? "Supplier"}
        >
          <ArrowSquareOut size={10} weight="bold" />
          {supplierName ?? "Supplier"}
        </a>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className="mt-1 block w-full rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm tabular-nums text-white outline-none focus:border-brand"
      />
    </label>
  );
}

function TotalsRow({
  label,
  value,
  divider,
  emphasis,
  testId,
}: {
  label: string;
  value: string;
  divider?: boolean;
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={[
        "flex items-baseline justify-between py-1.5",
        divider ? "mt-2 border-t border-ink-700 pt-3" : "",
        emphasis ? "mt-2 border-t border-ink-700 pt-3" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={
          emphasis
            ? "font-display text-base uppercase tracking-tight"
            : "font-mono text-xs uppercase tracking-[0.2em] text-ink-300"
        }
      >
        {label}
      </span>
      <span
        className={
          emphasis
            ? "font-display text-2xl tabular-nums text-brand"
            : "tabular-nums text-white"
        }
      >
        {value}
      </span>
    </div>
  );
}
