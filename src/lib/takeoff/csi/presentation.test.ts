import { describe, expect, it } from "vitest";
import { CSI_DIVISION_LABEL, unitSummary } from "./presentation";

describe("unitSummary — per-section quantity subtotal", () => {
  it("sums within a single unit", () => {
    expect(
      unitSummary([
        { unit: "ea", quantity: 4 },
        { unit: "ea", quantity: 8 },
      ]),
    ).toBe("12 ea");
  });

  it("keeps units separate (never sums across units)", () => {
    expect(
      unitSummary([
        { unit: "ea", quantity: 12 },
        { unit: "m", quantity: 340 },
        { unit: "m", quantity: 10 },
      ]),
    ).toBe("12 ea · 350 m");
  });

  it("ignores unit-less, zero, blocked-quantity, and null-quantity lines", () => {
    expect(
      unitSummary([
        { unit: "", quantity: 5 },
        { unit: "ea", quantity: 0 }, // blocked lines carry qty 0
        { unit: "ea", quantity: null },
        { unit: "ea", quantity: 3 },
      ]),
    ).toBe("3 ea");
  });

  it("returns empty string when nothing is safely summable", () => {
    expect(unitSummary([])).toBe("");
    expect(unitSummary([{ unit: null, quantity: 9 }])).toBe("");
  });

  it("formats fractional sums to 2dp, integers cleanly", () => {
    expect(unitSummary([{ unit: "m2", quantity: 1.5 }, { unit: "m2", quantity: 2.25 }])).toBe(
      "3.75 m2",
    );
  });

  it("labels every mapped division", () => {
    expect(CSI_DIVISION_LABEL["03_concrete"]).toMatch(/Division 03/);
    expect(CSI_DIVISION_LABEL["09_finishes"]).toMatch(/Division 09/);
  });
});
