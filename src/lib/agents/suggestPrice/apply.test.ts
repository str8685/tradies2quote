import { describe, expect, it } from "vitest";
import { canSuggestPrice, normalizeSuggestedMaterial } from "./apply";
import type { QuoteLineItem } from "../../quote-types";

const li = (o: Partial<QuoteLineItem> = {}): QuoteLineItem => ({
  type: "material",
  description: "GIB 13mm",
  quantity: 10,
  unit: "sheet",
  unit_price: 0,
  line_total: 0,
  ...o,
});

describe("canSuggestPrice", () => {
  it("true for an unpriced material when the agent is enabled", () => {
    expect(canSuggestPrice(li({ is_missing_price: true }), true)).toBe(true);
    expect(canSuggestPrice(li({ unit_price: 0 }), true)).toBe(true);
  });

  it("false when the agent is disabled", () => {
    expect(canSuggestPrice(li({ is_missing_price: true }), false)).toBe(false);
  });

  it("false for a priced material", () => {
    expect(canSuggestPrice(li({ unit_price: 12, is_missing_price: false }), true)).toBe(false);
  });

  it("false for non-material lines", () => {
    expect(canSuggestPrice(li({ type: "labour", unit_price: 0 }), true)).toBe(false);
    expect(canSuggestPrice(li({ type: "other", unit_price: 0 }), true)).toBe(false);
  });

  it("false for a quantity-0 line (e.g. blocked takeoff)", () => {
    expect(canSuggestPrice(li({ quantity: 0, unit_price: 0 }), true)).toBe(false);
  });
});

describe("normalizeSuggestedMaterial", () => {
  it("returns a clean material row for valid input", () => {
    expect(normalizeSuggestedMaterial({ name: " GIB 13mm ", unit: "sheet", price: 24.399 })).toEqual({
      name: "GIB 13mm",
      unit: "sheet",
      default_unit_price: 24.4,
    });
  });

  it("defaults a missing/blank unit to 'each'", () => {
    expect(normalizeSuggestedMaterial({ name: "Screws", unit: "", price: 9 })?.unit).toBe("each");
    expect(normalizeSuggestedMaterial({ name: "Screws", price: 9 })?.unit).toBe("each");
  });

  it("rejects no-name or non-positive / non-finite price (never saves junk)", () => {
    expect(normalizeSuggestedMaterial({ name: "", price: 9 })).toBeNull();
    expect(normalizeSuggestedMaterial({ name: "X", price: 0 })).toBeNull();
    expect(normalizeSuggestedMaterial({ name: "X", price: -2 })).toBeNull();
    expect(normalizeSuggestedMaterial({ name: "X", price: Number.NaN })).toBeNull();
    expect(normalizeSuggestedMaterial({ name: "X", price: "abc" })).toBeNull();
  });
});
