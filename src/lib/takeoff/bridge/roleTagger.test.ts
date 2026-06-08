import { describe, expect, it } from "vitest";
import { tagDimensionRole, tagDimensions } from "./roleTagger";

const raw = (raw_text: string, value_m: number) => ({ raw_text, value_m });

describe("tagDimensionRole — explicit role text only", () => {
  const cases: Array<[string, string]> = [
    ["Stud height 2.4m", "height"],
    ["Ceiling height", "height"],
    ["Wall height 2.7", "height"],
    ["Floor area 96 m²", "area"],
    ["Gross floor area", "area"],
    ["GFA 120", "area"],
    ["Perimeter 40m", "perimeter"],
    ["Exterior wall run", "perimeter"],
    ["Total wall length 24m", "length"],
    ["Total wall run", "length"],
    ["Wall run 18", "length"],
    ["Wall length 24", "length"],
    ["Overall length 8400", "building_length"],
    ["Building length", "building_length"],
    ["Overall width 6000", "building_width"],
    ["Building width", "building_width"],
  ];
  for (const [text, role] of cases) {
    it(`"${text}" → ${role}`, () => {
      expect(tagDimensionRole(raw(text, 5))?.role).toBe(role);
    });
  }

  it('"overall length" maps to building_length, NOT the wall-run length role', () => {
    expect(tagDimensionRole(raw("Overall length", 8.4))?.role).toBe("building_length");
  });

  it('"overall wall length" still reads as a wall run (length)', () => {
    expect(tagDimensionRole(raw("Overall wall length 24m", 24))?.role).toBe("length");
  });

  it("tags carry source = labelled-sheet-confirmed", () => {
    expect(tagDimensionRole(raw("Stud height", 2.4))?.source).toBe("labelled-sheet-confirmed");
  });
});

describe("tagDimensionRole — never guesses (→ user confirmation)", () => {
  it("bare value with no role text → null", () => {
    expect(tagDimensionRole(raw("3600", 3.6))).toBeNull();
  });

  it("bare 'Length:' / 'Width:' with no wall/overall qualifier → null", () => {
    expect(tagDimensionRole(raw("Length: 8400", 8.4))).toBeNull();
    expect(tagDimensionRole(raw("Width 6000", 6.0))).toBeNull();
  });

  it("room callouts → null (ambiguous about role)", () => {
    expect(tagDimensionRole(raw("Bed 1: 3.6 x 4.2", 3.6))).toBeNull();
  });

  it("zero / negative / non-finite values → null (never coerced)", () => {
    expect(tagDimensionRole(raw("Stud height", 0))).toBeNull();
    expect(tagDimensionRole(raw("Floor area", -5))).toBeNull();
    expect(tagDimensionRole(raw("Wall length", Number.NaN))).toBeNull();
  });

  it("empty text → null", () => {
    expect(tagDimensionRole(raw("", 5))).toBeNull();
  });
});

describe("tagDimensions — batch split into tagged / untagged", () => {
  it("separates confidently-tagged from confirmation-needed", () => {
    const { tagged, untagged } = tagDimensions([
      raw("Stud height 2.4", 2.4),
      raw("Wall length 24", 24),
      raw("3600", 3.6), // ambiguous
      raw("Overall length 8400", 8.4), // building dim (recognized, not a calc role)
    ]);
    expect(tagged.map((t) => t.role)).toEqual(["height", "length", "building_length"]);
    expect(untagged.map((u) => u.raw_text)).toEqual(["3600"]);
  });

  it("does not mutate input", () => {
    const dims = [raw("Stud height", 2.4)];
    const snap = JSON.stringify(dims);
    tagDimensions(dims);
    expect(JSON.stringify(dims)).toBe(snap);
  });
});
