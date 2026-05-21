import { describe, expect, it } from "vitest";
import { validateSupplierQuote } from "./quoteValidation";
import type {
  ExtractedSupplierItem,
  SupplierQuoteExtraction,
} from "./quoteExtraction";

function item(
  partial: Partial<ExtractedSupplierItem> &
    Pick<ExtractedSupplierItem, "name" | "price" | "quantity">,
): ExtractedSupplierItem {
  return {
    name: partial.name,
    unit: partial.unit ?? "each",
    price: partial.price,
    sku: partial.sku ?? null,
    quantity: partial.quantity,
    pieces: partial.pieces ?? null,
    source_line_total: partial.source_line_total ?? null,
    raw_text: partial.raw_text ?? null,
    confidence: partial.confidence ?? 0.95,
  };
}

function extraction(
  partial: Partial<SupplierQuoteExtraction> &
    Pick<SupplierQuoteExtraction, "items">,
): SupplierQuoteExtraction {
  return {
    supplier: partial.supplier ?? "ITM",
    quote_number: partial.quote_number ?? "Q-2026-0042",
    currency: partial.currency ?? "NZD",
    gst_inclusive: partial.gst_inclusive ?? false,
    items: partial.items,
    subtotal: partial.subtotal ?? null,
    gst: partial.gst ?? null,
    total: partial.total ?? null,
    discount: partial.discount ?? null,
    freight: partial.freight ?? null,
    adjustments: partial.adjustments ?? null,
    notes: partial.notes ?? [],
  };
}

/** A clean, internally-consistent ITM quote (GST-exclusive). */
function cleanItmQuote(): SupplierQuoteExtraction {
  return extraction({
    items: [
      item({
        name: "140x19 H3.2 SG8 Decking",
        unit: "m",
        price: 8.5,
        quantity: 184.8,
        source_line_total: 1570.8,
      }),
      item({
        name: "140x45 H3.2 SG8 Joist",
        unit: "each",
        price: 22.4,
        quantity: 14,
        source_line_total: 313.6,
      }),
      item({
        name: "Stainless Decking Screws 65mm",
        unit: "box",
        price: 0.25,
        quantity: 784,
        source_line_total: 196,
      }),
    ],
    subtotal: 2080.4,
    gst: 312.06,
    total: 2392.46,
  });
}

describe("validateSupplierQuote", () => {
  it("passes a correct ITM quote and recomputes the totals", () => {
    const report = validateSupplierQuote(cleanItmQuote());

    expect(report.severity).toBe("ok");
    expect(report.blocking).toBe(false);
    expect(report.recomputed.subtotal).toBe(2080.4);
    expect(report.recomputed.gst).toBe(312.06);
    expect(report.recomputed.total).toBe(2392.46);
    expect(report.lines.every((l) => l.severity === "ok")).toBe(true);
  });

  it("flags an OCR-misread line total and blocks", () => {
    const quote = cleanItmQuote();
    // OCR read 313.60 as 813.60 on the joist line — qty × price is 313.60.
    quote.items[1].source_line_total = 813.6;

    const report = validateSupplierQuote(quote);

    expect(report.blocking).toBe(true);
    expect(report.severity).toBe("error");
    const joist = report.lines[1];
    expect(joist.severity).toBe("error");
    expect(joist.checks[0].field).toBe("line_total");
    expect(joist.checks[0].expected).toBe(313.6);
    expect(joist.checks[0].found).toBe(813.6);
    expect(joist.checks[0].reason).toMatch(/≠ qty × unit price/);
  });

  it("warns (does not block) when a line is missing qty or unit price", () => {
    const report = validateSupplierQuote(
      extraction({
        items: [
          item({
            name: "Mystery bracket",
            unit: "each",
            price: null,
            quantity: 4,
          }),
        ],
        // no printed summary → those become warnings too, never errors
      }),
    );

    expect(report.blocking).toBe(false);
    expect(report.severity).toBe("warning");
    expect(report.lines[0].checks[0].reason).toMatch(/Missing quantity or unit price/);
  });

  it("blocks when the printed subtotal doesn't match the line totals", () => {
    const quote = cleanItmQuote();
    quote.subtotal = 1999.99; // wrong — lines sum to 2080.40

    const report = validateSupplierQuote(quote);

    expect(report.blocking).toBe(true);
    const subtotalCheck = report.summary.find((c) => c.field === "subtotal");
    expect(subtotalCheck?.severity).toBe("error");
    expect(subtotalCheck?.expected).toBe(2080.4);
    expect(subtotalCheck?.found).toBe(1999.99);
  });

  it("blocks when the printed grand total doesn't match subtotal + GST", () => {
    const quote = cleanItmQuote();
    quote.total = 2500; // wrong — should be 2392.46

    const report = validateSupplierQuote(quote);

    expect(report.blocking).toBe(true);
    const totalCheck = report.summary.find((c) => c.field === "total");
    expect(totalCheck?.severity).toBe("error");
    expect(totalCheck?.expected).toBe(2392.46);
  });
});

describe("validateSupplierQuote — phase 2 (status + freight/discount)", () => {
  it("exposes reconciliation_status=ok with no reasons for a clean quote", () => {
    const r = validateSupplierQuote(cleanItmQuote());
    expect(r.reconciliation_status).toBe("ok");
    expect(r.reconciliation_reasons).toHaveLength(0);
  });

  it("maps an error to reconciliation_status=blocked with reasons", () => {
    const q = cleanItmQuote();
    q.subtotal = 1999.99;
    const r = validateSupplierQuote(q);
    expect(r.reconciliation_status).toBe("blocked");
    expect(r.reconciliation_reasons.join(" ")).toMatch(/subtotal/i);
  });

  it("maps a missing-field warning to reconciliation_status=needs_review", () => {
    const r = validateSupplierQuote(
      extraction({ items: [item({ name: "Sundries", price: null, quantity: 4 })] }),
    );
    expect(r.reconciliation_status).toBe("needs_review");
  });

  it("GST-inclusive quote reconciles without a false GST error", () => {
    // Inclusive: subtotal is the GST-inclusive figure, gst the embedded
    // portion (1150 − 1150/1.15 = 150), total = subtotal.
    const r = validateSupplierQuote(
      extraction({
        gst_inclusive: true,
        items: [
          item({ name: "Decking", unit: "m", price: 11.5, quantity: 100, source_line_total: 1150 }),
        ],
        subtotal: 1150,
        gst: 150,
        total: 1150,
      }),
    );
    expect(r.summary.find((c) => c.field === "gst")?.severity).not.toBe("error");
    expect(r.reconciliation_status).not.toBe("blocked");
  });

  it("folds freight into the expected total so a freight quote doesn't falsely fail", () => {
    // net = 500 + 50 freight = 550; gst = 82.5; total = 632.5.
    // Without freight-awareness the expected total would be 575 → false block.
    const r = validateSupplierQuote(
      extraction({
        items: [
          item({ name: "Timber", unit: "m", price: 50, quantity: 10, source_line_total: 500 }),
        ],
        subtotal: 500,
        freight: 50,
        gst: 82.5,
        total: 632.5,
      }),
    );
    expect(r.summary.find((c) => c.field === "total")?.severity).toBe("ok");
    expect(r.blocking).toBe(false);
    expect(r.reconciliation_status).toBe("ok");
  });

  it("applies a discount to the expected total", () => {
    // net = 1000 − 100 discount = 900; gst = 135; total = 1035.
    const r = validateSupplierQuote(
      extraction({
        items: [
          item({ name: "Board", unit: "m", price: 100, quantity: 10, source_line_total: 1000 }),
        ],
        subtotal: 1000,
        discount: 100,
        gst: 135,
        total: 1035,
      }),
    );
    expect(r.summary.find((c) => c.field === "total")?.severity).toBe("ok");
    expect(r.reconciliation_status).toBe("ok");
  });
});
