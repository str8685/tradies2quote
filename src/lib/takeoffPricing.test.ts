import { describe, expect, it } from "vitest";
import { calculateDeckTakeoff, calculateMaterialTakeoff } from "./materialCalculator";
import { computeQuoteTotals } from "./quote-defaults";

// Product rule: plan-driven takeoff is a MATERIAL COUNT, not a priced quote.
// The deterministic calculators emit quantities/units/categories ONLY — they
// carry no price field at all — and quote totals derive solely from
// (quantity × unit_price), so blank prices ⇒ $0 totals until manual entry.

describe("deterministic takeoff is count-only (no embedded pricing)", () => {
  it("wall takeoff lines carry quantity/unit/category but NO price field", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 24,
      exteriorWallLengthM: 12,
      wallHeightM: 2.4,
      includeInsulation: true,
    });
    expect(r.materials.length).toBeGreaterThan(0);
    for (const line of r.materials) {
      expect(line.quantity).toBeGreaterThan(0);
      expect(typeof line.unit).toBe("string");
      expect(typeof line.category).toBe("string");
      // No pricing baked into the takeoff.
      expect(line).not.toHaveProperty("unit_price");
      expect(line).not.toHaveProperty("price");
      expect(line).not.toHaveProperty("line_total");
    }
  });

  it("deck takeoff lines also carry no price field", () => {
    const r = calculateDeckTakeoff({ deckLengthM: 6, deckWidthM: 4 });
    expect(r.materials.length).toBeGreaterThan(0);
    for (const line of r.materials) {
      expect(line).not.toHaveProperty("unit_price");
      expect(line).not.toHaveProperty("price");
      expect(line).not.toHaveProperty("line_total");
    }
  });
});

describe("totals derive only from manually-entered prices", () => {
  const lines = [
    { type: "material", quantity: 12, unit_price: 0 },
    { type: "material", quantity: 30, unit_price: 0 },
  ];

  it("blank prices ⇒ $0 totals (no auto-priced quote)", () => {
    const t = computeQuoteTotals(lines, 15, 15);
    expect(t.materials_subtotal).toBe(0);
    expect(t.markup_amount).toBe(0);
    expect(t.tax_amount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("a manually-entered price flows into the total (and only then)", () => {
    const priced = [
      { type: "material", quantity: 10, unit_price: 5 }, // tradie typed $5
      { type: "material", quantity: 30, unit_price: 0 },
    ];
    const t = computeQuoteTotals(priced, 0, 0);
    expect(t.materials_subtotal).toBe(50);
    expect(t.total).toBe(50);
  });
});
