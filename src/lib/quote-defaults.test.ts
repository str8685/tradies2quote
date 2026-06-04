import { describe, expect, it } from "vitest";
import {
  addGst,
  computeQuoteTotals,
  formatCurrency,
  gstInclusiveBreakdown,
  moneyEquals,
  round2,
  splitDisplaySubtotals,
} from "./quote-defaults";

// ─── round2 ──────────────────────────────────────────────────────────────
describe("round2", () => {
  it("rounds to 2 decimal places (half-up)", () => {
    expect(round2(49.975)).toBe(49.98);
    expect(round2(49.974)).toBe(49.97);
    expect(round2(0)).toBe(0);
    expect(round2(100)).toBe(100);
  });

  it("coerces non-finite input to 0", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ─── GST: add on top (ex → incl) ─────────────────────────────────────────
describe("addGst — GST applied on top of an ex-GST amount", () => {
  it("$3,380 + 15% GST = $3,887 (GST $507)", () => {
    const b = addGst(3380, 15);
    expect(b.exclusive).toBe(3380);
    expect(b.gst).toBe(507);
    expect(b.inclusive).toBe(3887);
    expect(b.rate).toBe(15);
  });

  it("zero amount → all zero", () => {
    expect(addGst(0, 15)).toEqual({
      exclusive: 0,
      gst: 0,
      inclusive: 0,
      rate: 15,
    });
  });

  it("defaults to the NZ 15% rate", () => {
    expect(addGst(100).inclusive).toBe(115);
  });

  it("rounds the GST portion to cents", () => {
    // 199.99 * 0.15 = 29.9985 → 30.00
    const b = addGst(199.99, 15);
    expect(b.gst).toBe(30);
    expect(b.inclusive).toBe(229.99);
  });
});

// ─── GST: decompose an inclusive amount (incl → ex) ──────────────────────
describe("gstInclusiveBreakdown — GST extracted from an inclusive amount", () => {
  it("$3,887 incl. GST → ex $3,380.00, GST $507.00 (exact inverse of 3380+15%)", () => {
    // NOTE: the brief listed ex $3,380.87 / GST $506.13 for this case, but that
    // is arithmetically wrong at 15% — 3380.87 + 506.13 implies a ~14.97% rate.
    // $3,887 / 1.15 = $3,380.00 exactly, GST $507.00. The helper is correct.
    const b = gstInclusiveBreakdown(3887, 15);
    expect(b.inclusive).toBe(3887);
    expect(b.exclusive).toBe(3380);
    expect(b.gst).toBe(507);
  });

  it("messy inclusive amount rounds cleanly: $100 incl. → ex $86.96, GST $13.04", () => {
    const b = gstInclusiveBreakdown(100, 15);
    expect(b.exclusive).toBe(86.96); // 100 / 1.15 = 86.9565…
    expect(b.gst).toBe(13.04);
    expect(round2(b.exclusive + b.gst)).toBe(100);
  });

  it("the ex + GST parts always re-sum to the inclusive total", () => {
    const b = gstInclusiveBreakdown(3887, 15);
    expect(round2(b.exclusive + b.gst)).toBe(b.inclusive);
  });

  it("zero amount → all zero", () => {
    const b = gstInclusiveBreakdown(0, 15);
    expect(b).toEqual({ inclusive: 0, exclusive: 0, gst: 0, rate: 15 });
  });
});

// ─── computeQuoteTotals — the single source of truth ─────────────────────
describe("computeQuoteTotals", () => {
  it("zero / empty line items → all totals zero", () => {
    const t = computeQuoteTotals([], 20, 15);
    expect(t).toEqual({
      materials_subtotal: 0,
      labour_subtotal: 0,
      markup_amount: 0,
      subtotal_before_tax: 0,
      tax_amount: 0,
      total: 0,
    });
  });

  it("$3,380 ex-GST single line, no markup, 15% GST → total $3,887", () => {
    const t = computeQuoteTotals(
      [{ type: "material", quantity: 1, unit_price: 3380 }],
      0,
      15,
    );
    expect(t.materials_subtotal).toBe(3380);
    expect(t.markup_amount).toBe(0);
    expect(t.subtotal_before_tax).toBe(3380);
    expect(t.tax_amount).toBe(507);
    expect(t.total).toBe(3887);
  });

  it("materials + labour + markup + GST end-to-end", () => {
    // materials 1000, labour 500, markup 20% (materials only), GST 15%
    const t = computeQuoteTotals(
      [
        { type: "material", quantity: 1, unit_price: 1000 },
        { type: "labour", quantity: 1, unit_price: 500 },
      ],
      20,
      15,
    );
    expect(t.materials_subtotal).toBe(1000);
    expect(t.labour_subtotal).toBe(500);
    expect(t.markup_amount).toBe(200); // 20% of materials only
    expect(t.subtotal_before_tax).toBe(1700); // 1000 + 200 + 500
    expect(t.tax_amount).toBe(255); // 15% of 1700
    expect(t.total).toBe(1955); // 1700 + 255
  });

  it("markup applies to materials + other, NOT labour", () => {
    const t = computeQuoteTotals(
      [
        { type: "material", quantity: 1, unit_price: 100 },
        { type: "other", quantity: 1, unit_price: 100 },
        { type: "labour", quantity: 1, unit_price: 100 },
      ],
      10,
      0,
    );
    // materials_subtotal bundles material + other = 200; markup = 10% of 200 = 20
    expect(t.materials_subtotal).toBe(200);
    expect(t.labour_subtotal).toBe(100);
    expect(t.markup_amount).toBe(20);
    expect(t.subtotal_before_tax).toBe(320);
  });

  it("uses SUM-OF-ROUNDED so visible lines tie out to the subtotal", () => {
    // 2.5 * 19.99 = 49.97499… (float) → each visible line rounds to 49.97.
    // Sum-of-rounded = 49.97 + 49.97 = 99.94 (what the line items add up to).
    // Round-of-sum would be round2(99.94999…) = 99.95 — the old mismatch bug.
    const t = computeQuoteTotals(
      [
        { type: "material", quantity: 2.5, unit_price: 19.99 },
        { type: "material", quantity: 2.5, unit_price: 19.99 },
      ],
      0,
      0,
    );
    expect(round2(2.5 * 19.99)).toBe(49.97); // each line as shown
    expect(t.materials_subtotal).toBe(99.94); // 49.97 + 49.97, ties out to lines
    expect(t.total).toBe(99.94);
    expect(round2(2.5 * 19.99 + 2.5 * 19.99)).toBe(99.95); // round-of-sum differs
  });

  it("decimal-quantity rounding stays at cents", () => {
    // 3 @ 33.333 = 99.999 → line rounds to 100.00
    const t = computeQuoteTotals(
      [{ type: "material", quantity: 3, unit_price: 33.333 }],
      0,
      15,
    );
    expect(t.materials_subtotal).toBe(100);
    expect(t.tax_amount).toBe(15);
    expect(t.total).toBe(115);
  });

  it("coerces missing / non-numeric quantities and prices to 0", () => {
    const t = computeQuoteTotals(
      [
        // @ts-expect-error — intentionally malformed input
        { type: "material", quantity: "abc", unit_price: 50 },
        { type: "material", quantity: 2, unit_price: undefined as unknown as number },
      ],
      20,
      15,
    );
    expect(t.total).toBe(0);
  });

  it("quote totals match a fresh add-GST of the same subtotal (review = invoice)", () => {
    const t = computeQuoteTotals(
      [
        { type: "material", quantity: 4, unit_price: 250 },
        { type: "labour", quantity: 10, unit_price: 75 },
      ],
      15,
      15,
    );
    // Independently re-derive incl. total from the ex-GST subtotal.
    const re = addGst(t.subtotal_before_tax, 15);
    expect(re.gst).toBe(t.tax_amount);
    expect(re.inclusive).toBe(t.total);
  });
});

// ─── splitDisplaySubtotals ───────────────────────────────────────────────
describe("splitDisplaySubtotals", () => {
  it("splits material vs other and ignores labour", () => {
    const split = splitDisplaySubtotals([
      { type: "material", line_total: 100 },
      { type: "other", line_total: 40 },
      { type: "labour", line_total: 500 },
    ]);
    expect(split).toEqual({ materials: 100, other: 40 });
  });

  it("falls back to quantity * unit_price when line_total is absent", () => {
    const split = splitDisplaySubtotals([
      { type: "material", quantity: 3, unit_price: 10 },
    ]);
    expect(split.materials).toBe(30);
  });
});

// ─── formatCurrency ──────────────────────────────────────────────────────
describe("formatCurrency", () => {
  it("formats NZD with two decimals", () => {
    expect(formatCurrency(3887, "NZD")).toBe("$3,887.00");
    expect(formatCurrency(3380.87, "NZD")).toBe("$3,380.87");
  });

  it("handles non-finite input as $0.00", () => {
    expect(formatCurrency(Number.NaN, "NZD")).toBe("$0.00");
  });
});

// ─── moneyEquals ─────────────────────────────────────────────────────────
describe("moneyEquals", () => {
  it("treats sub-cent differences as equal", () => {
    expect(moneyEquals(100.004, 100)).toBe(true);
    expect(moneyEquals(100.02, 100)).toBe(false);
  });
});
