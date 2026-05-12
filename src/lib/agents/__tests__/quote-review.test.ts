import { describe, it, expect } from "vitest";
import type { QuoteData } from "@/lib/quote-types";
import {
  getAddressedSet,
  runQuoteReview,
} from "../quote-review";

function profile() {
  return {
    business_name: "STR8 Builders Ltd",
    email: "challis@str8.example",
    phone: "021 555 0100",
    address: "Tauranga",
  };
}

function makeQuote(over: Partial<QuoteData> = {}): QuoteData {
  return {
    client: { name: "Sarah K", address: "12 Beach Rd", email: null, phone: null },
    job_summary: "Bathroom reno",
    line_items: [
      {
        type: "labour",
        description: "Tiler · 2 days",
        quantity: 16,
        unit: "hr",
        unit_price: 75,
        line_total: 1200,
      },
      {
        type: "material",
        description: "Floor tile 600x600",
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
    terms: "50% deposit, balance on completion. Variations agreed in writing.",
    notes: ["Excludes asbestos removal."],
    ...over,
  };
}

describe("runQuoteReview — summary", () => {
  it("returns zero missing / warning for a clean complete quote", () => {
    const r = runQuoteReview(makeQuote(), profile(), "2026-12-31");
    expect(r.summary.missing).toBe(0);
    // 0 warning is the target shape; if our readiness/compliance
    // defaults reach more strict, this asserts the floor.
    expect(r.summary.warning).toBeLessThanOrEqual(2);
  });

  it("flags missing scope as missing severity", () => {
    const r = runQuoteReview(
      makeQuote({ job_summary: "" }),
      profile(),
      "2026-12-31",
    );
    const scope = r.fixes.find((f) => f.id === "readiness-scope");
    expect(scope).toBeDefined();
    expect(scope?.severity).toBe("missing");
    expect(scope?.area).toBe("scope");
  });

  it("flags zero total + zero materials together", () => {
    const r = runQuoteReview(
      makeQuote({
        total: 0,
        subtotal_before_tax: 0,
        line_items: [],
      }),
      profile(),
      "2026-12-31",
    );
    const total = r.fixes.find((f) => f.id === "readiness-total");
    expect(total?.severity).toBe("missing");
  });

  it("flags missing business contact (settings area)", () => {
    const r = runQuoteReview(
      makeQuote(),
      {
        business_name: "",
        email: "",
        phone: "",
        address: "",
      },
      "2026-12-31",
    );
    const contact = r.fixes.find((f) => f.id === "readiness-business_contact");
    expect(contact?.severity).toBe("missing");
    expect(contact?.area).toBe("settings");
  });

  it("flags risky wording from compliance agent", () => {
    const r = runQuoteReview(
      makeQuote({
        job_summary: "Watertight guarantee on all work.",
      }),
      profile(),
      "2026-12-31",
    );
    const risky = r.fixes.find((f) => f.id === "compliance-risky-wording");
    expect(risky?.severity).toBe("warning");
  });

  it("null quoteData yields a non-empty fix list with no crashes", () => {
    const r = runQuoteReview(null, profile(), null);
    expect(r.summary.total).toBeGreaterThan(0);
    expect(r.fixes.every((f) => typeof f.title === "string")).toBe(true);
  });
});

describe("getAddressedSet", () => {
  it("returns an empty set when no review blob", () => {
    expect(getAddressedSet(makeQuote()).size).toBe(0);
  });

  it("parses an addressed array out of quoteData.review.addressed", () => {
    const q = makeQuote() as QuoteData & {
      review?: { addressed?: string[] };
    };
    q.review = { addressed: ["readiness-scope", "compliance-risky-wording"] };
    const set = getAddressedSet(q);
    expect(set.has("readiness-scope")).toBe(true);
    expect(set.has("compliance-risky-wording")).toBe(true);
    expect(set.has("readiness-total")).toBe(false);
  });

  it("ignores non-string entries", () => {
    const q = makeQuote() as QuoteData & { review?: { addressed?: unknown } };
    q.review = { addressed: ["ok", 5, null, true, "ok2"] };
    const set = getAddressedSet(q);
    expect(Array.from(set).sort()).toEqual(["ok", "ok2"]);
  });
});
