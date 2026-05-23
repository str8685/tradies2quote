import { describe, expect, it } from "vitest";
import type { QuoteData, QuoteLineItem } from "../quote-types";
import type { QuoteEditDiff } from "../quoteEditDiff";
import {
  deriveMemoriesFromQuoteSave,
  deriveMemoryFromAcceptedPrice,
  inferJobType,
} from "./derive";

function line(p: Partial<QuoteLineItem>): QuoteLineItem {
  return {
    type: "material",
    description: "",
    quantity: 1,
    unit: "each",
    unit_price: 0,
    line_total: 0,
    ...p,
  };
}

function qd(p: Partial<QuoteData>): QuoteData {
  return {
    client: { name: "Test", address: null, email: null, phone: null },
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
    ...p,
  };
}

const emptyDiff = (): QuoteEditDiff => ({
  summary: {
    ai_line_count: 0,
    user_line_count: 0,
    kept: 0,
    modified: 0,
    added: 0,
    removed: 0,
  },
  modified: [],
  added: [],
  removed: [],
  totals: { ai_total: 0, user_total: 0, ai_subtotal: 0, user_subtotal: 0 },
});

describe("inferJobType", () => {
  it("buckets common trades and returns null when nothing matches", () => {
    expect(inferJobType("Build a new deck out back")).toBe("deck");
    expect(inferJobType("Bathroom reno, retile")).toBe("bathroom");
    expect(inferJobType("Supply and fix GIB to garage")).toBe("gib_stopping");
    expect(inferJobType("misc handyman bits")).toBeNull();
    expect(inferJobType("")).toBeNull();
  });
});

describe("deriveMemoriesFromQuoteSave", () => {
  it("captures markup as a pricing habit", () => {
    const out = deriveMemoriesFromQuoteSave({
      quote: qd({ markup_pct: 18 }),
      quoteId: "q1",
    });
    const habit = out.find((m) => m.type === "pricing_habit");
    expect(habit).toMatchObject({
      key: "markup",
      value: { markup_pct: 18 },
      source: "manual_pref",
    });
  });

  it("captures every priced material line as a preferred material", () => {
    const out = deriveMemoriesFromQuoteSave({
      quote: qd({
        line_items: [
          line({ description: "90x45 H3.2 framing", unit: "LM", unit_price: 6.5 }),
          line({ type: "labour", description: "Carpenter", unit_price: 70 }),
          line({ description: "No price yet", unit_price: 0 }),
        ],
      }),
      quoteId: "q1",
    });
    const materials = out.filter((m) => m.type === "preferred_material");
    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({
      value: { name: "90x45 H3.2 framing", unit: "LM", unit_price: 6.5 },
      source: "manual_pref",
    });
  });

  it("tags a corrected material line as a material_correction and emits a repeated_correction", () => {
    const items = [
      line({ description: "90x45 H3.2 framing", unit: "LM", unit_price: 7.2 }),
    ];
    const diff: QuoteEditDiff = {
      ...emptyDiff(),
      modified: [
        {
          ai_index: 0,
          user_index: 0,
          match: "position",
          library_id: null,
          fields: [{ name: "unit_price", from: 6.5, to: 7.2 }],
        },
      ],
    };
    const out = deriveMemoriesFromQuoteSave({
      quote: qd({ line_items: items }),
      diff,
      quoteId: "q9",
    });

    const mat = out.find((m) => m.type === "preferred_material");
    expect(mat?.source).toBe("material_correction");

    const corr = out.find((m) => m.type === "repeated_correction");
    expect(corr).toMatchObject({
      key: "unit_price 90x45 H3.2 framing",
      value: { field: "unit_price", from: 6.5, to: 7.2 },
      source: "quote_edit",
      provenance: { quote_id: "q9", line_index: 0, before: 6.5, after: 7.2 },
    });
  });

  it("captures supplier, exclusions, and job type", () => {
    const out = deriveMemoriesFromQuoteSave({
      quote: qd({
        job_summary: "New deck and handrail",
        notes: [
          "Excludes scaffolding and council fees",
          "Price valid 30 days", // not an exclusion — should be ignored
        ],
        supplier_source: {
          supplier: "ITM Tauranga",
          subtotal: null,
          gst: null,
          total: null,
        },
      }),
      quoteId: "q2",
    });

    expect(out.find((m) => m.type === "preferred_supplier")).toMatchObject({
      value: { supplier: "ITM Tauranga" },
    });
    const exclusions = out.filter((m) => m.type === "common_exclusion");
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0].value).toMatchObject({
      text: "Excludes scaffolding and council fees",
    });
    expect(out.find((m) => m.type === "job_type_preference")).toMatchObject({
      value: { job_type: "deck" },
    });
  });

  it("prefers the deterministic takeoff_type over the summary for job type", () => {
    const out = deriveMemoriesFromQuoteSave({
      quote: qd({
        job_summary: "deck out back", // would infer "deck"
        dimension_confirmation: {
          required: true,
          reasons: ["no_scale"],
          takeoff_type: "cladding",
          dimensions: [],
        },
      }),
    });
    expect(out.find((m) => m.type === "job_type_preference")?.value).toMatchObject(
      { job_type: "cladding" },
    );
  });

  it("emits nothing for an empty quote with no edits", () => {
    expect(deriveMemoriesFromQuoteSave({ quote: qd({}) })).toEqual([]);
  });
});

describe("deriveMemoryFromAcceptedPrice", () => {
  it("emits a preferred material tagged accepted_suggested_price", () => {
    const out = deriveMemoryFromAcceptedPrice({
      name: "H3.2 90x45",
      unit: "LM",
      price: 6.9,
      quoteId: "q5",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "preferred_material",
      source: "accepted_suggested_price",
      value: { name: "H3.2 90x45", unit: "LM", unit_price: 6.9 },
    });
  });

  it("rejects junk (no name / non-positive price)", () => {
    expect(deriveMemoryFromAcceptedPrice({ name: "", unit: "LM", price: 5 })).toEqual([]);
    expect(
      deriveMemoryFromAcceptedPrice({ name: "x", unit: "LM", price: 0 }),
    ).toEqual([]);
  });
});
