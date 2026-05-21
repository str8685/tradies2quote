import { describe, expect, it } from "vitest";
import { buildQuoteTrace } from "./quoteTrace";
import type { QuoteData, QuoteLineItem } from "./quote-types";

function li(o: Partial<QuoteLineItem> = {}): QuoteLineItem {
  const quantity = o.quantity ?? 1;
  const unit_price = o.unit_price ?? 10;
  return {
    type: "material",
    description: "Item",
    quantity,
    unit: "each",
    unit_price,
    line_total: o.line_total ?? Math.round(quantity * unit_price * 100) / 100,
    ...o,
  };
}

function qd(items: QuoteLineItem[], o: Partial<QuoteData> = {}): QuoteData {
  return {
    client: { name: "Jane", address: null, email: "j@e.com", phone: null },
    job_summary: "job",
    line_items: items,
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
    ...o,
  };
}

describe("buildQuoteTrace", () => {
  it("clean quote: no line issues, totals match, sendable", () => {
    const t = buildQuoteTrace(
      qd(
        [
          li({
            description: "Pile",
            quantity: 10,
            unit_price: 20,
            line_total: 200,
            quantity_source: "user",
          }),
        ],
        {
          materials_subtotal: 200,
          subtotal_before_tax: 200,
          tax_amount: 30,
          total: 230,
        },
      ),
    );
    expect(t.lines[0].issues).toEqual([]);
    expect(t.totals_match).toBe(true);
    expect(t.send.can_send).toBe(true);
  });

  it("flags drifted stored totals (computed != stored)", () => {
    const t = buildQuoteTrace(
      qd([li({ quantity: 10, unit_price: 20, line_total: 200 })], {
        // deliberately wrong stored total
        materials_subtotal: 200,
        subtotal_before_tax: 200,
        tax_amount: 30,
        total: 999,
      }),
    );
    expect(t.totals_match).toBe(false);
    expect(t.computed_totals.total).toBe(230);
    expect(t.stored_totals.total).toBe(999);
  });

  it("AI-supplied quantity line: flagged per-line + blocks send", () => {
    const t = buildQuoteTrace(
      qd([
        li({
          description: "Screws",
          quantity: 5,
          unit_price: 4,
          line_total: 20,
          quantity_source: "ai",
          quantity_confirmed: false,
        }),
      ]),
    );
    expect(t.lines[0].issues.join(" ")).toMatch(/AI-estimated quantity/i);
    expect(t.send.can_send).toBe(false);
  });

  it("blocked takeoff line: flagged + blocks send + flags carried", () => {
    const t = buildQuoteTrace(
      qd([
        li({
          description: "deck takeoff — needs dimensions",
          quantity: 0,
          unit_price: 0,
          line_total: 0,
          takeoff_status: "blocked",
          takeoff_flags: ["Deck length and width."],
        }),
      ]),
    );
    expect(t.lines[0].issues.join(" ")).toMatch(/blocked/i);
    expect(t.lines[0].flags).toContain("Deck length and width.");
    expect(t.is_takeoff).toBe(true);
    expect(t.send.can_send).toBe(false);
  });

  it("supplier import: surfaces source totals + reconciliation status", () => {
    const t = buildQuoteTrace(
      qd(
        [
          li({
            description: "Decking",
            quantity: 100,
            unit_price: 8.5,
            line_total: 850,
            source_quantity: 100,
            source_unit_price: 8.5,
            source_line_total: 850,
            quantity_source: "supplier",
          }),
        ],
        {
          supplier_source: {
            supplier: "ITM",
            subtotal: 850,
            gst: 127.5,
            total: 977.5,
            gst_inclusive: false,
            source_subtotal: 850,
            source_gst: 127.5,
            source_total: 977.5,
            reconciliation_status: "ok",
            reconciliation_reasons: [],
          },
        },
      ),
    );
    expect(t.is_supplier_import).toBe(true);
    expect(t.source_totals?.total).toBe(977.5);
    expect(t.reconciliation_status).toBe("ok");
    expect(t.lines[0].source?.line_total).toBe(850);
    expect(t.lines[0].issues).toEqual([]);
  });

  it("OCR-messy supplier import: a line that no longer matches its source is flagged + blocks", () => {
    // OCR misread the unit price (28.4 → 30), so the app line total
    // (19×30=570) no longer equals the printed source line total (539.6).
    const t = buildQuoteTrace(
      qd(
        [
          li({
            description: "140x45 H3.2",
            quantity: 19,
            unit_price: 30,
            line_total: 570,
            source_quantity: 19,
            source_unit_price: 28.4,
            source_line_total: 539.6,
            quantity_source: "supplier",
          }),
        ],
        {
          supplier_source: {
            supplier: "Omokoroa ITM",
            subtotal: 539.6,
            gst: 80.94,
            total: 620.54,
            gst_inclusive: false,
            reconciliation_status: "blocked",
            reconciliation_reasons: ["Printed line total ≠ qty × unit price."],
          },
        },
      ),
    );
    expect(t.lines[0].issues.join(" ")).toMatch(/supplier source/i);
    expect(t.reconciliation_status).toBe("blocked");
    expect(t.send.can_send).toBe(false);
  });
});
