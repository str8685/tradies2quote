// ─────────────────────────────────────────────────────────────────────────
// QUOTE QA REGRESSION PACK — send-time totals integrity (deterministic).
//
// The send gate must hard-block any quote whose stored money fields don't
// equal what computeQuoteTotals derives from the line items right now. A
// customer must never see a total the lines don't add up to. Legacy
// tolerance: missing/non-finite stored fields are skipped (absence is
// never a block); present-but-wrong figures block.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import {
  assessQuoteTakeoffSafety,
  assessQuoteTotalsIntegrity,
  validateQuoteForSending,
} from "./quote-validation";
import { computeQuoteTotals } from "./quote-defaults";
import type { QuoteData, QuoteLineItem } from "./quote-types";

const li = (o: Partial<QuoteLineItem> = {}): QuoteLineItem => ({
  type: "material",
  description: "90x45 SG8 studs",
  quantity: 20,
  unit: "each",
  unit_price: 12.5,
  line_total: 250,
  ...o,
});

/** Build a quote whose totals are CORRECT by construction. */
function consistentQuote(
  items: QuoteLineItem[],
  markupPct = 10,
  taxRate = 15,
): QuoteData {
  const totals = computeQuoteTotals(items, markupPct, taxRate);
  return {
    client: { name: "Jane Tradie", address: null, email: "jane@example.com", phone: null },
    job_summary: "frame the wall",
    line_items: items,
    markup_pct: markupPct,
    ...totals,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: taxRate,
    terms: "",
    notes: [],
  };
}

const ITEMS = [
  li(),
  li({ type: "labour", description: "Install", quantity: 6, unit: "hours", unit_price: 95, line_total: 570 }),
];

describe("assessQuoteTotalsIntegrity — consistent quotes pass", () => {
  it("correct totals → no reasons", () => {
    expect(assessQuoteTotalsIntegrity(consistentQuote(ITEMS))).toEqual([]);
  });

  it("1-cent drift is tolerated (sub-cent float noise never false-blocks)", () => {
    const q = consistentQuote(ITEMS);
    q.total = q.total + 0.01;
    expect(assessQuoteTotalsIntegrity(q)).toEqual([]);
  });

  it("legacy quotes with missing money fields are skipped, not blocked", () => {
    const q = consistentQuote(ITEMS) as unknown as Record<string, unknown>;
    delete q.markup_amount;
    delete q.subtotal_before_tax;
    q.total = undefined;
    expect(assessQuoteTotalsIntegrity(q as unknown as QuoteData)).toEqual([]);
  });

  it("null quote_data → no reasons", () => {
    expect(assessQuoteTotalsIntegrity(null)).toEqual([]);
  });
});

describe("assessQuoteTotalsIntegrity — tampered figures hard-block", () => {
  it("wrong grand total blocks with both $ figures in the reason", () => {
    const q = consistentQuote(ITEMS);
    const want = q.total;
    q.total = q.total + 100;
    const reasons = assessQuoteTotalsIntegrity(q);
    expect(reasons.length).toBe(1);
    expect(reasons[0]).toContain(`$${(want + 100).toFixed(2)}`);
    expect(reasons[0]).toContain(`$${want.toFixed(2)}`);
    expect(reasons[0]).toMatch(/total/i);
  });

  it("wrong tax amount blocks", () => {
    const q = consistentQuote(ITEMS);
    q.tax_amount = q.tax_amount - 5;
    expect(assessQuoteTotalsIntegrity(q).join(" ")).toMatch(/GST amount/);
  });

  it("wrong markup amount blocks", () => {
    const q = consistentQuote(ITEMS);
    q.markup_amount = q.markup_amount + 1;
    expect(assessQuoteTotalsIntegrity(q).join(" ")).toMatch(/markup/i);
  });

  it("a line_total that isn't qty × unit_price blocks and names the line", () => {
    const q = consistentQuote([li({ line_total: 999 })], 0, 15);
    // Quote-level fields are correct for the REAL line value, so recompute
    // them off the true product to isolate the per-line check.
    const reasons = assessQuoteTotalsIntegrity(q);
    expect(reasons.join(" ")).toMatch(/line total/i);
    expect(reasons.join(" ")).toContain("90x45 SG8 studs");
  });

  it("a stale subtotal after a line edit blocks", () => {
    const q = consistentQuote(ITEMS);
    // Simulate an unknown writer bumping a quantity WITHOUT recomputing.
    q.line_items = [li({ quantity: 40, line_total: 500 }), ...q.line_items.slice(1)];
    const reasons = assessQuoteTotalsIntegrity(q);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.join(" ")).toMatch(/materials subtotal|total/i);
  });
});

describe("send gate wiring — integrity failures block the send", () => {
  it("assessQuoteTakeoffSafety carries integrity reasons as hard blocks", () => {
    const q = consistentQuote(ITEMS);
    q.total = q.total + 50;
    const safety = assessQuoteTakeoffSafety(q);
    expect(safety.can_send).toBe(false);
    expect(safety.block_reasons.join(" ")).toMatch(/doesn't match/);
  });

  it("validateQuoteForSending returns takeoff_blocked for a tampered total", () => {
    const q = consistentQuote(ITEMS);
    q.total = q.total + 50;
    const res = validateQuoteForSending({
      status: "draft",
      total_amount: q.total,
      quote_data: q,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("takeoff_blocked");
      expect((res.reasons ?? []).join(" ")).toMatch(/Re-save the quote/);
    }
  });

  it("a clean quote still sends (no regression)", () => {
    const res = validateQuoteForSending({
      status: "draft",
      total_amount: consistentQuote(ITEMS).total,
      quote_data: consistentQuote(ITEMS),
    });
    expect(res.ok).toBe(true);
  });
});
