import { describe, expect, it } from "vitest";
import { applyGlossaryCorrections, levenshtein } from "./glossaryCorrect";
import { GLOBAL_GLOSSARY, type VocabEntry, type VocabSet } from "./glossary";

const global: VocabSet = { entries: GLOBAL_GLOSSARY };

function withUser(extra: VocabEntry[]): VocabSet {
  return { entries: [...GLOBAL_GLOSSARY, ...extra] };
}

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("applyGlossaryCorrections — supplier names", () => {
  it("auto-applies a known supplier alias", () => {
    const r = applyGlossaryCorrections("Pick it up from place makers tomorrow", global);
    expect(r.cleanedText).toContain("from PlaceMakers tomorrow");
    const c = r.corrections.find((x) => x.after === "PlaceMakers");
    expect(c).toMatchObject({ before: "place makers", type: "supplier", source: "global" });
    expect(c!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("normalises casing of a canonical supplier name", () => {
    const r = applyGlossaryCorrections("get it from bunnings", global);
    expect(r.cleanedText).toContain("from Bunnings");
  });
});

describe("applyGlossaryCorrections — material / brand terms", () => {
  it("fixes a known brand misspelling", () => {
    const r = applyGlossaryCorrections("clad it in james hardy weatherboard", global);
    expect(r.cleanedText).toContain("James Hardie");
  });

  it("normalises a user library material's casing", () => {
    const r = applyGlossaryCorrections(
      "supply trendboard to the job",
      withUser([
        { canonical: "Trendboard", aliases: ["trendboard"], type: "material", source: "materials_library" },
      ]),
    );
    expect(r.cleanedText).toContain("supply Trendboard to the job");
    expect(r.corrections.find((c) => c.after === "Trendboard")?.source).toBe(
      "materials_library",
    );
  });

  it("auto-applies a trade-term misspelling without changing word form", () => {
    const r = applyGlossaryCorrections("put a dwong between the studs", global);
    expect(r.cleanedText).toContain("put a dwang between the studs");
  });
});

describe("applyGlossaryCorrections — numbers are preserved", () => {
  it("never alters free numbers / dimensions / prices", () => {
    const input = "12 sheets of GIB, 90x45 framing, R2.2 batts, $450 total";
    const r = applyGlossaryCorrections(input, global);
    expect(r.cleanedText).toContain("12 sheets");
    expect(r.cleanedText).toContain("90x45");
    expect(r.cleanedText).toContain("R2.2");
    expect(r.cleanedText).toContain("$450");
  });

  it("only changes a number via an explicit curated supplier alias", () => {
    const r = applyGlossaryCorrections("grab it from mitre ten", global);
    expect(r.cleanedText).toContain("from Mitre 10");
  });
});

describe("applyGlossaryCorrections — user custom vocabulary", () => {
  it("flags a novel mishear of a user term (does NOT auto-change it)", () => {
    const r = applyGlossaryCorrections(
      "the colourstel roof needs flashing",
      global,
    );
    // colourstel is NOT an exact alias of Coloursteel → flagged, not changed
    expect(r.cleanedText).toContain("colourstel");
    expect(r.clarifications.some((c) => c.question.includes("Coloursteel"))).toBe(true);
  });
});

describe("applyGlossaryCorrections — low-confidence / safety", () => {
  it("leaves a correctly-spelled plural alone (no corruption, no flag)", () => {
    const r = applyGlossaryCorrections("fix the studs and the joists", global);
    expect(r.cleanedText).toContain("studs");
    expect(r.cleanedText).toContain("joists");
    expect(r.clarifications).toHaveLength(0);
    expect(r.corrections).toHaveLength(0);
  });

  it("does not rewrite a common word that collides with a supplier", () => {
    // "item" must NOT become "ITM" (it was deliberately removed as an alias)
    const r = applyGlossaryCorrections("the next item on the list", global);
    expect(r.cleanedText).toBe("the next item on the list");
  });

  it("makes no changes against an empty vocabulary", () => {
    const r = applyGlossaryCorrections("place makers and james hardy", { entries: [] });
    expect(r.cleanedText).toBe("place makers and james hardy");
    expect(r.corrections).toHaveLength(0);
  });
});
