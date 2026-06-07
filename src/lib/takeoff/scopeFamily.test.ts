import { describe, expect, it } from "vitest";
import {
  guardLinesForScope,
  isDeckFamilyLine,
  scopeFamilyForType,
} from "./scopeFamily";

describe("scopeFamilyForType", () => {
  it("maps types to families", () => {
    expect(scopeFamilyForType("deck")).toBe("deck");
    expect(scopeFamilyForType("subfloor")).toBe("subfloor");
    expect(scopeFamilyForType("wall")).toBe("building");
    expect(scopeFamilyForType("lining")).toBe("building");
    expect(scopeFamilyForType("insulation")).toBe("building");
    expect(scopeFamilyForType("unknown")).toBe("other");
  });
});

describe("isDeckFamilyLine — deck-only material names", () => {
  it("flags deck-calculator output lines", () => {
    for (const d of [
      "Deck joists (2 × 6m stock)",
      "Deck bearers (1 × 6m stock)",
      "Decking boards (90mm)",
      "Concrete piles",
      "Joist hangers",
      "Joist hanger nails",
      "Decking screws (stainless)",
    ]) {
      expect(isDeckFamilyLine({ description: d })).toBe(true);
    }
  });

  it("does NOT flag framing / GIB / insulation lines", () => {
    for (const w of ["90x45 SG8 Studs", "90x45 SG8 Plates", "90x45 SG8 Nogs", "10mm GIB Board", "Pink Batts Insulation", "GIB Screws"]) {
      expect(isDeckFamilyLine({ description: w })).toBe(false);
    }
  });

  it("flags by deck-only category too", () => {
    expect(isDeckFamilyLine({ description: "X", category: "Joists" })).toBe(true);
    expect(isDeckFamilyLine({ description: "X", category: "Framing" })).toBe(false);
  });
});

describe("guardLinesForScope — strips deck materials from non-deck jobs", () => {
  const wallLines = [
    { description: "90x45 SG8 Studs" },
    { description: "10mm GIB Board" },
    { description: "Pink Batts Insulation" },
  ];
  const deckLeak = [
    ...wallLines,
    { description: "Deck joists (2 × 6m stock)" },
    { description: "Concrete piles" },
  ];

  it("building family: drops deck-only lines, keeps framing/GIB/insulation", () => {
    const { kept, dropped } = guardLinesForScope(deckLeak, "building");
    expect(dropped.map((l) => l.description)).toEqual(["Deck joists (2 × 6m stock)", "Concrete piles"]);
    expect(kept.map((l) => l.description)).toEqual(["90x45 SG8 Studs", "10mm GIB Board", "Pink Batts Insulation"]);
  });

  it("deck family: keeps everything (deck job legitimately has them)", () => {
    expect(guardLinesForScope(deckLeak, "deck").dropped).toHaveLength(0);
  });

  it("subfloor family: keeps joists/bearers/piles (legitimate)", () => {
    expect(guardLinesForScope(deckLeak, "subfloor").dropped).toHaveLength(0);
  });

  it("a clean wall job is untouched (no false positives)", () => {
    const { kept, dropped } = guardLinesForScope(wallLines, "building");
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(3);
  });
});
