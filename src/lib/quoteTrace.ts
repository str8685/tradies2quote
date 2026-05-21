// ─────────────────────────────────────────────────────────────────────────
// Quote traceability — the deterministic "where did every number come from
// and where (if anywhere) did it stop reconciling" view.
//
// Pure, no I/O. Given a persisted QuoteData it reconstructs the value flow:
//   source (as scanned)  →  normalized (live)  →  computed (recomputed here)
//   →  validation (per-line issues + the send-gate verdict).
//
// Used by the owner debug page to show exact mismatch / block reasons per
// quote and per line. Never hides a blocked line; never invents a number.
// ─────────────────────────────────────────────────────────────────────────

import type { QuoteData, QuoteLineItem } from "./quote-types";
import { computeQuoteTotals, moneyEquals, round2 } from "./quote-defaults";
import { assessQuoteTakeoffSafety } from "./quote-validation";

export type QuoteLineTrace = {
  description: string;
  /** Raw values as scanned off a supplier doc (null for non-supplier lines). */
  source: {
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    line_total: number | null;
  } | null;
  /** The live, editable (normalized) values stored on the quote. */
  normalized: {
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
  };
  /** What this code recomputes for the line total (qty × unit price). */
  computed_line_total: number;
  quantity_source: NonNullable<QuoteLineItem["quantity_source"]> | null;
  quantity_confirmed: boolean | null;
  takeoff_status: NonNullable<QuoteLineItem["takeoff_status"]> | null;
  /** takeoff_flags + validation_flags merged. */
  flags: string[];
  /** Exact, human-readable problems with this line (empty = clean). */
  issues: string[];
};

export type QuoteTrace = {
  is_supplier_import: boolean;
  is_takeoff: boolean;
  source_totals: {
    subtotal: number | null;
    gst: number | null;
    total: number | null;
    gst_inclusive: boolean | null;
  } | null;
  reconciliation_status: string | null;
  reconciliation_reasons: string[];
  /** #2 — strict-extraction verdict captured at scan time (provenance). */
  extraction_status: string | null;
  extraction_reasons: string[];
  stored_totals: {
    materials_subtotal: number;
    labour_subtotal: number;
    markup_amount: number;
    subtotal_before_tax: number;
    tax_amount: number;
    total: number;
  };
  computed_totals: ReturnType<typeof computeQuoteTotals>;
  /** True when the stored totals equal a fresh deterministic recompute. */
  totals_match: boolean;
  lines: QuoteLineTrace[];
  /** The pre-send safety verdict (block/warn reasons). */
  send: ReturnType<typeof assessQuoteTakeoffSafety>;
};

/**
 * Build a full value-flow + validation trace for a persisted quote. Pure
 * and deterministic — safe to call anywhere (owner debug page, tests).
 */
export function buildQuoteTrace(quoteData: QuoteData): QuoteTrace {
  const items: QuoteLineItem[] = Array.isArray(quoteData.line_items)
    ? quoteData.line_items
    : [];

  const lines: QuoteLineTrace[] = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const computed = round2(qty * price);
    const storedLineTotal = Number(it.line_total) || 0;
    const issues: string[] = [];

    if (!moneyEquals(computed, storedLineTotal, 0.01)) {
      issues.push(`line_total ${storedLineTotal} ≠ qty×price ${computed}`);
    }
    if (
      it.source_line_total != null &&
      !moneyEquals(computed, it.source_line_total, 0.02)
    ) {
      issues.push(
        `doesn't match supplier source ${it.source_line_total} (app ${computed})`,
      );
    }
    if (
      it.type === "material" &&
      it.quantity_source === "ai" &&
      it.quantity_confirmed !== true
    ) {
      issues.push("AI-estimated quantity not confirmed — blocks send");
    }
    if (it.takeoff_status === "blocked") {
      issues.push("takeoff blocked — needs more info");
    }

    return {
      description: it.description ?? "",
      source:
        it.source_line_total != null ||
        it.source_quantity != null ||
        it.source_unit_price != null
          ? {
              quantity: it.source_quantity ?? null,
              unit: it.source_unit ?? null,
              unit_price: it.source_unit_price ?? null,
              line_total: it.source_line_total ?? null,
            }
          : null,
      normalized: {
        quantity: qty,
        unit: it.unit ?? "",
        unit_price: price,
        line_total: storedLineTotal,
      },
      computed_line_total: computed,
      quantity_source: it.quantity_source ?? null,
      quantity_confirmed: it.quantity_confirmed ?? null,
      takeoff_status: it.takeoff_status ?? null,
      flags: [...(it.takeoff_flags ?? []), ...(it.validation_flags ?? [])],
      issues,
    };
  });

  const computed_totals = computeQuoteTotals(
    items,
    Number(quoteData.markup_pct) || 0,
    Number(quoteData.tax_rate) || 0,
  );
  const stored_totals = {
    materials_subtotal: Number(quoteData.materials_subtotal) || 0,
    labour_subtotal: Number(quoteData.labour_subtotal) || 0,
    markup_amount: Number(quoteData.markup_amount) || 0,
    subtotal_before_tax: Number(quoteData.subtotal_before_tax) || 0,
    tax_amount: Number(quoteData.tax_amount) || 0,
    total: Number(quoteData.total) || 0,
  };
  const totals_match =
    moneyEquals(computed_totals.total, stored_totals.total) &&
    moneyEquals(
      computed_totals.subtotal_before_tax,
      stored_totals.subtotal_before_tax,
    ) &&
    moneyEquals(computed_totals.tax_amount, stored_totals.tax_amount);

  const supplier = quoteData.supplier_source ?? null;

  return {
    is_supplier_import: !!supplier,
    is_takeoff: items.some(
      (it) => it.is_calculated_takeoff || it.takeoff_status != null,
    ),
    source_totals: supplier
      ? {
          subtotal: supplier.source_subtotal ?? supplier.subtotal ?? null,
          gst: supplier.source_gst ?? supplier.gst ?? null,
          total: supplier.source_total ?? supplier.total ?? null,
          gst_inclusive: supplier.gst_inclusive ?? null,
        }
      : null,
    reconciliation_status: supplier?.reconciliation_status ?? null,
    reconciliation_reasons: supplier?.reconciliation_reasons ?? [],
    extraction_status: supplier?.extraction_status ?? null,
    extraction_reasons: supplier?.extraction_reasons ?? [],
    stored_totals,
    computed_totals,
    totals_match,
    lines,
    send: assessQuoteTakeoffSafety(quoteData),
  };
}
