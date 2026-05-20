import { describe, expect, it } from "vitest";
import { evaluateScope, evaluateTakeoff } from "../evaluate";
import type {
  ExtractedExtraction,
  ScopeResult,
  ScopeType,
  TakeoffLine,
} from "../schemas";

const baseExt = (o: Partial<ExtractedExtraction> = {}): ExtractedExtraction => ({
  confidence: 0.8,
  project_type: null,
  scope_type: "generic",
  sub_scopes: [],
  dimensions: {},
  openings: [],
  notes: [],
  needs_clarification: [],
  clarification_questions: [],
  source_basis: "manual",
  ...o,
});

const line = (o: Partial<TakeoffLine> = {}): TakeoffLine => ({
  id: "l1",
  name: "Material",
  category: "General",
  quantity: 10,
  unit: "each",
  status: "ok",
  basis: { formula: "", inputs: {}, assumed: [] },
  confidence: 0.9,
  assumption_flags: [],
  validation_flags: [],
  explanation: "",
  ...o,
});

const scope = (s: ScopeType, o: Partial<ScopeResult> = {}): ScopeResult => ({
  scope: s,
  status: "ok",
  summary: { primary_metric: "x", primary_value: 10, unit: "m²", inputs: {} },
  lines: [line()],
  warnings: [],
  assumptions: [],
  clarifications: [],
  explanation: "",
  ...o,
});

describe("evaluator — universal checks", () => {
  it("passes a clean scope", () => {
    const v = evaluateScope(scope("generic"), baseExt());
    expect(v.status).toBe("pass");
    expect(v.requires_manual_confirmation).toBe(false);
    expect(v.confidence).toBe(1);
  });

  it("fails a non-finite quantity (NaN)", () => {
    const v = evaluateScope(
      scope("generic", { lines: [line({ quantity: NaN })] }),
      baseExt(),
    );
    expect(v.status).toBe("fail");
    expect(v.requires_manual_confirmation).toBe(true);
    expect(v.reasons.some((r) => r.code === "nonfinite_quantity")).toBe(true);
  });

  it("fails a negative quantity", () => {
    const v = evaluateScope(
      scope("generic", { lines: [line({ quantity: -5 })] }),
      baseExt(),
    );
    expect(v.status).toBe("fail");
  });

  it("cautions a zero quantity", () => {
    const v = evaluateScope(
      scope("generic", { lines: [line({ quantity: 0 })] }),
      baseExt(),
    );
    expect(v.status).toBe("caution");
    expect(v.reasons.some((r) => r.code === "zero_quantity")).toBe(true);
  });

  it("cautions an implausible quantity blow-up", () => {
    const v = evaluateScope(
      scope("generic", {
        summary: { primary_metric: "area", primary_value: 10, unit: "m²", inputs: {} },
        lines: [line({ quantity: 60_000 })],
      }),
      baseExt(),
    );
    expect(v.status).toBe("caution");
    expect(v.reasons.some((r) => r.code === "quantity_blowup")).toBe(true);
  });
});

describe("evaluator — per-scope plausibility", () => {
  it("cautions cladding that ignores mentioned openings", () => {
    const v = evaluateScope(
      scope("cladding", {
        lines: [line({ name: "Weatherboard", unit: "lengths", quantity: 30 })],
      }),
      baseExt({
        scope_type: "cladding",
        material_spec: "weatherboard with 2 windows",
        openings: [],
      }),
    );
    expect(v.status).toBe("caution");
    expect(v.reasons.some((r) => r.code === "cladding_openings_ignored")).toBe(
      true,
    );
  });

  it("does not flag cladding when openings are present", () => {
    const v = evaluateScope(
      scope("cladding", {
        lines: [line({ name: "Weatherboard", unit: "lengths", quantity: 30 })],
      }),
      baseExt({
        scope_type: "cladding",
        material_spec: "weatherboard with windows",
        openings: [{ kind: "window", width_m: 1, height_m: 1, count: 2 }],
      }),
    );
    expect(v.reasons.some((r) => r.code === "cladding_openings_ignored")).toBe(
      false,
    );
  });

  it("cautions a roof area that wasn't pitched", () => {
    const v = evaluateScope(
      scope("roofing", {
        summary: {
          primary_metric: "actual roof area",
          primary_value: 100,
          unit: "m²",
          inputs: { plan_area_m2: 100, actual_area_m2: 100, pitch_deg: 30 },
        },
        lines: [line({ name: "Roof sheets", unit: "lengths", quantity: 14 })],
      }),
      baseExt({ scope_type: "roofing" }),
    );
    expect(v.status).toBe("caution");
    expect(v.reasons.some((r) => r.code === "roof_area_not_pitched")).toBe(true);
  });

  it("does not flag a correctly pitched roof", () => {
    const v = evaluateScope(
      scope("roofing", {
        summary: {
          primary_metric: "actual roof area",
          primary_value: 115,
          unit: "m²",
          inputs: { plan_area_m2: 100, actual_area_m2: 115.47, pitch_deg: 30 },
        },
        lines: [line({ name: "Roof sheets", unit: "lengths", quantity: 14 })],
      }),
      baseExt({ scope_type: "roofing" }),
    );
    expect(v.reasons.some((r) => r.code === "roof_area_not_pitched")).toBe(
      false,
    );
  });

  it("cautions an inconsistent stud count", () => {
    const v = evaluateScope(
      scope("framing", {
        summary: {
          primary_metric: "wall area",
          primary_value: 14.4,
          unit: "m²",
          inputs: { length_m: 6, stud_spacing_mm: 600 },
        },
        lines: [
          line({ id: "studs-90x45", name: "Studs 90x45", unit: "each", quantity: 2 }),
        ],
      }),
      baseExt({ scope_type: "framing" }),
    );
    // expected ≈ ceil(6000/600)+1 = 11; actual 2 is well under half.
    expect(v.status).toBe("caution");
    expect(v.reasons.some((r) => r.code === "stud_count_inconsistent")).toBe(
      true,
    );
  });

  it("passes a consistent stud count", () => {
    const v = evaluateScope(
      scope("framing", {
        summary: {
          primary_metric: "wall area",
          primary_value: 14.4,
          unit: "m²",
          inputs: { length_m: 6, stud_spacing_mm: 600 },
        },
        lines: [
          line({ id: "studs-90x45", name: "Studs 90x45", unit: "each", quantity: 11 }),
        ],
      }),
      baseExt({ scope_type: "framing" }),
    );
    expect(v.status).toBe("pass");
  });

  it("cautions when fixings are fewer than the boards they hold", () => {
    const v = evaluateScope(
      scope("roofing", {
        summary: { primary_metric: "area", primary_value: 50, unit: "m²", inputs: {} },
        lines: [
          line({ id: "sheets", name: "Roof sheets", unit: "lengths", quantity: 20 }),
          line({
            id: "screws",
            name: "Roofing screws",
            category: "Fixings",
            unit: "each",
            quantity: 5,
          }),
        ],
      }),
      baseExt({ scope_type: "roofing" }),
    );
    expect(v.reasons.some((r) => r.code === "fixings_low_for_boards")).toBe(true);
  });
});

describe("evaluator — aggregation", () => {
  it("takes the worst verdict across scopes", () => {
    const pass = evaluateScope(scope("generic"), baseExt());
    const fail = evaluateScope(
      scope("generic", { lines: [line({ quantity: NaN })] }),
      baseExt(),
    );
    const agg = evaluateTakeoff([pass, fail]);
    expect(agg.status).toBe("fail");
    expect(agg.requires_manual_confirmation).toBe(true);
  });

  it("returns pass for an empty verdict list", () => {
    expect(evaluateTakeoff([]).status).toBe("pass");
  });
});
