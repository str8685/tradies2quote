import { describe, expect, it } from "vitest";
import {
  canRunCalculator,
  parseTakeoffDescription,
} from "./aiTakeoffParser";
import { calculateMaterialTakeoff } from "./materialCalculator";

describe("parseTakeoffDescription", () => {
  it("extracts the canonical example", () => {
    const r = parseTakeoffDescription(
      "Replace GIB in a 4m wall, 2.4m high, GIB both sides, one door, pink batts, skirting.",
    );
    expect(r.input.wallLengthM).toBe(4);
    expect(r.input.wallHeightM).toBe(2.4);
    expect(r.input.gibSides).toBe(2);
    expect(r.input.numberOfDoors).toBe(1);
    expect(r.input.includeInsulation).toBe(true);
    expect(r.input.includeSkirting).toBe(true);
    expect(r.missingFields).toEqual([]);
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('extracts wall length from "wall length 5m"', () => {
    const r = parseTakeoffDescription("wall length 5m");
    expect(r.input.wallLengthM).toBe(5);
  });

  it('extracts wall length from "5 metre wall"', () => {
    const r = parseTakeoffDescription("5 metre wall, GIB both sides");
    expect(r.input.wallLengthM).toBe(5);
  });

  it("extracts stud spacing 600mm centres", () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, 600mm centres, both sides",
    );
    expect(r.input.studSpacingMm).toBe(600);
  });

  it("extracts stud spacing 400 centres", () => {
    const r = parseTakeoffDescription(
      "3m wall, 2.4m high, 400 centres, both sides",
    );
    expect(r.input.studSpacingMm).toBe(400);
  });

  it('extracts windows from "two windows"', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, two windows, both sides",
    );
    expect(r.input.numberOfWindows).toBe(2);
  });

  it('extracts gibSides=1 from "GIB one side"', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, GIB one side only",
    );
    expect(r.input.gibSides).toBe(1);
  });

  it('extracts gibSides=2 from "two sides"', () => {
    const r = parseTakeoffDescription("4m wall, 2.4m high, two sides");
    expect(r.input.gibSides).toBe(2);
  });

  it('handles "no insulation" → false', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, both sides, no insulation",
    );
    expect(r.input.includeInsulation).toBe(false);
  });

  it("flags wallLength as missing when absent", () => {
    const r = parseTakeoffDescription("Just a quote with both sides GIB");
    expect(r.missingFields).toContain("Wall length.");
  });

  it("flags gibSides as missing when absent", () => {
    const r = parseTakeoffDescription("4m wall, 2.4m high");
    expect(r.missingFields).toContain("GIB one side or both sides?");
  });

  it("uses default wall height with assumption when missing", () => {
    const r = parseTakeoffDescription("4m wall, both sides");
    expect(r.input.wallHeightM).toBe(2.4);
    expect(r.assumptions).toContain("Used default wall height of 2.4m.");
    expect(r.missingFields).not.toContain("Wall height.");
  });

  it("does NOT default when applyDefaults is false", () => {
    const r = parseTakeoffDescription("4m wall, both sides", {
      applyDefaults: false,
    });
    expect(r.input.wallHeightM).toBeUndefined();
    expect(r.missingFields).toContain("Wall height.");
  });

  it("extracts waste percent from various phrasings", () => {
    expect(
      parseTakeoffDescription("4m wall, 2.4m high, both sides, 15% waste").input
        .wastePercent,
    ).toBe(15);
    expect(
      parseTakeoffDescription("4m wall, 2.4m high, both sides, waste 12%").input
        .wastePercent,
    ).toBe(12);
  });

  it("parsed inputs feed calculator and produce materials", () => {
    const r = parseTakeoffDescription(
      "Replace GIB in a 4m wall, 2.4m high, GIB both sides, one door, pink batts, skirting.",
    );
    expect(canRunCalculator(r)).toBe(true);
    const calc = calculateMaterialTakeoff(r.input as never);
    expect(calc.materials.find((m) => m.id === "studs-90x45")?.quantity).toBe(
      12,
    );
    // 4m wall with 1 door: net area 7.9272 m², GIB both sides with 10% waste ⇒ 7 sheets
    expect(calc.materials.find((m) => m.id === "gib-10mm")?.quantity).toBe(7);
    expect(
      calc.materials.find((m) => m.id === "skirting"),
    ).toBeTruthy();
    expect(
      calc.materials.find((m) => m.id === "pink-batts"),
    ).toBeTruthy();
  });
});

describe("canRunCalculator", () => {
  it("requires wallLengthM, wallHeightM, gibSides", () => {
    expect(
      canRunCalculator({
        input: {},
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(false);
    expect(
      canRunCalculator({
        input: { wallLengthM: 4, wallHeightM: 2.4 },
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(false);
    expect(
      canRunCalculator({
        input: { wallLengthM: 4, wallHeightM: 2.4, gibSides: 2 },
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(true);
  });
});
