import { describe, expect, it } from "vitest";
import { formatMemoriesForPrompt } from "./format";
import type { RankedMemory } from "./types";

function rm(p: Partial<RankedMemory> & Pick<RankedMemory, "memory_type">): RankedMemory {
  return {
    id: "m1",
    user_id: "u1",
    memory_key: "k",
    value: {},
    strength: 1,
    source: "manual_pref",
    provenance: {},
    status: "active",
    first_seen_at: "",
    last_seen_at: "",
    last_used_at: null,
    created_at: "",
    updated_at: "",
    confidence: "medium",
    score: 1,
    ...p,
  };
}

describe("formatMemoriesForPrompt", () => {
  it("returns an empty string when there's nothing to surface", () => {
    expect(formatMemoriesForPrompt([])).toBe("");
    expect(
      formatMemoriesForPrompt([rm({ memory_type: "quote_outcome" })]),
    ).toBe("");
  });

  it("renders advisory lines with confidence tags and an advisory header", () => {
    const out = formatMemoriesForPrompt([
      rm({
        memory_type: "preferred_material",
        confidence: "high",
        value: { name: "90x45 framing", unit: "LM", unit_price: 6.5 },
      }),
      rm({
        memory_type: "pricing_habit",
        confidence: "medium",
        value: { markup_pct: 18 },
      }),
    ]);
    expect(out).toContain("advisory only");
    expect(out).toContain('- (high) Usually prices "90x45 framing" around $6.5/LM');
    expect(out).toContain("- (medium) Typical markup ~18%");
  });
});
