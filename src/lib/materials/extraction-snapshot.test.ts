import { describe, expect, it } from "vitest";
import {
  assessExtraction,
  chooseBestExtraction,
  parseSupplierQuoteExtraction,
  type ExtractionAttempt,
  type SupplierQuoteExtraction,
} from "./quoteExtraction";
import {
  filterExtractionQueue,
  toExtractionQueueRow,
  type ExtractionQueueRow,
} from "./extractionQueue";
import { computeExtractionMetrics } from "./extractionMetrics";
import type { QuoteData, SupplierSource } from "../quote-types";

import clean from "./__fixtures__/supplier-scans/clean-itm.json";
import messy from "./__fixtures__/supplier-scans/messy-ocr-itm.json";
import missingSubtotal from "./__fixtures__/supplier-scans/missing-subtotal.json";
import unreadableTotal from "./__fixtures__/supplier-scans/unreadable-total.json";
import partialTable from "./__fixtures__/supplier-scans/partial-table.json";
import retrySuccess from "./__fixtures__/supplier-scans/retry-success.json";
import retryFail from "./__fixtures__/supplier-scans/retry-fail-blocked.json";

// Builds the queue row a fixture would produce once persisted, so we can
// snapshot the review queue + sample metrics straight from the golden pack.

function rowFromSingle(id: string, raw: unknown): ExtractionQueueRow {
  const p = parseSupplierQuoteExtraction(raw);
  if (!p.ok) throw new Error("parse failed");
  const a = assessExtraction(p.value, p.rowFailures);
  return buildRow(id, p.value, a.status, a.reasons, p.rowFailures, 1);
}

function rowFromRetry(id: string, raw: { attempts: unknown[] }): ExtractionQueueRow {
  const attempts: ExtractionAttempt[] = raw.attempts.map((r) => {
    const p = parseSupplierQuoteExtraction(r);
    if (!p.ok) throw new Error("parse failed");
    return { value: p.value, rowFailures: p.rowFailures };
  });
  const best = chooseBestExtraction(attempts);
  return buildRow(id, best.value, best.status, best.reasons, best.rowFailures, attempts.length);
}

function buildRow(
  id: string,
  value: SupplierQuoteExtraction,
  status: "ok" | "needs_review" | "blocked",
  reasons: string[],
  rowFailures: { index: number; reason: string; raw_text: string | null }[],
  attempts: number,
): ExtractionQueueRow {
  const supplier_source: SupplierSource = {
    supplier: value.supplier,
    subtotal: value.subtotal,
    gst: value.gst,
    total: value.total,
    extraction_status: status,
    extraction_reasons: reasons,
    row_failures: rowFailures,
    extraction_attempts: attempts,
  };
  const quote_data = {
    client: { name: "x", address: null, email: null, phone: null },
    job_summary: "",
    line_items: value.items.map((it) => ({
      type: "material" as const,
      description: it.name,
      quantity: it.quantity ?? 0,
      unit: it.unit,
      unit_price: it.price ?? 0,
      line_total: it.source_line_total ?? 0,
    })),
    materials_subtotal: 0,
    labour_subtotal: 0,
    markup_pct: 0,
    markup_amount: 0,
    subtotal_before_tax: 0,
    tax_amount: 0,
    total: 0,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: 15,
    terms: "",
    notes: [],
    supplier_source,
  } as QuoteData;
  return toExtractionQueueRow({ id, created_at: "2026-05-20T00:00:00.000Z", quote_data })!;
}

const ROWS: ExtractionQueueRow[] = [
  rowFromSingle("clean-itm", clean),
  rowFromSingle("messy-ocr-itm", messy),
  rowFromSingle("missing-subtotal", missingSubtotal),
  rowFromSingle("unreadable-total", unreadableTotal),
  rowFromSingle("partial-table", partialTable),
  rowFromRetry("retry-success", retrySuccess as { attempts: unknown[] }),
  rowFromRetry("retry-fail-blocked", retryFail as { attempts: unknown[] }),
];

describe("extraction sample metrics (golden pack)", () => {
  const metrics = computeExtractionMetrics(
    ROWS.map((r) => ({
      status: r.status,
      supplier: r.supplier,
      attempts: r.attempts,
      corrected: r.corrected,
    })),
  );

  it("locks the sample metrics computed from the 7 fixtures", () => {
    expect(metrics.total).toBe(7);
    expect(metrics.byStatus).toEqual({ ok: 3, needs_review: 2, blocked: 2, unknown: 0 });
    expect(metrics.retriedCount).toBe(2);
    expect(metrics.retryRate).toBe(0.29);
    expect(metrics.flaggedCount).toBe(4);
    expect(metrics.correctedCount).toBe(0);
    expect(metrics.bySupplier.find((s) => s.supplier === "ITM")).toEqual({
      supplier: "ITM",
      total: 5,
      needs_review: 2,
      blocked: 1,
    });
  });

  it("the open queue holds exactly the flagged fixtures (2 needs_review + 2 blocked)", () => {
    const open = filterExtractionQueue(ROWS); // default: needs_review + blocked
    expect(open).toHaveLength(4);
    expect(open.map((r) => r.status).sort()).toEqual([
      "blocked",
      "blocked",
      "needs_review",
      "needs_review",
    ]);
    // The 3 ok fixtures (clean, missing-subtotal, retry-success) never appear.
    expect(open.some((r) => r.quoteId === "clean-itm")).toBe(false);
    expect(open.some((r) => r.quoteId === "missing-subtotal")).toBe(false);
    expect(open.some((r) => r.quoteId === "retry-success")).toBe(false);
  });
});
