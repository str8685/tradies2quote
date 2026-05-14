import { describe, it, expect } from "vitest";
import {
  detectForgottenCosts,
  FORGOTTEN_COST_DEFAULTS,
} from "../forgotten-costs";
import type { QuoteData, QuoteItemType, QuoteLineItem } from "@/lib/quote-types";

function line(
  type: QuoteItemType,
  description: string,
  lineTotal: number,
): QuoteLineItem {
  return {
    type,
    description,
    quantity: 1,
    unit: "ea",
    unit_price: lineTotal,
    line_total: lineTotal,
  };
}

function makeQuote(over: Partial<QuoteData>): QuoteData {
  return {
    client: { name: "Test Client", address: null, email: null, phone: null },
    job_summary: "",
    line_items: [],
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
    ...over,
  };
}

/** A typical kitchen-reno quote with nothing extra itemised. */
const renoQuote = makeQuote({
  job_summary: "Kitchen reno — rip out old cabinets, install new benchtop",
  line_items: [
    line("material", "New benchtop", 1200),
    line("labour", "Cabinet install + benchtop fit", 2000),
  ],
});

describe("detectForgottenCosts — empty / no-quote cases", () => {
  it("null quote → clean, nothing flagged", () => {
    expect(detectForgottenCosts(null)).toEqual({
      costs: [],
      totalEstimated: 0,
      clean: true,
    });
  });

  it("quote with no line items → clean", () => {
    const r = detectForgottenCosts(makeQuote({ job_summary: "rip out a wall" }));
    expect(r.clean).toBe(true);
    expect(r.costs).toEqual([]);
  });
});

describe("detectForgottenCosts — flags the usual suspects", () => {
  it("a reno quote flags disposal, consumables and travel", () => {
    const ids = detectForgottenCosts(renoQuote).costs.map((c) => c.id).sort();
    expect(ids).toEqual(["consumables", "disposal", "travel"]);
  });

  it("every flagged cost has a positive estimate and a basis string", () => {
    for (const c of detectForgottenCosts(renoQuote).costs) {
      expect(c.estimated).toBeGreaterThan(0);
      expect(typeof c.basis).toBe("string");
      expect(c.basis.length).toBeGreaterThan(0);
    }
  });

  it("totalEstimated equals the sum of the flagged estimates", () => {
    const r = detectForgottenCosts(renoQuote);
    const sum = r.costs.reduce((s, c) => s + c.estimated, 0);
    expect(r.totalEstimated).toBe(sum);
    expect(r.clean).toBe(false);
  });

  it("a paint job flags prep materials", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Repaint the lounge — two coats",
        line_items: [line("material", "Resene paint 10L", 165)],
      }),
    );
    expect(r.costs.map((c) => c.id)).toContain("prep_materials");
  });

  it("an exterior job flags a contingency buffer at ~10% of materials + labour", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Re-roof the house",
        line_items: [
          line("material", "Roofing iron", 2000),
          line("labour", "Strip and re-lay", 3000),
        ],
      }),
    );
    const contingency = r.costs.find((c) => c.id === "contingency");
    expect(contingency).toBeDefined();
    expect(contingency?.estimated).toBe(
      Math.round(5000 * FORGOTTEN_COST_DEFAULTS.contingencyPctOfJob),
    );
  });
});

describe("detectForgottenCosts — respects costs already on the quote", () => {
  it("does NOT flag disposal when a rubbish-removal line exists", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Rip out old kitchen",
        line_items: [
          line("material", "New cabinets", 1500),
          line("labour", "Rubbish removal + tip fees", 200),
        ],
      }),
    );
    expect(r.costs.map((c) => c.id)).not.toContain("disposal");
  });

  it("does NOT flag consumables when a fixings line exists", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Install shelving",
        line_items: [
          line("material", "Shelving + fixings and screws", 300),
          line("labour", "Install", 400),
        ],
      }),
    );
    expect(r.costs.map((c) => c.id)).not.toContain("consumables");
  });

  it("does NOT flag contingency when the notes mention a weather buffer", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Re-roof the house",
        line_items: [
          line("material", "Roofing iron", 2000),
          line("labour", "Strip and re-lay", 3000),
        ],
        notes: ["Includes a 10% weather contingency for rain delays."],
      }),
    );
    expect(r.costs.map((c) => c.id)).not.toContain("contingency");
  });

  it("a fully-covered indoor job comes back clean", () => {
    const r = detectForgottenCosts(
      makeQuote({
        job_summary: "Tighten a sticking interior door",
        line_items: [
          line("labour", "Adjust the door and hinges", 80),
          line("material", "Box of fixings and screws", 15),
          line("material", "Travel to site", 55),
        ],
      }),
    );
    expect(r.clean).toBe(true);
    expect(r.costs).toEqual([]);
  });
});
