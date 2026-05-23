import { describe, expect, it } from "vitest";
import {
  filterExtractionQueue,
  suppliersInQueue,
  toExtractionQueueRow,
  toExtractionQueueRows,
  type ExtractionQuoteInput,
} from "./extractionQueue";
import type { QuoteData, SupplierSource } from "../quote-types";

function quote(
  id: string,
  ss: Partial<SupplierSource> | null,
  o: { itemCount?: number; created_at?: string } = {},
): ExtractionQuoteInput {
  const line_items = Array.from({ length: o.itemCount ?? 1 }, () => ({
    type: "material" as const,
    description: "Item",
    quantity: 1,
    unit: "each",
    unit_price: 10,
    line_total: 10,
  }));
  const quote_data: QuoteData = {
    client: { name: "x", address: null, email: null, phone: null },
    job_summary: "",
    line_items,
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
    supplier_source: ss ? ({ supplier: null, subtotal: null, gst: null, total: null, ...ss } as SupplierSource) : null,
  };
  return { id, created_at: o.created_at ?? "2026-05-20T00:00:00.000Z", quote_data };
}

describe("toExtractionQueueRow", () => {
  it("returns null for a non-supplier quote (no supplier_source)", () => {
    expect(toExtractionQueueRow(quote("a", null))).toBeNull();
  });

  it("maps supplier_source provenance onto a flat row", () => {
    const row = toExtractionQueueRow(
      quote("q1", {
        supplier: "ITM",
        extraction_status: "blocked",
        extraction_reasons: ["No printed total."],
        row_failures: [{ index: 2, reason: "unit price couldn't be read", raw_text: "12.4O" }],
        reconciliation_status: "needs_review",
        reconciliation_reasons: ["subtotal drift"],
        extraction_attempts: 2,
        source_subtotal: 100,
        source_gst: 15,
        source_total: 115,
      }, { itemCount: 3 }),
    )!;
    expect(row.supplier).toBe("ITM");
    expect(row.status).toBe("blocked");
    expect(row.reasons).toEqual(["No printed total."]);
    expect(row.rowFailures[0]).toMatchObject({ index: 2, raw_text: "12.4O" });
    expect(row.reconciliationStatus).toBe("needs_review");
    expect(row.attempts).toBe(2);
    expect(row.itemCount).toBe(3);
    expect(row.source).toEqual({ subtotal: 100, gst: 15, total: 115 });
    expect(row.quoteNumber).toMatch(/Q-/);
  });

  it("defaults attempts to 1 and corrected/reviewed to false/null on legacy rows", () => {
    const row = toExtractionQueueRow(
      quote("q2", { supplier: "ITM", extraction_status: "needs_review" }),
    )!;
    expect(row.attempts).toBe(1);
    expect(row.corrected).toBe(false);
    expect(row.reviewedAt).toBeNull();
  });
});

describe("filterExtractionQueue", () => {
  const rows = toExtractionQueueRows([
    quote("ok1", { supplier: "ITM", extraction_status: "ok" }),
    quote("nr1", { supplier: "ITM", extraction_status: "needs_review" }),
    quote("bl1", { supplier: "PlaceMakers", extraction_status: "blocked" }),
    quote("handled1", {
      supplier: "ITM",
      extraction_status: "blocked",
      extraction_reviewed_at: "2026-05-21T00:00:00.000Z",
    }),
  ]);

  it("default 'open' view shows only unhandled needs_review + blocked", () => {
    const open = filterExtractionQueue(rows);
    expect(open.map((r) => r.quoteId).sort()).toEqual(["bl1", "nr1"]);
    // ok scans never appear; handled ones are excluded.
    expect(open.some((r) => r.quoteId === "ok1")).toBe(false);
    expect(open.some((r) => r.quoteId === "handled1")).toBe(false);
  });

  it("status filters narrow to a single flagged status (unhandled)", () => {
    expect(filterExtractionQueue(rows, { status: "needs_review" }).map((r) => r.quoteId)).toEqual(["nr1"]);
    expect(filterExtractionQueue(rows, { status: "blocked" }).map((r) => r.quoteId)).toEqual(["bl1"]);
  });

  it("'handled' view shows only reviewed entries", () => {
    expect(filterExtractionQueue(rows, { status: "handled" }).map((r) => r.quoteId)).toEqual(["handled1"]);
  });

  it("supplier filter is case-insensitive and combines with status", () => {
    expect(filterExtractionQueue(rows, { supplier: "placemakers" }).map((r) => r.quoteId)).toEqual(["bl1"]);
    expect(filterExtractionQueue(rows, { status: "needs_review", supplier: "PlaceMakers" })).toEqual([]);
  });

  it("suppliersInQueue lists distinct suppliers sorted", () => {
    expect(suppliersInQueue(rows)).toEqual(["ITM", "PlaceMakers"]);
  });
});
