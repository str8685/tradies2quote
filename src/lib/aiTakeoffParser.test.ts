import { describe, expect, it } from "vitest";
import {
  canRunCalculator,
  parseTakeoffDescription,
  type ParsedTakeoffResult,
} from "./aiTakeoffParser";
import {
  calculateMaterialTakeoff,
  type MaterialTakeoffInput,
} from "./materialCalculator";

/**
 * The parsed result is a discriminated union — TS needs the `type`
 * field to narrow `input`. These tests all hit the wall-framing path,
 * so this helper does the narrowing in one place.
 */
function wallInput(
  r: ParsedTakeoffResult,
): Partial<MaterialTakeoffInput> {
  if (r.type !== "wall") {
    throw new Error(`expected type="wall", got "${r.type}"`);
  }
  return r.input;
}

describe("parseTakeoffDescription", () => {
  it("extracts the canonical example", () => {
    const r = parseTakeoffDescription(
      "Replace GIB in a 4m wall, 2.4m high, GIB both sides, one door, pink batts, skirting.",
    );
    expect(wallInput(r).wallLengthM).toBe(4);
    expect(wallInput(r).wallHeightM).toBe(2.4);
    expect(wallInput(r).gibSides).toBe(2);
    expect(wallInput(r).numberOfDoors).toBe(1);
    expect(wallInput(r).includeInsulation).toBe(true);
    expect(wallInput(r).includeSkirting).toBe(true);
    expect(r.missingFields).toEqual([]);
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('extracts wall length from "wall length 5m"', () => {
    const r = parseTakeoffDescription("wall length 5m");
    expect(wallInput(r).wallLengthM).toBe(5);
  });

  it('extracts wall length from "5 metre wall"', () => {
    const r = parseTakeoffDescription("5 metre wall, GIB both sides");
    expect(wallInput(r).wallLengthM).toBe(5);
  });

  it("extracts stud spacing 600mm centres", () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, 600mm centres, both sides",
    );
    expect(wallInput(r).studSpacingMm).toBe(600);
  });

  it("extracts stud spacing 400 centres", () => {
    const r = parseTakeoffDescription(
      "3m wall, 2.4m high, 400 centres, both sides",
    );
    expect(wallInput(r).studSpacingMm).toBe(400);
  });

  it('extracts windows from "two windows"', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, two windows, both sides",
    );
    expect(wallInput(r).numberOfWindows).toBe(2);
  });

  it('extracts gibSides=1 from "GIB one side"', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, GIB one side only",
    );
    expect(wallInput(r).gibSides).toBe(1);
  });

  it('extracts gibSides=2 from "two sides"', () => {
    const r = parseTakeoffDescription("4m wall, 2.4m high, two sides");
    expect(wallInput(r).gibSides).toBe(2);
  });

  it('handles "no insulation" → false', () => {
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, both sides, no insulation",
    );
    expect(wallInput(r).includeInsulation).toBe(false);
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
    expect(wallInput(r).wallHeightM).toBe(2.4);
    expect(r.assumptions).toContain("Used default wall height of 2.4m.");
    expect(r.missingFields).not.toContain("Wall height.");
  });

  it("does NOT default when applyDefaults is false", () => {
    const r = parseTakeoffDescription("4m wall, both sides", {
      applyDefaults: false,
    });
    expect(wallInput(r).wallHeightM).toBeUndefined();
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

describe("detectTakeoffType + per-type parsers", () => {
  it("voice 'I'm doing a 6 by 3 deck' → deck, 6×3", async () => {
    const { detectTakeoffType } = await import("./aiTakeoffParser");
    expect(detectTakeoffType("I'm doing a 6 by 3 deck")).toBe("deck");
    const r = parseTakeoffDescription("I'm doing a 6 by 3 deck");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBe(6);
    expect(r.input.deckWidthM).toBe(3);
    expect(canRunCalculator(r)).toBe(true);
  });

  it("'build a 4m × 2m deck' → deck, 4×2", () => {
    const r = parseTakeoffDescription("build a 4m × 2m deck");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBe(4);
    expect(r.input.deckWidthM).toBe(2);
  });

  it("'decking 6 x 3' uses 'x' separator", () => {
    const r = parseTakeoffDescription("decking 6 x 3");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBe(6);
    expect(r.input.deckWidthM).toBe(3);
  });

  // Regression — Wave 42. The Whakamārama scan came back with
  // dimensions "4800 x 3820" (mm with the suffix dropped, the NZ
  // trade-drawing default). The old unit-optional regex treated
  // those bare numbers as metres and the calculator emitted ~8000
  // joists for a 4.8 m × 3.82 m deck. These cases lock the
  // unit-aware behaviour so it can't silently regress.
  it("'4800 x 3820' (NZ trade-drawing mm, no suffix) → 4.8 m × 3.82 m", () => {
    const r = parseTakeoffDescription("deck 4800 x 3820");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBeCloseTo(4.8, 3);
    expect(r.input.deckWidthM).toBeCloseTo(3.82, 3);
  });

  it("'4800mm x 3820mm' (explicit mm) → 4.8 m × 3.82 m", () => {
    const r = parseTakeoffDescription("deck 4800mm x 3820mm");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBeCloseTo(4.8, 3);
    expect(r.input.deckWidthM).toBeCloseTo(3.82, 3);
  });

  it("orders dimensions so length ≥ width regardless of input order", () => {
    const r = parseTakeoffDescription("3 by 6 deck");
    expect(r.type).toBe("deck");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.deckLengthM).toBe(6);
    expect(r.input.deckWidthM).toBe(3);
  });

  it("'no piles' sets includePiles=false", () => {
    const r = parseTakeoffDescription("6 by 3 deck, ground level, no piles");
    if (r.type !== "deck") throw new Error("not deck");
    expect(r.input.includePiles).toBe(false);
  });

  it("'cladding a 6m wall, 2.4m high' → cladding", () => {
    const r = parseTakeoffDescription(
      "Cladding a 6m wall, 2.4m high, no openings",
    );
    expect(r.type).toBe("cladding");
    if (r.type !== "cladding") throw new Error("not cladding");
    expect(r.input.wallLengthM).toBe(6);
    expect(r.input.wallHeightM).toBe(2.4);
    expect(canRunCalculator(r)).toBe(true);
  });

  it("'weatherboards on 12m wall, 2 windows' → cladding with openings", () => {
    const r = parseTakeoffDescription(
      "Weatherboards on 12m wall, 2.4m high, two windows",
    );
    expect(r.type).toBe("cladding");
    if (r.type !== "cladding") throw new Error("not cladding");
    expect(r.input.wallLengthM).toBe(12);
    expect(r.input.numberOfOpenings).toBe(2);
    // 2 windows × 1.44 m² = 2.88
    expect(r.input.openingAreaM2).toBeCloseTo(2.88, 2);
  });

  it("'8 by 6 subfloor' → subfloor 8×6", () => {
    const r = parseTakeoffDescription("8 by 6 subfloor");
    expect(r.type).toBe("subfloor");
    if (r.type !== "subfloor") throw new Error("not subfloor");
    expect(r.input.floorLengthM).toBe(8);
    expect(r.input.floorWidthM).toBe(6);
    expect(canRunCalculator(r)).toBe(true);
  });

  it("'floor framing 4×3' also detects subfloor", () => {
    const r = parseTakeoffDescription("Floor framing 4 × 3");
    expect(r.type).toBe("subfloor");
    if (r.type !== "subfloor") throw new Error("not subfloor");
    expect(r.input.floorLengthM).toBe(4);
    expect(r.input.floorWidthM).toBe(3);
  });

  it("ambiguous description with no clear job type → wall (legacy)", () => {
    const r = parseTakeoffDescription("4m of GIB, both sides");
    expect(r.type).toBe("wall");
  });

  it("'deck' wins over 'wall' when both keywords appear", () => {
    const r = parseTakeoffDescription("6 by 3 deck against the back wall");
    expect(r.type).toBe("deck");
  });

  it("'subfloor' wins over 'deck' when both appear", () => {
    const r = parseTakeoffDescription(
      "8 by 6 subfloor — same as a deck structure",
    );
    expect(r.type).toBe("subfloor");
  });

  it("'cladding' wins over 'wall' when both appear", () => {
    const r = parseTakeoffDescription("cladding the 6m wall");
    expect(r.type).toBe("cladding");
  });
});

describe("runTakeoff", () => {
  it("dispatches deck → deck calculator", async () => {
    const { runTakeoff } = await import("./aiTakeoffParser");
    const r = parseTakeoffDescription("6 by 3 deck");
    const result = runTakeoff(r);
    expect(result).not.toBeNull();
    // The deck calculator's specific signature: includes joist-hangers
    expect(
      result?.materials.some((m) => m.id === "joist-hangers"),
    ).toBe(true);
  });

  it("dispatches cladding → cladding calculator", async () => {
    const { runTakeoff } = await import("./aiTakeoffParser");
    const r = parseTakeoffDescription("cladding 6m wall, 2.4m high");
    const result = runTakeoff(r);
    expect(result).not.toBeNull();
    expect(
      result?.materials.some((m) => m.id === "cladding-boards"),
    ).toBe(true);
  });

  it("dispatches subfloor → subfloor calculator", async () => {
    const { runTakeoff } = await import("./aiTakeoffParser");
    const r = parseTakeoffDescription("8 by 6 subfloor");
    const result = runTakeoff(r);
    expect(result).not.toBeNull();
    expect(
      result?.materials.some((m) => m.id === "subfloor-joists"),
    ).toBe(true);
  });

  it("dispatches wall → wall calculator", async () => {
    const { runTakeoff } = await import("./aiTakeoffParser");
    const r = parseTakeoffDescription(
      "4m wall, 2.4m high, both sides GIB",
    );
    const result = runTakeoff(r);
    expect(result).not.toBeNull();
    expect(result?.materials.some((m) => m.id === "studs-90x45")).toBe(
      true,
    );
  });

  it("returns null when there's not enough to run", async () => {
    const { runTakeoff } = await import("./aiTakeoffParser");
    const r = parseTakeoffDescription("doing a deck job");
    expect(runTakeoff(r)).toBeNull();
  });
});

describe("canRunCalculator", () => {
  it("requires wallLengthM, wallHeightM, gibSides", () => {
    expect(
      canRunCalculator({
        type: "wall",
        input: {},
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(false);
    expect(
      canRunCalculator({
        type: "wall",
        input: { wallLengthM: 4, wallHeightM: 2.4 },
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(false);
    expect(
      canRunCalculator({
        type: "wall",
        input: { wallLengthM: 4, wallHeightM: 2.4, gibSides: 2 },
        missingFields: [],
        assumptions: [],
        confidence: 0,
      }),
    ).toBe(true);
  });
});
