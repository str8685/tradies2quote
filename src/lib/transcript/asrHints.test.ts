import { describe, expect, it } from "vitest";
import {
  STATIC_TRADE_VOCAB_PROMPT,
  buildAsrPrompt,
} from "./asrHints";
import type { VocabSet } from "./glossary";

describe("buildAsrPrompt", () => {
  it("falls back to the static prompt when there's no user vocab", () => {
    expect(buildAsrPrompt({ entries: [] })).toBe(STATIC_TRADE_VOCAB_PROMPT);
    expect(buildAsrPrompt(null)).toBe(STATIC_TRADE_VOCAB_PROMPT);
  });

  it("always includes the GIB / Pink Batts anchors", () => {
    const p = buildAsrPrompt({
      entries: [{ canonical: "Shadowclad", aliases: ["shadowclad"], type: "material", source: "materials_library" }],
    });
    expect(p).toContain("GIB");
    expect(p).toContain("Pink Batts");
    expect(p).toContain("Shadowclad");
  });

  it("prioritises the tradie's own history terms first", () => {
    const vocab: VocabSet = {
      entries: [
        { canonical: "SupplierTerm", aliases: [], type: "supplier", source: "supplier" },
        { canonical: "HistoryTerm", aliases: [], type: "material", source: "user_history" },
      ],
    };
    const p = buildAsrPrompt(vocab);
    expect(p.indexOf("HistoryTerm")).toBeLessThan(p.indexOf("SupplierTerm"));
  });

  it("respects the character budget", () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({
      canonical: `CustomMaterialNumber${i}`,
      aliases: [],
      type: "material" as const,
      source: "materials_library" as const,
    }));
    const p = buildAsrPrompt({ entries }, { maxChars: 400 });
    expect(p.length).toBeLessThanOrEqual(400);
  });
});
