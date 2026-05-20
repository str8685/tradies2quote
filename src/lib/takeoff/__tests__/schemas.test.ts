import { describe, expect, it } from "vitest";
import {
  parseExtractedExtraction,
  statusRank,
  worstStatus,
} from "../schemas";

describe("schemas — parseExtractedExtraction", () => {
  it("parses a valid LLM payload", () => {
    const raw = {
      confidence: 0.9,
      project_type: "deck",
      scope_type: "deck",
      sub_scopes: ["deck"],
      dimensions: { length_m: 4.8, width_m: 3 },
      openings: [],
      notes: ["something"],
      needs_clarification: [],
      source_basis: "llm",
    };
    const r = parseExtractedExtraction(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.scope_type).toBe("deck");
      expect(r.value.dimensions.length_m).toBe(4.8);
      expect(r.value.source_basis).toBe("llm");
    }
  });

  it("coerces missing scope_type to generic and reports it", () => {
    const r = parseExtractedExtraction({
      confidence: 0.5,
      dimensions: { length_m: 5 },
      openings: [],
      notes: [],
      needs_clarification: [],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects non-object input", () => {
    const r = parseExtractedExtraction(null);
    expect(r.ok).toBe(false);
  });

  it("treats string numbers as numbers, invalid strings as null", () => {
    const r = parseExtractedExtraction({
      confidence: 0.5,
      scope_type: "deck",
      dimensions: { length_m: "4.8", width_m: "not-a-number" },
      openings: [],
      notes: [],
      needs_clarification: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.dimensions.length_m).toBe(4.8);
      expect(r.value.dimensions.width_m).toBeNull();
    }
  });
});

describe("schemas — status ranking", () => {
  it("worstStatus picks the highest-rank status", () => {
    expect(worstStatus(["ok", "assumed", "needs_review"])).toBe("needs_review");
    expect(worstStatus(["ok", "ok"])).toBe("ok");
    expect(worstStatus(["blocked", "ok"])).toBe("blocked");
    expect(worstStatus([])).toBe("ok");
  });

  it("statusRank is monotonic", () => {
    expect(statusRank("ok")).toBeLessThan(statusRank("assumed"));
    expect(statusRank("assumed")).toBeLessThan(statusRank("needs_review"));
    expect(statusRank("needs_review")).toBeLessThan(statusRank("blocked"));
  });
});
