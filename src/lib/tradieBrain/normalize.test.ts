import { describe, expect, it } from "vitest";
import {
  consolidate,
  deriveConfidence,
  normalizeMemoryKey,
  normalizeObservation,
  tokenize,
} from "./normalize";
import type { MemoryObservation } from "./types";

describe("tokenize", () => {
  it("lowercases, strips punctuation, drops stopwords", () => {
    expect(tokenize("90x45 H3.2 Framing, per LM")).toEqual([
      "90x45",
      "h3",
      "2",
      "framing",
      "lm",
    ]);
  });

  it("returns [] for empty / nullish input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
    // @ts-expect-error — defending against runtime nulls
    expect(tokenize(null)).toEqual([]);
  });
});

describe("normalizeMemoryKey", () => {
  it("collapses trivially different phrasings onto the same key", () => {
    const a = normalizeMemoryKey("preferred_material", "  90x45 H3.2 Framing ");
    const b = normalizeMemoryKey("preferred_material", "90X45 h3.2   framing");
    expect(a).toBe(b);
    expect(a).toBe("90x45 h3 2 framing");
  });

  it("is empty when nothing usable remains", () => {
    expect(normalizeMemoryKey("preferred_material", "")).toBe("");
    expect(normalizeMemoryKey("preferred_material", "the and of")).toBe("");
  });
});

describe("deriveConfidence", () => {
  it("maps strength to low / medium / high", () => {
    expect(deriveConfidence(1)).toBe("low");
    expect(deriveConfidence(2)).toBe("medium");
    expect(deriveConfidence(3)).toBe("medium");
    expect(deriveConfidence(4)).toBe("high");
    expect(deriveConfidence(99)).toBe("high");
  });

  it("treats junk as low", () => {
    expect(deriveConfidence(0)).toBe("low");
    expect(deriveConfidence(Number.NaN)).toBe("low");
  });
});

describe("normalizeObservation", () => {
  const good: MemoryObservation = {
    type: "preferred_material",
    key: "90x45 H3.2 Framing",
    value: { name: "90x45 H3.2 Framing", unit: "LM", unit_price: 6.5 },
    source: "manual_pref",
  };

  it("accepts a good observation and resolves the canonical key", () => {
    const out = normalizeObservation(good);
    expect(out).not.toBeNull();
    expect(out!.key).toBe("90x45 h3 2 framing");
  });

  it("rejects unknown type / source", () => {
    expect(
      normalizeObservation({ ...good, type: "nonsense" as never }),
    ).toBeNull();
    expect(
      normalizeObservation({ ...good, source: "nonsense" as never }),
    ).toBeNull();
  });

  it("rejects empty key and non-object value", () => {
    expect(normalizeObservation({ ...good, key: "   " })).toBeNull();
    expect(
      normalizeObservation({ ...good, value: [] as never }),
    ).toBeNull();
    expect(
      normalizeObservation({ ...good, value: null as never }),
    ).toBeNull();
  });
});

describe("consolidate", () => {
  it("increments strength, merges value, refreshes timestamps + source", () => {
    const existing = { strength: 2, value: { unit_price: 6.5, unit: "LM" } };
    const obs = normalizeObservation({
      type: "preferred_material",
      key: "90x45 framing",
      value: { unit_price: 7.2 },
      source: "material_correction",
      provenance: { quote_id: "q1", line_index: 3 },
    })!;
    const out = consolidate(existing, obs, "2026-05-23T00:00:00.000Z");
    expect(out.strength).toBe(3);
    // latest value wins per key; untouched keys survive
    expect(out.value).toEqual({ unit_price: 7.2, unit: "LM" });
    expect(out.source).toBe("material_correction");
    expect(out.provenance).toEqual({ quote_id: "q1", line_index: 3 });
    expect(out.last_seen_at).toBe("2026-05-23T00:00:00.000Z");
    expect(out.status).toBe("active");
  });

  it("reactivates an archived memory on re-observation", () => {
    const obs = normalizeObservation({
      type: "common_exclusion",
      key: "excludes scaffolding",
      value: { text: "Excludes scaffolding" },
      source: "saved_exclusion",
    })!;
    const out = consolidate({ strength: 1, value: {} }, obs, "2026-05-23T00:00:00.000Z");
    expect(out.status).toBe("active");
    expect(out.strength).toBe(2);
  });
});
