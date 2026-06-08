import { describe, expect, it } from "vitest";
import {
  summariseFloorPlanEval,
  type FloorPlanEvalCase,
} from "./floorplan-metrics";

const mk = (
  id: string,
  e: Partial<FloorPlanEvalCase["expected"]>,
  a: Partial<FloorPlanEvalCase["actual"]>,
): FloorPlanEvalCase => ({
  id,
  expected: {
    sheet_type: "floor_plan",
    scale_ratio_denominator: 100,
    labelled_dims_m: [],
    wall_length_m: null,
    materials: {},
    expected_blocked: false,
    ...e,
  },
  actual: {
    sheet_type: "floor_plan",
    scale_ratio_denominator: 100,
    labelled_dims_m: [],
    wall_length_m: null,
    materials: {},
    blocked: false,
    no_guess_violations: 0,
    ...a,
  },
});

describe("summariseFloorPlanEval — metric shape & math", () => {
  it("classification + scale accuracy", () => {
    const s = summariseFloorPlanEval([
      mk("a", { sheet_type: "floor_plan" }, { sheet_type: "floor_plan" }),
      mk("b", { sheet_type: "floor_plan" }, { sheet_type: "unknown" }),
      mk("c", { scale_ratio_denominator: 50 }, { scale_ratio_denominator: 100 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.classificationAccuracy).toBeCloseTo(2 / 3);
    expect(s.scaleParseAccuracy).toBeCloseTo(2 / 3); // a,b match (100); c mismatches
  });

  it("both-null scale counts as a match (NTS handled, not penalised)", () => {
    const s = summariseFloorPlanEval([
      mk("nts", { scale_ratio_denominator: null }, { scale_ratio_denominator: null }),
    ]);
    expect(s.scaleParseAccuracy).toBe(1);
  });

  it("labelled-dim recall within tolerance", () => {
    const s = summariseFloorPlanEval([
      // expected 3 dims; actual finds 2 (8.4≈8.41 within 5%, 6.0 exact; 2.4 missing)
      mk("r", { labelled_dims_m: [8.4, 6.0, 2.4] }, { labelled_dims_m: [8.41, 6.0] }),
    ]);
    expect(s.labelledDimRecall).toBeCloseTo(2 / 3);
  });

  it("wall-length error % over cases with truth", () => {
    const s = summariseFloorPlanEval([
      mk("w", { wall_length_m: 40 }, { wall_length_m: 42 }), // 5% error
      mk("n", { wall_length_m: null }, { wall_length_m: 99 }), // ignored (no truth)
    ]);
    expect(s.wallLengthErrorPct).toBeCloseTo(0.05);
  });

  it("material error %: missing expected line counts as a full miss", () => {
    const s = summariseFloorPlanEval([
      mk("m", { materials: { studs: 100, gib: 20 } }, { materials: { studs: 105 } }),
      // studs: |105-100|/100 = 0.05 ; gib: missing → 1 ; mean = 0.525
    ]);
    expect(s.materialErrorPct).toBeCloseTo(0.525);
  });

  it("blocked material cases are excluded from material error", () => {
    const s = summariseFloorPlanEval([
      mk("b", { materials: { studs: 100 }, expected_blocked: true }, { blocked: true }),
    ]);
    expect(s.materialErrorPct).toBeNull();
  });

  it("blocked-vs-auto decision: correct / falseAuto / overBlock", () => {
    const s = summariseFloorPlanEval([
      mk("ok-auto", { expected_blocked: false }, { blocked: false }),
      mk("ok-block", { expected_blocked: true }, { blocked: true }),
      mk("false-auto", { expected_blocked: true }, { blocked: false }), // worst
      mk("over-block", { expected_blocked: false }, { blocked: true }),
    ]);
    expect(s.blockedDecision).toEqual({ correct: 2, falseAuto: 1, overBlock: 1 });
  });

  it("no-guess violations sum across cases", () => {
    const s = summariseFloorPlanEval([
      mk("a", {}, { no_guess_violations: 0 }),
      mk("b", {}, { no_guess_violations: 2 }),
    ]);
    expect(s.noGuessViolations).toBe(2);
  });

  it("empty case set is a clean baseline (no NaN)", () => {
    const s = summariseFloorPlanEval([]);
    expect(s).toMatchObject({
      total: 0,
      classificationAccuracy: 1,
      wallLengthErrorPct: null,
      materialErrorPct: null,
      noGuessViolations: 0,
    });
  });
});
