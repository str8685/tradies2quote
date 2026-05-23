import { describe, expect, it } from "vitest";
import { parseSuggestion, safeManualFallback } from "./parse";
import type { SuggestPriceTargetLine } from "./types";

const target: SuggestPriceTargetLine = {
  description: "140x45 H3.2 SG8 Pine",
  quantity: 19,
  unit: "length",
};

const valid = {
  recommendation: {
    status: "suggested",
    best_match_name: "140x45 H3.2 SG8 Pine",
    best_match_material_id: "mat-1",
    suggested_unit_price: 28.4,
    suggested_price_range_low: 27,
    suggested_price_range_high: 30,
    confidence: "high",
    should_save_mapping_if_accepted: true,
    recommended_action: "use_once",
  },
  reasoning: {
    summary: "Matches a recent accepted library line.",
    evidence_ranked: [
      { source_type: "library", source_label: "Your library", strength: "strong", note: "exact match" },
    ],
    risk_flags: [],
    missing_information: [],
  },
  alternatives: [
    { name: "140x45 H1.2 Pine", material_id: null, suggested_unit_price: 24, confidence: "medium", why_not_top_choice: "different treatment" },
  ],
};

describe("parseSuggestion — happy path", () => {
  const r = parseSuggestion(valid, target);

  it("returns a typed result, advisory_only always true", () => {
    expect(r.agent).toBe("suggest_a_price");
    expect(r.advisory_only).toBe(true);
    expect(r.recommendation.status).toBe("suggested");
    expect(r.recommendation.suggested_unit_price).toBe(28.4);
    expect(r.recommendation.currency).toBe("NZD");
  });

  it("fills target_line + ui_actions", () => {
    expect(r.target_line.description).toBe("140x45 H3.2 SG8 Pine");
    expect(r.ui_actions.primary).toMatch(/use/i);
    expect(r.ui_actions.secondary).toMatch(/library/i);
    expect(r.ui_actions.tertiary).toMatch(/manual/i);
  });
});

describe("parseSuggestion — safety + sanitisation", () => {
  it("forces advisory_only true even if the model says false", () => {
    const r = parseSuggestion({ ...valid, advisory_only: false }, target);
    expect(r.advisory_only).toBe(true);
  });

  it("never emits an action outside the safe set", () => {
    const r = parseSuggestion(
      { ...valid, recommendation: { ...valid.recommendation, recommended_action: "set_price" } },
      target,
    );
    expect(["use_once", "save_to_library", "ask_user", "manual_price"]).toContain(
      r.recommendation.recommended_action,
    );
  });

  it("falls back safely on a malformed payload", () => {
    for (const bad of [null, undefined, 42, "nope", {}, { recommendation: 5 }]) {
      const r = parseSuggestion(bad, target);
      expect(r.recommendation.status).toBe("no_safe_match");
      expect(r.recommendation.confidence).toBe("none");
      expect(r.recommendation.suggested_unit_price).toBeNull();
      expect(r.recommendation.recommended_action).toBe("manual_price");
      expect(r.advisory_only).toBe(true);
    }
  });

  it("nulls a non-positive / non-finite price and downgrades a priceless 'suggested'", () => {
    for (const p of [0, -5, Number.NaN, "abc"]) {
      const r = parseSuggestion(
        { ...valid, recommendation: { ...valid.recommendation, suggested_unit_price: p, suggested_price_range_low: null, suggested_price_range_high: null } },
        target,
      );
      expect(r.recommendation.suggested_unit_price).toBeNull();
      expect(r.recommendation.status).toBe("needs_manual_pricing");
    }
  });

  it("keeps 'suggested' when there's no point price but a valid range", () => {
    const r = parseSuggestion(
      { ...valid, recommendation: { ...valid.recommendation, suggested_unit_price: null, suggested_price_range_low: 25, suggested_price_range_high: 30 } },
      target,
    );
    expect(r.recommendation.status).toBe("suggested");
  });

  it("orders a reversed price range low <= high", () => {
    const r = parseSuggestion(
      { ...valid, recommendation: { ...valid.recommendation, suggested_price_range_low: 30, suggested_price_range_high: 25 } },
      target,
    );
    expect(r.recommendation.suggested_price_range_low).toBe(25);
    expect(r.recommendation.suggested_price_range_high).toBe(30);
  });

  it("defaults invalid enums to the conservative option", () => {
    const r = parseSuggestion(
      { ...valid, recommendation: { ...valid.recommendation, status: "bogus", confidence: "very", recommended_action: "x" } },
      target,
    );
    expect(r.recommendation.status).toBe("needs_manual_pricing");
    expect(r.recommendation.confidence).toBe("none");
    expect(r.recommendation.recommended_action).toBe("manual_price");
  });

  it("coerces should_save_mapping to a boolean and sanitises arrays", () => {
    const r = parseSuggestion(
      {
        ...valid,
        recommendation: { ...valid.recommendation, should_save_mapping_if_accepted: "yes" },
        reasoning: { summary: 5, evidence_ranked: "nope", risk_flags: [1, "ok"], missing_information: null },
        alternatives: "nope",
      },
      target,
    );
    expect(typeof r.recommendation.should_save_mapping_if_accepted).toBe("boolean");
    expect(Array.isArray(r.reasoning.evidence_ranked)).toBe(true);
    expect(Array.isArray(r.reasoning.risk_flags)).toBe(true);
    expect(r.reasoning.risk_flags.every((x) => typeof x === "string")).toBe(true);
    expect(Array.isArray(r.alternatives)).toBe(true);
  });
});

describe("safeManualFallback", () => {
  it("produces an advisory, no-price, manual result", () => {
    const r = safeManualFallback(target, "No internal evidence for this line.");
    expect(r.recommendation.status).toBe("needs_manual_pricing");
    expect(r.recommendation.suggested_unit_price).toBeNull();
    expect(r.recommendation.recommended_action).toBe("manual_price");
    expect(r.advisory_only).toBe(true);
    expect(r.reasoning.summary).toMatch(/no internal evidence/i);
  });
});
