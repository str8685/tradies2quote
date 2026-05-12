import { describe, it, expect } from "vitest";
import type { QuoteData } from "@/lib/quote-types";
import { runVariationAgent } from "../variation";

function baseQuote(over: Partial<QuoteData> = {}): QuoteData {
  return {
    client: {
      name: "Sarah K",
      address: "12 Beach Rd",
      email: null,
      phone: null,
    },
    job_summary: "Bathroom reno",
    line_items: [],
    materials_subtotal: 0,
    labour_subtotal: 0,
    markup_pct: 0,
    markup_amount: 0,
    subtotal_before_tax: 4000,
    tax_amount: 600,
    total: 4600,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: 15,
    terms: "",
    notes: [],
    ...over,
  };
}

describe("runVariationAgent — totals", () => {
  it("computes subtotal, tax, total, and newTotal correctly", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "Extra power point + reposition pendant",
      lines: [
        { description: "Extra power point install", quantity: 1, unit_price: 180 },
        { description: "Reposition pendant", quantity: 1, unit_price: 120 },
      ],
    });
    expect(draft.blockers).toEqual([]);
    expect(draft.variationSubtotal).toBe(300);
    expect(draft.variationTax).toBe(45);
    expect(draft.variationTotal).toBe(345);
    expect(draft.baseQuoteTotal).toBe(4600);
    expect(draft.newTotal).toBe(4945);
  });

  it("inherits currency + tax rate from the base quote", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote({ currency: "AUD", tax_rate: 10 }),
      reason: "test",
      lines: [{ description: "x", quantity: 1, unit_price: 100 }],
    });
    expect(draft.currency).toBe("AUD");
    expect(draft.taxRatePct).toBe(10);
    expect(draft.variationTax).toBe(10);
    expect(draft.variationTotal).toBe(110);
  });

  it("override taxRatePct beats base quote", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote({ tax_rate: 15 }),
      reason: "test",
      lines: [{ description: "x", quantity: 1, unit_price: 100 }],
      taxRatePct: 0,
    });
    expect(draft.taxRatePct).toBe(0);
    expect(draft.variationTax).toBe(0);
    expect(draft.variationTotal).toBe(100);
  });

  it("rounds line totals and the variation subtotal to 2 decimals", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "test",
      lines: [
        // 3 × 33.333 → 99.999 → round2(99.999) = 100.00
        { description: "x", quantity: 3, unit_price: 33.333 },
        // 1 × 0.005 → 0.005 → round2(0.005) = 0.01
        { description: "y", quantity: 1, unit_price: 0.005 },
      ],
    });
    expect(draft.variationSubtotal).toBe(100.01);
    expect(draft.variationTax).toBe(15.0); // 100.01 * 0.15 = 15.0015 → round2 = 15.00
    expect(draft.variationTotal).toBe(115.01);
  });

  it("base total NEVER mutates", () => {
    const base = baseQuote();
    const draft = runVariationAgent({
      baseQuote: base,
      reason: "test",
      lines: [{ description: "x", quantity: 1, unit_price: 999 }],
    });
    expect(base.total).toBe(4600); // unchanged
    expect(draft.baseQuoteTotal).toBe(4600); // pass-through value
    expect(draft.newTotal).toBeGreaterThan(4600);
  });
});

describe("runVariationAgent — blockers", () => {
  it("flags missing reason", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "   ",
      lines: [{ description: "x", quantity: 1, unit_price: 100 }],
    });
    expect(draft.blockers).toContain("Reason for the variation is empty.");
  });

  it("flags missing lines", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "ok",
      lines: [],
    });
    expect(draft.blockers).toContain(
      "Variation has no line items — add at least one row.",
    );
  });

  it("flags a line missing description", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "ok",
      lines: [{ description: "", quantity: 1, unit_price: 50 }],
    });
    expect(draft.blockers).toContain(
      "One of the variation lines is missing a description.",
    );
  });
});

describe("runVariationAgent — approval text", () => {
  it("addresses client by name + includes original vs new total", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote(),
      reason: "Extra wiring needed",
      lines: [{ description: "20m TPS wiring", quantity: 1, unit_price: 250 }],
    });
    expect(draft.approvalText).toContain("Hi Sarah K");
    expect(draft.approvalText).toContain("Extra wiring needed");
    expect(draft.approvalText).toContain("20m TPS wiring");
    expect(draft.approvalText).toContain("Original quote total:");
    expect(draft.approvalText).toContain("New total once approved:");
  });

  it("falls back to 'Client' when name is missing", () => {
    const draft = runVariationAgent({
      baseQuote: baseQuote({
        client: { name: "", address: null, email: null, phone: null },
      }),
      reason: "ok",
      lines: [{ description: "x", quantity: 1, unit_price: 100 }],
    });
    expect(draft.approvalText).toContain("Hi Client");
  });
});
