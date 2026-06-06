// ─────────────────────────────────────────────────────────────────────────
// CHARACTERIZATION TESTS — the foundation adapter's output is a CONTRACT.
//
// These lock the EXACT current shape (blocked payload, clarification metadata,
// ordering, and per-line basis) so a future Phase-4 wiring change cannot
// silently alter what a UI / orchestrator will receive. If you intend to
// change the contract, update these tests deliberately — they are the spec.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { runFoundationCalculator } from "../foundationAdapter";
import type { ExtractedExtraction } from "../schemas";

function makeExt(
  dims: Partial<ExtractedExtraction["dimensions"]> = {},
): ExtractedExtraction {
  return {
    confidence: 0.9,
    project_type: "foundation",
    scope_type: "concrete",
    sub_scopes: [],
    dimensions: {
      length_m: null,
      width_m: null,
      height_m: null,
      area_m2: null,
      perimeter_m: null,
      pitch_deg: null,
      volume_m3: null,
      ...dims,
    },
    openings: [],
    spacing_mm: null,
    material_spec: null,
    stock_length_m: null,
    coverage_mm: null,
    waste_percent: null,
    notes: [],
    needs_clarification: [],
    clarification_questions: [],
    source_basis: "llm",
  };
}

const SECTIONS = {
  slab_thickness_mm: 100,
  footing_width_mm: 300,
  footing_depth_mm: 600,
};

describe("CONTRACT — blocked payload (slab footprint known, sections missing)", () => {
  const res = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }));

  it("matches the exact blocked payload shape", () => {
    expect(res).toEqual({
      scope: "foundation",
      status: "blocked",
      summary: {
        primary_metric: "total_concrete",
        primary_value: 0,
        unit: "m³",
        inputs: {},
      },
      lines: [],
      warnings: [
        "Foundation takeoff is blocked: required measurements are missing. Answer the questions below to calculate.",
      ],
      assumptions: [],
      clarifications: [
        {
          id: "foundation_clar_slab_thickness_mm",
          scope: "foundation",
          field: "slab_thickness_mm",
          question: "What is the slab thickness in mm?",
          hint: "Most residential slabs are 100–150 mm.",
          blocking: true,
          suggestions: ["100", "125", "150"],
          unit: "mm",
          input_kind: "number",
          required: true,
          source: "missing_required_input",
          display_order: 3,
        },
        {
          id: "foundation_clar_footing_width_mm",
          scope: "foundation",
          field: "footing_width_mm",
          question: "How wide are the footings in mm?",
          hint: "Measured across the bottom of the footing trench.",
          blocking: true,
          suggestions: ["300", "400", "450"],
          unit: "mm",
          input_kind: "number",
          required: true,
          source: "missing_required_input",
          display_order: 4,
        },
        {
          id: "foundation_clar_footing_depth_mm",
          scope: "foundation",
          field: "footing_depth_mm",
          question: "How deep are the footings in mm?",
          hint: "From the underside of the slab to the bottom of the footing.",
          blocking: true,
          suggestions: ["400", "450", "600"],
          unit: "mm",
          input_kind: "number",
          required: true,
          source: "missing_required_input",
          display_order: 5,
        },
      ],
      explanation:
        "Cannot calculate a foundation takeoff yet — the slab/footing measurements below are required and were not provided. Nothing is assumed.",
    });
  });
});

describe("CONTRACT — clarification metadata + ordering", () => {
  it("every clarification carries the full machine-usable metadata", () => {
    const res = runFoundationCalculator(makeExt());
    for (const c of res.clarifications) {
      expect(c).toEqual(
        expect.objectContaining({
          field: expect.any(String),
          question: expect.any(String),
          blocking: true,
          input_kind: expect.any(String),
          required: expect.any(Boolean),
          source: expect.any(String),
          display_order: expect.any(Number),
        }),
      );
    }
  });

  it("clarifications are returned sorted by display_order (stable UI order)", () => {
    const res = runFoundationCalculator(makeExt()); // no footprint + no sections
    const orders = res.clarifications.map((c) => c.display_order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
    // slab_size (1) must come before the section questions (3,4,5).
    expect(res.clarifications[0].field).toBe("slab_size");
    expect(res.clarifications[0].input_kind).toBe("dimensions_pair");
    expect(res.clarifications[0].required).toBe(true);
  });

  it("marks an invalid optional value as optional + invalid_value", () => {
    // Negative internal run is the only path that surfaces this optional field.
    const res = runFoundationCalculator(
      makeExt({ length_m: 10, width_m: 8 }),
      { ...SECTIONS, internal_footing_run_m: -5 },
    );
    const c = res.clarifications.find((x) => x.field === "internal_footing_run_m");
    expect(c).toBeTruthy();
    expect(c!.required).toBe(false);
    expect(c!.source).toBe("invalid_value");
  });
});

describe("CONTRACT — per-line basis is preserved exactly", () => {
  const res = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }), SECTIONS);
  const byId = Object.fromEntries(res.lines.map((l) => [l.id, l]));

  it("slab_area basis", () => {
    expect(byId["foundation:slab_area"].basis).toEqual({
      formula: "length × width = 10 × 8",
      inputs: { length_m: 10, width_m: 8 },
      assumed: [],
    });
  });

  it("slab_concrete basis (formula + inputs + assumed default)", () => {
    expect(byId["foundation:slab_concrete"].basis).toEqual({
      formula: "area × thickness × (1 + waste) = 80 × 0.1 × 1.1",
      inputs: { area_m2: 80, thickness_m: 0.1, waste: 0.1 },
      assumed: ["concrete_waste_pct"],
    });
  });

  it("line identity, category, unit, status are stable", () => {
    expect(res.lines.map((l) => [l.id, l.category, l.unit, l.status])).toEqual([
      ["foundation:slab_area", "Measurement", "m²", "ok"],
      ["foundation:slab_concrete", "Concrete", "m³", "assumed"],
      ["foundation:footing_run", "Measurement", "m", "assumed"],
      ["foundation:footing_concrete", "Concrete", "m³", "assumed"],
      ["foundation:total_concrete", "Concrete", "m³", "assumed"],
      ["foundation:mesh", "Reinforcing", "sheet", "assumed"],
    ]);
  });
});
