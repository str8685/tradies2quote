// ─────────────────────────────────────────────────────────────────────────
// P0 REGRESSION PACK — insulation exterior-only rule.
//
// Hard rules: insulation must be IMPOSSIBLE on interior-only walls, and
// IMPOSSIBLE without positive exterior-wall evidence (the tradie said
// "exterior walls", or the scan supplied exterior_wall_run_m). Missing
// evidence blocks with a clarification — it never guesses.
//
// Deterministic — no LLM. Runs in CI on every push.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { runTakeoff } from "../orchestrator";
import { runInsulationCalculator } from "../calculators/insulation";
import { extractFromText, detectWallKind } from "../extraction";
import { validateExtractionForScope } from "../validate";
import type { TakeoffResult } from "../schemas";

function insulationLines(result: TakeoffResult) {
  return result.scopes
    .filter((s) => s.scope === "insulation")
    .flatMap((s) => s.lines);
}

function insulationScope(result: TakeoffResult) {
  return result.scopes.find((s) => s.scope === "insulation");
}

describe("P0 regression — interior-only walls produce ZERO insulation", () => {
  const INTERIOR_JOBS = [
    "Insulate the internal partition walls, 10m long and 2.4m high",
    "Frame and insulate an interior wall 4m x 2.4m with batts",
    "Add pink batts to the dividing wall between the rooms, 6m x 2.4m",
  ];
  for (const text of INTERIOR_JOBS) {
    it(`blocked, zero lines: "${text.slice(0, 50)}…"`, () => {
      const result = runTakeoff(text);
      expect(insulationLines(result)).toEqual([]);
      const scope = insulationScope(result);
      expect(scope?.status).toBe("blocked");
      expect(
        scope?.warnings.join(" "),
      ).toMatch(/exterior walls only/i);
    });
  }
});

describe("P0 regression — unknown walls block with a clarification (never guess)", () => {
  const UNKNOWN_JOBS = [
    "Insulate the walls, 10m long and 2.4m high",
    "Supply and fit R2.2 batts to the garage walls 8m x 2.4m",
  ];
  for (const text of UNKNOWN_JOBS) {
    it(`blocked + exterior question: "${text.slice(0, 50)}…"`, () => {
      const result = runTakeoff(text);
      expect(insulationLines(result)).toEqual([]);
      expect(insulationScope(result)?.status).toBe("blocked");
      const q = result.clarifications.find(
        (c) => c.scope === "insulation" && c.field === "wall_kind",
      );
      expect(q, "exterior-wall clarification must be asked").toBeDefined();
      expect(q!.blocking).toBe(true);
    });
  }
});

describe("P0 regression — exterior evidence calculates correctly", () => {
  it('stated exterior walls with area: "insulate the exterior walls, 24 m²" → 3 packs', () => {
    const result = runTakeoff(
      "Insulate the exterior walls, 24 m² of wall area",
    );
    const lines = insulationLines(result);
    expect(lines.length).toBe(1);
    // 24 × 1.05 / 8.8 = 2.86 → ceil = 3 packs.
    expect(lines[0].quantity).toBe(3);
    expect(lines[0].explanation).toMatch(/exterior/i);
    expect(insulationScope(result)?.status).not.toBe("blocked");
  });

  it("exterior_wall_run_m sizes off run × height, ignoring larger prose dims", () => {
    const ext = extractFromText(
      "insulate the exterior walls of the house",
      "insulation",
    );
    ext.exterior_wall_run_m = 20;
    ext.dimensions.height_m = 2.4;
    ext.dimensions.length_m = 48; // total run — must NOT be the basis
    const validation = validateExtractionForScope(ext, "insulation");
    expect(validation.status).not.toBe("blocked");
    const scope = runInsulationCalculator(ext);
    // 20 × 2.4 = 48 m²; 48 × 1.05 / 8.8 = 5.7 → 6 packs (NOT sized off 48m run).
    expect(scope.lines[0].quantity).toBe(6);
    expect(scope.lines[0].basis.inputs.exterior_wall_run_m).toBe(20);
  });

  it("scan marker exterior_wall_run_m flows through extraction", () => {
    const ext = extractFromText(
      "[T2Q_PLAN] wall_run_m=48 exterior_wall_run_m=20 height_m=2.4\ninsulate per plan",
      "insulation",
    );
    expect(ext.exterior_wall_run_m).toBe(20);
    const validation = validateExtractionForScope(ext, "insulation");
    expect(validation.status).not.toBe("blocked");
  });
});

describe("P0 regression — calculator gate is belt-and-braces (validate bypassed)", () => {
  it("calculator itself blocks interior walls", () => {
    const ext = extractFromText("insulate the wall 10m x 2.4m", "insulation");
    ext.wall_kind = "interior";
    const scope = runInsulationCalculator(ext);
    expect(scope.status).toBe("blocked");
    expect(scope.lines).toEqual([]);
  });
  it("calculator itself blocks unknown walls", () => {
    const ext = extractFromText("insulate the wall 10m x 2.4m", "insulation");
    ext.wall_kind = "unknown";
    const scope = runInsulationCalculator(ext);
    expect(scope.status).toBe("blocked");
    expect(scope.lines).toEqual([]);
  });
  it('calculator itself blocks "mixed" without an exterior run', () => {
    const ext = extractFromText(
      "insulate the exterior walls and the internal partitions 10m x 2.4m",
      "insulation",
    );
    expect(ext.wall_kind).toBe("mixed");
    const scope = runInsulationCalculator(ext);
    expect(scope.status).toBe("blocked");
    expect(scope.lines).toEqual([]);
  });
});

describe("P0 regression — wall-kind detection is statement-driven", () => {
  it("detects exterior / interior / mixed / unknown", () => {
    expect(detectWallKind("insulate the exterior walls")).toBe("exterior");
    expect(detectWallKind("insulate the external walls")).toBe("exterior");
    expect(detectWallKind("the perimeter walls need batts")).toBe("exterior");
    expect(detectWallKind("insulate the internal partition walls")).toBe("interior");
    expect(detectWallKind("line the partitions")).toBe("interior");
    expect(detectWallKind("insulate the walls")).toBe("unknown");
    expect(
      detectWallKind("exterior walls plus the internal walls"),
    ).toBe("mixed");
  });
});

describe("P0 regression — determinism", () => {
  it("same exterior input twice → identical result", () => {
    const text = "Insulate the exterior walls, 10m long and 2.4m high";
    expect(JSON.stringify(runTakeoff(text))).toBe(
      JSON.stringify(runTakeoff(text)),
    );
  });
});
