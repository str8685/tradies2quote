import { describe, expect, it } from "vitest";
import {
  normaliseUnit,
  parseSupplierQuoteExtraction,
  toExGst,
} from "./quoteExtraction";

describe("normaliseUnit", () => {
  it("maps common merchant spellings to canonical units", () => {
    expect(normaliseUnit("ea")).toBe("each");
    expect(normaliseUnit("EACH")).toBe("each");
    expect(normaliseUnit("m2")).toBe("m²");
    expect(normaliseUnit("sqm")).toBe("m²");
    expect(normaliseUnit("lm")).toBe("m");
    expect(normaliseUnit("LGTH")).toBe("length");
  });

  it("defaults blank/non-string to each, passes through unknowns", () => {
    expect(normaliseUnit("")).toBe("each");
    expect(normaliseUnit(null)).toBe("each");
    expect(normaliseUnit("widget")).toBe("widget");
  });
});

describe("parseSupplierQuoteExtraction", () => {
  it("rejects a non-object payload", () => {
    expect(parseSupplierQuoteExtraction(null).ok).toBe(false);
    expect(parseSupplierQuoteExtraction("nope").ok).toBe(false);
  });

  it("parses a clean ITM-style payload", () => {
    const r = parseSupplierQuoteExtraction({
      supplier: "ITM",
      currency: "NZD",
      gst_inclusive: false,
      items: [
        { name: "90x45 H1.2 SG8 Pine", unit: "length", price: 12.5, sku: "TIM9045", confidence: 0.9 },
        { name: "Stainless decking screws 65mm", unit: "box", price: 48, sku: null, confidence: 0.8 },
      ],
      notes: ["bottom row was smudged"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplier).toBe("ITM");
    expect(r.value.items).toHaveLength(2);
    expect(r.value.items[0].name).toBe("90x45 H1.2 SG8 Pine");
    expect(r.value.notes).toContain("bottom row was smudged");
  });

  it("coerces '$1,234.50' price strings to numbers", () => {
    const r = parseSupplierQuoteExtraction({
      items: [{ name: "Sheet ply", unit: "sheet", price: "$1,234.50" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items[0].price).toBe(1234.5);
  });

  it("keeps a priceless row but with price null", () => {
    const r = parseSupplierQuoteExtraction({
      items: [{ name: "Custom flashing", unit: "each", price: "POA" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items[0].price).toBeNull();
  });

  it("drops rows with no name", () => {
    const r = parseSupplierQuoteExtraction({
      items: [{ name: "", unit: "each", price: 5 }, { unit: "m", price: 3 }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items).toHaveLength(0);
  });

  it("dedupes identical name+unit rows", () => {
    const r = parseSupplierQuoteExtraction({
      items: [
        { name: "GIB 13mm 2.4x1.2", unit: "sheet", price: 22 },
        { name: "gib 13mm 2.4x1.2", unit: "sheet", price: 22 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items).toHaveLength(1);
  });

  it("clamps confidence and defaults a missing one", () => {
    const r = parseSupplierQuoteExtraction({
      items: [
        { name: "A", unit: "each", price: 1, confidence: 5 },
        { name: "B", unit: "each", price: 1 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items[0].confidence).toBe(1);
    expect(r.value.items[1].confidence).toBe(0.6);
  });

  it("normalises negative prices to zero", () => {
    const r = parseSupplierQuoteExtraction({
      items: [{ name: "Weird", unit: "each", price: -10 }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items[0].price).toBe(0);
  });

  it("treats a non-boolean gst_inclusive as null", () => {
    const r = parseSupplierQuoteExtraction({ items: [], gst_inclusive: "yes" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.gst_inclusive).toBeNull();
  });
});

describe("toExGst", () => {
  it("strips GST when the price is inclusive", () => {
    expect(toExGst(115, true)).toBe(100);
  });
  it("leaves an exclusive price untouched", () => {
    expect(toExGst(100, false)).toBe(100);
  });
});
