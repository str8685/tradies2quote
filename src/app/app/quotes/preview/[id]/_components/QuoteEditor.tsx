"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowSquareOut,
  Calculator,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import {
  formatCurrency,
  formatIssueDate,
  isPlaceholderClientName,
  quoteNumber,
  round2,
  validUntilDate,
} from "@/lib/quote-defaults";
import type {
  LibraryMaterial,
  QuoteData,
  QuoteItemType,
  QuoteLineItem,
  QuoteStatus,
} from "@/lib/quote-types";
import { matchToLibrary } from "@/lib/materials";
import {
  lineConfidence,
  confidenceTally,
  type LineConfidence,
} from "@/lib/lineConfidence";
import { explainFormula } from "@/lib/explainFormula";
import type { MaterialTakeoffResult } from "@/lib/materialCalculator";
import type { PhotoPlanItem } from "@/lib/agents/photo-plan";
import { saveQuoteChanges } from "../actions";
import { TakeoffPanel } from "./TakeoffPanel";
import { PhotoPlanPanel } from "./PhotoPlanPanel";
import { SendQuoteButton } from "./SendQuoteButton";
import { MobileCollapsibleCard } from "./MobileCollapsibleCard";
import { StickyActionBar } from "./StickyActionBar";

type Props = {
  quoteId: string;
  createdAt: string;
  initialData: QuoteData;
  library: LibraryMaterial[];
  quoteStatus: QuoteStatus;
  publicToken: string | null;
  hasPdf: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function migrateLegacyContact(
  c: QuoteData["client"] | null | undefined,
): QuoteData["client"] {
  // Defend against legacy / partial rows where `client` is missing —
  // without this fallback the editor page crashes on the first
  // property access below.
  const safe: QuoteData["client"] = c ?? {
    name: "",
    address: null,
    email: null,
    phone: null,
  };
  if (safe.email || safe.phone || !safe.contact) return safe;
  const legacy = safe.contact.trim();
  if (EMAIL_RE.test(legacy)) {
    return { ...safe, email: legacy };
  }
  return { ...safe, phone: legacy };
}

export function QuoteEditor({
  quoteId,
  createdAt,
  initialData,
  library,
  quoteStatus,
  publicToken,
  hasPdf,
}: Props) {
  const [client, setClient] = useState(() =>
    migrateLegacyContact(initialData.client),
  );
  const isAccepted = quoteStatus === "accepted";
  const [items, setItems] = useState<QuoteLineItem[]>(initialData.line_items);
  const libraryById = useMemo(
    () => new Map(library.map((m) => [m.id, m])),
    [library],
  );
  const [terms, setTerms] = useState(initialData.terms);
  // Wave 21 — `notes` lifted into state (was a read-only passthrough of
  // initialData.notes) so the Photo / Plan panel can append to it and
  // buildCurrentQuoteData() can persist it on save.
  const [notes, setNotes] = useState<string[]>(initialData.notes ?? []);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [materialsLearned, setMaterialsLearned] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  const markupPct = initialData.markup_pct;
  const taxRate = initialData.tax_rate;
  const taxLabel = initialData.tax_label;
  // Fall back to NZD — an empty / invalid currency makes every
  // Intl.NumberFormat call in the editor throw and crashes the page.
  const currency = initialData.currency || "NZD";

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

  function handleTakeoffResult(result: MaterialTakeoffResult) {
    const newMaterials: QuoteLineItem[] = result.materials.map((m) => {
      const match = matchToLibrary(m.name, library);
      const unit_price =
        match && match.default_unit_price !== null
          ? Number(match.default_unit_price)
          : 0;
      return {
        type: "material",
        description: m.name,
        quantity: m.quantity,
        unit: m.unit,
        unit_price,
        line_total: round2(m.quantity * unit_price),
        library_id: match?.id ?? null,
        is_ai_estimated: false,
        is_missing_price: !match,
        is_calculated_takeoff: true,
        formula: m.formula,
        price_match_key: m.priceMatchKey,
      };
    });
    setItems((prev) => [
      ...newMaterials,
      ...prev.filter((it) => it.type !== "material"),
    ]);
  }

  // Photo / Plan agent → quote. Detected items become draft material
  // lines, library-matched for price where possible (exactly like the
  // takeoff handler above). Unlike takeoff, these are APPENDED — a photo
  // adds to the quote, it doesn't replace the materials list.
  function handlePhotoPlanItems(detected: PhotoPlanItem[]) {
    const newItems: QuoteLineItem[] = detected.map((d) => {
      const match = matchToLibrary(d.label, library);
      const unit_price =
        match && match.default_unit_price !== null
          ? Number(match.default_unit_price)
          : 0;
      return {
        type: "material",
        description: d.location ? `${d.label} — ${d.location}` : d.label,
        quantity: 1,
        unit: "each",
        unit_price,
        line_total: round2(unit_price),
        library_id: match?.id ?? null,
        is_ai_estimated: false,
        is_missing_price: !match,
      };
    });
    setItems((prev) => [...prev, ...newItems]);
  }

  // Photo / Plan agent → quote notes. The quote-note draft + on-site
  // review flags get appended to the "// review these" box.
  function handlePhotoPlanNotes(lines: string[]) {
    const clean = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (clean.length === 0) return;
    setNotes((prev) => [...prev, ...clean]);
  }

  function buildCurrentQuoteData(): QuoteData {
    return {
      ...initialData,
      client,
      line_items: items,
      notes,
      terms,
      ...totals,
      markup_pct: markupPct,
      tax_rate: taxRate,
      tax_label: taxLabel,
      currency,
    };
  }

  function handleSave() {
    setStatus("saving");
    setErrorMessage("");
    setMaterialsLearned(0);
    startTransition(async () => {
      const result = await saveQuoteChanges(quoteId, buildCurrentQuoteData());
      if ("error" in result) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }
      setStatus("saved");
      setMaterialsLearned(result.materialsLearned ?? 0);
      setTimeout(() => {
        setStatus("idle");
        setMaterialsLearned(0);
      }, 2500);
    });
  }

  async function saveBeforeSend(): Promise<boolean> {
    const result = await saveQuoteChanges(quoteId, buildCurrentQuoteData());
    return !("error" in result);
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

  // Wave 19.10 — summary strings for the mobile-collapsible cards.
  const materialMissingPrices = materialIndices.filter(
    (x) => x.it.is_missing_price,
  ).length;
  const materialConfidence = confidenceTally(
    materialIndices.map((x) => ({
      it: x.it,
      lib: x.it.library_id ? libraryById.get(x.it.library_id) : null,
    })),
  );
  const materialsSummary = [
    `${materialIndices.length} item${materialIndices.length === 1 ? "" : "s"}`,
    formatCurrency(totals.materials_subtotal, currency),
    materialMissingPrices > 0
      ? `(${materialMissingPrices} missing price${
          materialMissingPrices === 1 ? "" : "s"
        })`
      : null,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" · ");
  const labourSummary = [
    `${labourIndices.length} item${labourIndices.length === 1 ? "" : "s"}`,
    formatCurrency(totals.labour_subtotal, currency),
  ].join(" · ");
  const termsClauseCount = terms
    .split(/\n\s*\n/)
    .filter((s) => s.trim().length > 0).length;
  const termsSummary = `${termsClauseCount} clause${
    termsClauseCount === 1 ? "" : "s"
  } · tap to view`;

  const issueDate = formatIssueDate(createdAt);
  const validUntil = formatIssueDate(validUntilDate(createdAt, 30));
  const number = quoteNumber(quoteId, createdAt);
  // Wave 14.4 — treat "To be confirmed" / TBC / TBD / blank the same.
  // The input value is suppressed to "" so the native placeholder
  // ("Client name") shows and the tradie can type cleanly.
  const clientPlaceholder = isPlaceholderClientName(client.name);
  const clientNameInputValue = clientPlaceholder ? "" : client.name;

  return (
    <div className="space-y-6">
      <section className="t2q-card-pro p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
              Client
            </div>
            <input
              data-testid="quote-client-name"
              aria-label="Client name"
              value={clientNameInputValue}
              onChange={(e) =>
                setClient((c) => ({ ...c, name: e.target.value }))
              }
              placeholder="Client name"
              disabled={isAccepted}
              className={[
                "mt-2 block w-full rounded-sm border bg-ink-900 px-3 py-2 font-display text-xl uppercase tracking-tight outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60",
                clientPlaceholder ? "border-hivis text-white placeholder:text-hivis/70" : "border-ink-600 text-white",
              ].join(" ")}
            />
            <textarea
              data-testid="quote-client-address"
              aria-label="Site address"
              value={client.address ?? ""}
              onChange={(e) =>
                setClient((c) => ({ ...c, address: e.target.value || null }))
              }
              rows={2}
              placeholder="Site address"
              disabled={isAccepted}
              className="mt-2 block w-full resize-none rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                data-testid="quote-client-email"
                aria-label="Client email"
                type="email"
                value={client.email ?? ""}
                onChange={(e) =>
                  setClient((c) => ({ ...c, email: e.target.value || null }))
                }
                placeholder="Client email"
                disabled={isAccepted}
                className="block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                data-testid="quote-client-phone"
                aria-label="Client phone"
                type="tel"
                value={client.phone ?? ""}
                onChange={(e) =>
                  setClient((c) => ({ ...c, phone: e.target.value || null }))
                }
                placeholder="Client phone"
                disabled={isAccepted}
                className="block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
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

      {notes.length > 0 && (
        <section
          data-testid="quote-notes"
          className="rounded-sm border border-hivis/40 bg-hivis/10 p-5"
        >
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-hivis">
            {"// review these"}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-200">
            {notes.map((note, i) => (
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

      <TakeoffPanel
        onRecalculate={handleTakeoffResult}
        initialInputs={initialData.takeoff_inputs}
        isAccepted={isAccepted}
      />

      <PhotoPlanPanel
        onAddItems={handlePhotoPlanItems}
        onAddNotes={handlePhotoPlanNotes}
        isAccepted={isAccepted}
      />

      {/* Wave 19.10 — Materials section: mobile-collapsible behind a
          summary line, always-expanded on md+. */}
      <MobileCollapsibleCard
        sectionId="materials"
        title="Materials"
        summary={materialsSummary}
      >
        <ItemsSection
          title="Materials"
          accent="brand"
          rows={materialIndices}
          currency={currency}
          libraryById={libraryById}
          showBadges
          showConfidence
          confidenceTally={materialConfidence}
          onUpdate={updateItem}
          onRemove={removeItem}
          onAdd={() => addItem("material")}
          addLabel="Add material"
          disabled={isAccepted}
        />
      </MobileCollapsibleCard>

      <MobileCollapsibleCard
        sectionId="labour"
        title="Labour"
        summary={labourSummary}
      >
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
          disabled={isAccepted}
        />
      </MobileCollapsibleCard>

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
          disabled={isAccepted}
        />
      )}

      <section data-testid="quote-totals" className="t2q-card-pro p-5 sm:p-6">
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

      {/* Wave 19.10 — Terms: mobile-collapsible behind a clause-count
          summary, always-expanded on md+. */}
      <MobileCollapsibleCard
        sectionId="terms"
        title="Terms"
        summary={termsSummary}
      >
        <section className="t2q-card-pro p-5 sm:p-6">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            Terms
          </div>
          <textarea
            data-testid="quote-terms"
            aria-label="Quote terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={6}
            disabled={isAccepted}
            className="mt-3 block w-full resize-y rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-200 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
          />
        </section>
      </MobileCollapsibleCard>

      {/* SendQuoteButton keeps the inline link / PDF / copy affordances
          for sent / viewed / accepted states — but its Send trigger
          is hidden because StickyActionBar now owns that action. */}
      <SendQuoteButton
        quoteId={quoteId}
        status={quoteStatus}
        publicToken={publicToken}
        hasPdf={hasPdf}
        onSaveBeforeSend={saveBeforeSend}
        hideSendButton
      />

      {/* Save-status feedback strip — small inline pill above the
          sticky bar so the operator still sees "saved" / errors /
          materials-learned without the old large bottom row. */}
      <div
        data-testid="save-status"
        aria-live="polite"
        className="font-mono text-xs uppercase tracking-[0.2em]"
      >
        {status === "saving" && <span className="text-ink-400">Saving…</span>}
        {status === "saved" && (
          <span className="text-brand">
            {materialsLearned > 0
              ? `// saved · ${materialsLearned} material${materialsLearned === 1 ? "" : "s"} added to your library`
              : "// saved"}
          </span>
        )}
        {status === "error" && (
          <span className="text-red-400">{errorMessage || "Save failed"}</span>
        )}
        {status === "idle" && (
          <span className="text-ink-500">
            {isAccepted
              ? "// quote is accepted — edits are read-only"
              : "// edits are not saved until you click save"}
          </span>
        )}
      </div>

      <StickyActionBar
        quoteId={quoteId}
        status={quoteStatus}
        isPending={isPending}
        onSave={handleSave}
        onSaveBeforeSend={saveBeforeSend}
      />
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
  showConfidence,
  confidenceTally,
  onUpdate,
  onRemove,
  onAdd,
  addLabel,
  disabled,
}: {
  title: string;
  accent: "brand" | "ink";
  rows: Array<{ it: QuoteLineItem; i: number }>;
  currency: string;
  libraryById: Map<string, LibraryMaterial>;
  showBadges: boolean;
  showConfidence?: boolean;
  confidenceTally?: { high: number; medium: number; low: number };
  onUpdate: (idx: number, patch: Partial<QuoteLineItem>) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  addLabel: string;
  disabled?: boolean;
}) {
  return (
    <section
      data-testid={`section-${title.toLowerCase()}`}
      className="t2q-card-pro p-5 sm:p-6"
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
          disabled={disabled}
          title={disabled ? "Quote already accepted." : undefined}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-ink-300"
        >
          <Plus size={14} weight="bold" />
          {addLabel}
        </button>
      </div>

      {showConfidence && confidenceTally && rows.length > 0 && (
        <ConfidenceLegend tally={confidenceTally} />
      )}

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
            const confidence: LineConfidence = showConfidence
              ? lineConfidence(it, libMaterial)
              : "none";
            const confidenceClass =
              confidence === "high"
                ? "border-l-4 border-l-emerald-500/70"
                : confidence === "medium"
                  ? "border-l-4 border-l-hivis/70"
                  : confidence === "low"
                    ? "border-l-4 border-l-red-500/70"
                    : "";
            return (
            <li
              key={i}
              data-testid={`row-${i}`}
              data-confidence={confidence}
              className={`rounded-sm border border-ink-700 bg-ink-900 p-3 ${confidenceClass}`}
            >
              {showBadges && (
                <ItemBadge
                  isCalculatedTakeoff={!!it.is_calculated_takeoff}
                  isLibrary={!!libMaterial}
                  isAi={!!it.is_ai_estimated && !libMaterial && !it.is_missing_price}
                  isMissingPrice={!!it.is_missing_price}
                  takeoffStatus={it.takeoff_status}
                  takeoffFlags={it.takeoff_flags}
                  supplierUrl={libMaterial?.supplier_url ?? null}
                  supplierName={libMaterial?.supplier ?? null}
                />
              )}
              <div className="flex items-start gap-2">
                <input
                  aria-label="Line item description"
                  value={it.description}
                  onChange={(e) =>
                    onUpdate(i, { description: e.target.value })
                  }
                  placeholder="Description"
                  disabled={disabled}
                  className="flex-1 rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => onRemove(i)}
                  disabled={disabled}
                  title={disabled ? "Quote already accepted." : undefined}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-ink-700 text-ink-400 hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-700 disabled:hover:text-ink-400"
                >
                  <Trash size={16} weight="bold" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumberField
                  label="Qty"
                  value={it.quantity}
                  onChange={(v) => onUpdate(i, { quantity: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Unit"
                  value={it.unit}
                  onChange={(v) => onUpdate(i, { unit: v })}
                  disabled={disabled}
                />
                <NumberField
                  label="Unit price"
                  value={it.unit_price}
                  onChange={(v) => onUpdate(i, { unit_price: v })}
                  disabled={disabled}
                />
              </div>
              <div className="mt-2 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-300">
                Line total: <span className="text-white">{formatCurrency(it.line_total, currency)}</span>
              </div>
              {(it.formula || libMaterial) && (
                <ShowWorking
                  formula={it.formula}
                  libraryName={libMaterial?.name ?? null}
                  unit={it.unit}
                  result={it.quantity}
                />
              )}
            </li>
          );
          })}
        </ul>
      )}
    </section>
  );
}

function ShowWorking({
  formula,
  libraryName,
  unit,
  result,
}: {
  formula: string | null | undefined;
  libraryName: string | null;
  unit: string;
  result: number;
}) {
  const explained = explainFormula(formula);
  const hasMath = explained.length > 0;
  // Skip the entire toggle if we have neither a formula nor a library
  // match — the parent already gates on that, but it's defensive here.
  if (!hasMath && !libraryName) return null;
  return (
    <details className="mt-2 rounded-sm border border-ink-700 bg-ink-950/70 [&[open]>summary>span:last-child]:rotate-180">
      <summary
        data-testid="show-working-toggle"
        className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300 hover:text-white"
      >
        <span>{"// show working"}</span>
        <span aria-hidden="true" className="transition-transform">
          ▾
        </span>
      </summary>
      <div className="space-y-2 border-t border-ink-700 px-3 py-2.5 text-xs text-ink-200">
        {hasMath && (
          <div data-testid="working-formula">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {"// quantity"}
            </div>
            <div className="mt-1 break-words text-sm leading-snug text-white">
              {explained}
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-400">
              = {result} {unit || ""}
            </div>
          </div>
        )}
        {libraryName && (
          <div data-testid="working-library">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {"// price"}
            </div>
            <div className="mt-1 text-sm text-white">
              Matched to your library:{" "}
              <span className="text-brand">{libraryName}</span>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function ConfidenceLegend({
  tally,
}: {
  tally: { high: number; medium: number; low: number };
}) {
  const total = tally.high + tally.medium + tally.low;
  if (total === 0) return null;
  return (
    <div
      data-testid="confidence-legend"
      className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
    >
      <span className="text-ink-500">{"// confidence"}</span>
      <ConfidenceChip
        color="emerald"
        count={tally.high}
        label="From your library"
        testid="legend-high"
      />
      <ConfidenceChip
        color="hivis"
        count={tally.medium}
        label="AI estimate"
        testid="legend-medium"
      />
      <ConfidenceChip
        color="red"
        count={tally.low}
        label="Needs price"
        testid="legend-low"
      />
    </div>
  );
}

function ConfidenceChip({
  color,
  count,
  label,
  testid,
}: {
  color: "emerald" | "hivis" | "red";
  count: number;
  label: string;
  testid: string;
}) {
  const dimmed = count === 0;
  const swatch =
    color === "emerald"
      ? "bg-emerald-500/80"
      : color === "hivis"
        ? "bg-hivis/80"
        : "bg-red-500/80";
  const text = dimmed
    ? "text-ink-600"
    : color === "emerald"
      ? "text-emerald-300"
      : color === "hivis"
        ? "text-hivis"
        : "text-red-300";
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 ${text}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${dimmed ? "bg-ink-700" : swatch}`}
      />
      {count} {label}
    </span>
  );
}

function ItemBadge({
  isCalculatedTakeoff,
  isLibrary,
  isAi,
  isMissingPrice,
  takeoffStatus,
  takeoffFlags,
  supplierUrl,
  supplierName,
}: {
  isCalculatedTakeoff: boolean;
  isLibrary: boolean;
  isAi: boolean;
  isMissingPrice: boolean;
  takeoffStatus?: "ok" | "assumed" | "needs_review" | "blocked";
  takeoffFlags?: string[];
  supplierUrl: string | null;
  supplierName: string | null;
}) {
  // Wave 44 — takeoff status badge takes priority for material lines.
  // "ok" maps to the existing "Calculated takeoff" badge to avoid
  // visual churn for working quotes. "assumed" / "needs_review" /
  // "blocked" surface as new badges so the tradie can see at a glance
  // which lines they should eyeball before sending.
  const flagsTitle =
    takeoffFlags && takeoffFlags.length > 0
      ? takeoffFlags.join(" · ")
      : undefined;
  if (!isCalculatedTakeoff && !isLibrary && !isAi && !isMissingPrice && !takeoffStatus) {
    return null;
  }
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {isCalculatedTakeoff && (!takeoffStatus || takeoffStatus === "ok") && (
        <span
          data-testid="badge-calculated"
          className="inline-flex items-center gap-1 rounded-sm bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-blue-300"
          title="Quantity computed by the takeoff calculator from your assumptions"
        >
          <Calculator size={10} weight="bold" />
          Calculated takeoff
        </span>
      )}
      {isCalculatedTakeoff && takeoffStatus === "assumed" && (
        <span
          data-testid="badge-assumed"
          className="inline-flex items-center gap-1 rounded-sm bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-blue-200"
          title={flagsTitle ?? "Calculated with one or more defaults — confirm before sending"}
        >
          <Calculator size={10} weight="bold" />
          Assumed
        </span>
      )}
      {takeoffStatus === "needs_review" && (
        <span
          data-testid="badge-needs-review"
          className="inline-flex items-center gap-1 rounded-sm bg-hivis/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis"
          title={flagsTitle ?? "Validator flagged this line — please review"}
        >
          Needs review
        </span>
      )}
      {takeoffStatus === "blocked" && (
        <span
          data-testid="badge-blocked"
          className="inline-flex items-center gap-1 rounded-sm border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-red-300"
          title={flagsTitle ?? "Calculator could not run — please clarify"}
        >
          Missing info
        </span>
      )}
      {!isCalculatedTakeoff && isLibrary && (
        <span
          data-testid="badge-library"
          className="inline-flex items-center gap-1 rounded-sm bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-brand"
        >
          From your library
        </span>
      )}
      {!isCalculatedTakeoff && isAi && (
        <span
          data-testid="badge-ai"
          className="inline-flex items-center gap-1 rounded-sm bg-hivis/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis"
          title="Price came from a T2Q estimate — confirm before sending"
        >
          <Sparkle size={10} weight="bold" />
          T2Q estimate
        </span>
      )}
      {isMissingPrice && (
        <span
          data-testid="badge-missing-price"
          className="inline-flex items-center gap-1 rounded-sm border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-red-300"
          title="No matching item in your materials library — set a unit price or add this material to your library"
        >
          Missing price
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 block w-full rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
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
        disabled={disabled}
        className="mt-1 block w-full rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm tabular-nums text-white outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
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
