import { describe, expect, it } from "vitest";
import { evaluateCsiMapping, type CsiEvalCase } from "./eval";

// Unit test for the harness MATH itself (independent of the big fixture set).
describe("evaluateCsiMapping — summary math", () => {
  const cases: CsiEvalCase[] = [
    { description: "Concrete piles", expected: "03_concrete", line: { quantity_source: "calculator" } },
    { description: "90x45 SG8 studs", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
    { description: "Wall framing — needs dims", expected: "06_wood_plastics", line: { takeoff_status: "blocked" } },
    { description: "Sundries", expected: "uncategorized" },
    { description: "Quad mould", expected: "uncategorized", futureCandidate: true },
    { description: "Labour 8h", expected: "uncategorized", line: { type: "labour" } },
  ];

  const s = evaluateCsiMapping(cases);

  it("counts totals, divisions, uncategorized split, blocked", () => {
    expect(s.total).toBe(6);
    expect(s.byDivision["03_concrete"]).toBe(1);
    expect(s.byDivision["06_wood_plastics"]).toBe(2);
    expect(s.mapped).toBe(3);
    expect(s.uncategorized).toBe(3);
    expect(s.nonMaterial).toBe(1); // labour
    expect(s.manualReview).toBe(2); // Sundries + Quad mould
    expect(s.blocked).toBe(1);
  });

  it("accuracy is 1 when all labels match, with zero mismatches", () => {
    expect(s.accuracy).toBe(1);
    expect(s.mismatches).toEqual([]);
  });

  it("flags only explicit future candidates", () => {
    expect(s.futureCandidates).toEqual(["Quad mould"]);
  });

  it("records a mismatch when a label is wrong", () => {
    const bad = evaluateCsiMapping([
      { description: "Concrete piles", expected: "06_wood_plastics" },
    ]);
    expect(bad.accuracy).toBe(0);
    expect(bad.mismatches).toEqual([
      { description: "Concrete piles", expected: "06_wood_plastics", actual: "03_concrete" },
    ]);
  });

  it("empty case set is accuracy 1, all zero", () => {
    const e = evaluateCsiMapping([]);
    expect(e.total).toBe(0);
    expect(e.accuracy).toBe(1);
    expect(e.mapped).toBe(0);
  });
});
