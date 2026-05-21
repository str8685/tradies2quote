import { describe, expect, it } from "vitest";
import { looksLikeSupplierQuote, resolveDocumentType } from "./scanClassify";

// Text shaped like the Oregon Group / ITM "Estimate 5578382" when read back.
const ITM_QUOTE_TEXT = `Oregon Group ITM — Estimate 5578382
Customer O/N: KELLY BAIN
Code Description Qty Unit Price Extended
IN01290 Malthoid DPC 50mm x 20m 2.00 EA 10.91 21.82
NL03010 Screw bolt CSK galv 8 x 100 50.00 EA 0.64 32.00
TR05360 45 x 45 RAD H3.2 50.00 LM 4.49 224.50
Subtotal 6198.31
Tax (GST) 929.75
Total 7128.06`;

// A hand-drawn deck plan read back as dimensions — decimals, no quote words.
const DECK_DRAWING_TEXT = `6.0
4010
3820
1800
1650 cl of post holes
x12 post 125x125 @ 1.8 long
x6 140x45 bearers @ 4.8
Deck is 1220 high`;

describe("looksLikeSupplierQuote", () => {
  it("flags a printed supplier quote", () => {
    expect(looksLikeSupplierQuote(ITM_QUOTE_TEXT)).toBe(true);
  });

  it("does not flag a hand-drawn deck plan", () => {
    expect(looksLikeSupplierQuote(DECK_DRAWING_TEXT)).toBe(false);
  });

  it("ignores empty text", () => {
    expect(looksLikeSupplierQuote("")).toBe(false);
  });
});

describe("resolveDocumentType", () => {
  it("trusts the model when it says supplier_quote", () => {
    expect(resolveDocumentType("supplier_quote", DECK_DRAWING_TEXT)).toBe(
      "supplier_quote",
    );
  });

  it("overrides a mislabelled drawing using the text backstop", () => {
    // Model wrongly said "drawing", but the text is clearly a quote.
    expect(resolveDocumentType("drawing", ITM_QUOTE_TEXT)).toBe(
      "supplier_quote",
    );
  });

  it("leaves a genuine drawing as a drawing", () => {
    expect(resolveDocumentType("drawing", DECK_DRAWING_TEXT)).toBe("drawing");
  });

  it("defaults an unknown model value to drawing", () => {
    expect(resolveDocumentType(undefined, DECK_DRAWING_TEXT)).toBe("drawing");
  });
});
