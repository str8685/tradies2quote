import { describe, expect, it } from "vitest";
import {
  assessQuoteTakeoffSafety,
  validateQuoteForSending,
} from "./quote-validation";
import type { QuoteData, QuoteLineItem } from "./quote-types";

function quote(items: QuoteLineItem[]): QuoteData {
  return {
    client: { name: "Bob Tester", email: "bob@example.com", address: null, contact: null },
    line_items: items,
    notes: [],
    terms: "",
  } as unknown as QuoteData;
}

const send = (qd: QuoteData, acknowledged = false) =>
  validateQuoteForSending({ status: "draft", total_amount: 0, quote_data: qd, acknowledged });

describe("send gate — smarter 'total must be > 0' (genuinely empty, not $0-priced)", () => {
  it("genuinely empty (no real quantities) is blocked as total_zero", () => {
    const r = send(quote([{ type: "material", description: "Studs", quantity: 0, unit: "lengths", unit_price: 0, line_total: 0 }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("total_zero");
  });

  it("real quantity at $0 price is NOT total_zero — it's an acknowledgeable unpriced warning", () => {
    const qd = quote([
      { type: "material", description: "90x45 SG8 Studs", quantity: 40, unit: "lengths", unit_price: 0, line_total: 0, is_missing_price: true },
    ]);
    const r = send(qd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_unconfirmed"); // unpriced warning, not total_zero / not blocked

    // Acknowledging the $0 warning lets the count-first draft send.
    const r2 = send(qd, true);
    expect(r2.ok).toBe(true);
  });
});

describe("send gate — blocked lines + recovery", () => {
  const blockedLine: QuoteLineItem = {
    type: "material",
    description: "framing takeoff — needs dimensions before it can be quoted",
    quantity: 0,
    unit: "each",
    unit_price: 0,
    line_total: 0,
    takeoff_status: "blocked",
    takeoff_flags: ["length_m is missing", "height_m is missing"],
  };

  it("a blocked 'needs dimensions' line hard-blocks sending", () => {
    const a = assessQuoteTakeoffSafety(quote([blockedLine]));
    expect(a.can_send).toBe(false);
    const r = send(quote([blockedLine]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_blocked");
  });

  it("recovery: converting the blocked line to a manual qty (status cleared) clears the hard block", () => {
    // This is the outcome of the manual-qty escape / recalculation in the editor.
    const recovered: QuoteLineItem = {
      ...blockedLine,
      quantity: 36,
      takeoff_status: undefined,
      takeoff_flags: [],
      is_calculated_takeoff: false,
      quantity_source: "user",
      quantity_confirmed: true,
    };
    const a = assessQuoteTakeoffSafety(quote([recovered]));
    expect(a.can_send).toBe(true); // no longer blocked
    // Still unpriced → acknowledgeable warning, not a hard block.
    const r = send(quote([recovered]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_unconfirmed");
    expect(send(quote([recovered]), true).ok).toBe(true);
  });
});
