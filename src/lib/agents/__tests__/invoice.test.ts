import { describe, it, expect } from "vitest";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { runInvoiceAgent } from "../invoice";

function makeQuote(over: Partial<QuoteData> = {}): QuoteData {
  return {
    client: {
      name: "Sarah K",
      address: "12 Beach Rd",
      email: "sarah@example.com",
      phone: null,
    },
    job_summary: "Bathroom reno",
    line_items: [
      {
        type: "labour",
        description: "Tiling install · 2 days",
        quantity: 16,
        unit: "hr",
        unit_price: 75,
        line_total: 1200,
      },
      {
        type: "material",
        description: "Floor tile 600x600 · 6 m²",
        quantity: 6,
        unit: "m²",
        unit_price: 90,
        line_total: 540,
      },
    ],
    materials_subtotal: 540,
    labour_subtotal: 1200,
    markup_pct: 0,
    markup_amount: 0,
    subtotal_before_tax: 1740,
    tax_amount: 261,
    total: 2001,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: 15,
    terms: "",
    notes: [],
    ...over,
  };
}

describe("runInvoiceAgent — happy path", () => {
  it("returns reason=ready for a completed quote with real numbers", () => {
    const out = runInvoiceAgent("completed", makeQuote());
    expect(out.reason).toBe("ready");
    expect(out.blockers).toEqual([]);
    expect(out.totalAmount).toBe(2001);
    expect(out.taxAmount).toBe(261);
    expect(out.subtotal).toBe(1740);
    expect(out.lineItemCount).toBe(2);
    expect(out.clientName).toBe("Sarah K");
    expect(out.currency).toBe("NZD");
  });

  it("preview invoice number is a placeholder (real number from RPC)", () => {
    const out = runInvoiceAgent("completed", makeQuote());
    expect(out.invoiceNumberPreview).toMatch(/^INV-/);
    expect(out.invoiceNumberPreview).not.toMatch(/[0-9A-F]{8}/);
  });

  it("dueDateIso is ~7 days from now", () => {
    const before = Date.now();
    const out = runInvoiceAgent("completed", makeQuote());
    const due = Date.parse(out.dueDateIso);
    const after = Date.now();
    expect(due - before).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 50);
    expect(due - after).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 50);
  });
});

describe("runInvoiceAgent — preconditions", () => {
  const NON_COMPLETED: QuoteStatus[] = [
    "draft",
    "sent",
    "viewed",
    "accepted",
    "declined",
    "expired",
    "scheduled",
    "in_progress",
  ];

  for (const s of NON_COMPLETED) {
    it(`reason=quote-not-completed for status=${s}`, () => {
      const out = runInvoiceAgent(s, makeQuote());
      expect(out.reason).toBe("quote-not-completed");
      expect(out.blockers.length).toBeGreaterThan(0);
      expect(out.blockers[0]).toMatch(/Mark the job complete/);
    });
  }

  it("reason=quote-missing-data for completed but zero total", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({ total: 0, subtotal_before_tax: 0, tax_amount: 0 }),
    );
    expect(out.reason).toBe("quote-missing-data");
    expect(out.blockers).toContainEqual(
      expect.stringMatching(/Quote total is 0/),
    );
  });

  it("reason=quote-missing-data for completed but zero line items", () => {
    const out = runInvoiceAgent("completed", makeQuote({ line_items: [] }));
    expect(out.reason).toBe("quote-missing-data");
    expect(out.blockers).toContainEqual(
      expect.stringMatching(/no line items/),
    );
  });

  it("null quoteData yields a clean blocker, no NaNs", () => {
    const out = runInvoiceAgent("completed", null);
    expect(out.reason).toBe("quote-missing-data");
    expect(Number.isFinite(out.totalAmount)).toBe(true);
    expect(out.totalAmount).toBe(0);
    expect(out.taxAmount).toBe(0);
    expect(out.subtotal).toBe(0);
    expect(out.lineItemCount).toBe(0);
    expect(out.clientName).toBeNull();
    expect(out.blockers.length).toBeGreaterThan(0);
  });
});

describe("runInvoiceAgent — currency + rounding", () => {
  it("defaults currency to NZD when missing", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({ currency: "" }),
    );
    expect(out.currency).toBe("NZD");
  });

  it("preserves explicit currency", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({ currency: "AUD" }),
    );
    expect(out.currency).toBe("AUD");
  });

  it("rounds to 2 decimals", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({
        total: 100.005,
        tax_amount: 13.045,
        subtotal_before_tax: 86.96,
      }),
    );
    expect(out.totalAmount).toBe(100.01);
    expect(out.taxAmount).toBe(13.05);
    expect(out.subtotal).toBe(86.96);
  });
});

describe("runInvoiceAgent — client name handling", () => {
  it("trims whitespace from client name", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({
        client: { name: "  Riki T  ", address: null, email: null, phone: null },
      }),
    );
    expect(out.clientName).toBe("Riki T");
  });

  it("empty client name becomes null", () => {
    const out = runInvoiceAgent(
      "completed",
      makeQuote({
        client: { name: "", address: null, email: null, phone: null },
      }),
    );
    expect(out.clientName).toBeNull();
  });
});
