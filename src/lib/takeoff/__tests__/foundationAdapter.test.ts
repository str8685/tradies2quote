import { afterEach, describe, expect, it } from "vitest";
import {
  buildFoundationInput,
  runFoundationCalculator,
  type FoundationConfirmedInputs,
} from "../foundationAdapter";
import { CALCULATORS } from "../calculators";
import type { ExtractedExtraction } from "../schemas";

function makeExt(
  dims: Partial<ExtractedExtraction["dimensions"]> = {},
): ExtractedExtraction {
  return {
    confidence: 0.9,
    project_type: "foundation",
    scope_type: "concrete", // adapter is foundation-specific; this is ignored
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

// Confirmed answers (e.g. from the review UI) that the generic extraction
// can't carry. These are EXPLICIT, never silent defaults.
const SECTIONS: FoundationConfirmedInputs = {
  slab_thickness_mm: 100,
  footing_width_mm: 300,
  footing_depth_mm: 600,
};

describe("foundation adapter — SUCCESS path", () => {
  const ext = makeExt({ length_m: 10, width_m: 8 });
  const res = runFoundationCalculator(ext, SECTIONS);

  it("produces a foundation-scoped result with no clarifications", () => {
    expect(res.scope).toBe("foundation");
    expect(res.clarifications).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
  });

  it("maps every calculator line into the takeoff line shape", () => {
    const keys = res.lines.map((l) => l.id);
    expect(keys).toEqual([
      "foundation:slab_area",
      "foundation:slab_concrete",
      "foundation:footing_run",
      "foundation:footing_concrete",
      "foundation:total_concrete",
      "foundation:mesh",
    ]);
    for (const l of res.lines) {
      expect(l.basis.formula.length).toBeGreaterThan(0);
      expect(Object.keys(l.basis.inputs).length).toBeGreaterThan(0);
      expect(l.confidence).toBe(1);
    }
  });

  it("carries the hand-computed quantities through unchanged", () => {
    const byId = Object.fromEntries(res.lines.map((l) => [l.id, l]));
    expect(byId["foundation:slab_area"].quantity).toBe(80);
    expect(byId["foundation:slab_concrete"].quantity).toBe(8.8);
    expect(byId["foundation:footing_run"].quantity).toBe(36);
    expect(byId["foundation:footing_concrete"].quantity).toBe(7.2);
    expect(byId["foundation:total_concrete"].quantity).toBe(16.0);
    expect(byId["foundation:mesh"].quantity).toBe(7);
  });

  it("preserves the formula + inputs from the calculator", () => {
    const slab = res.lines.find((l) => l.id === "foundation:slab_area")!;
    expect(slab.basis.formula).toContain("10");
    expect(slab.basis.formula).toContain("8");
    expect(slab.basis.inputs).toMatchObject({ length_m: 10, width_m: 8 });
  });

  it("preserves assumptions onto the lines they affect and sets 'assumed'", () => {
    const slabConcrete = res.lines.find((l) => l.id === "foundation:slab_concrete")!;
    expect(slabConcrete.status).toBe("assumed");
    expect(slabConcrete.assumption_flags.join(" ")).toMatch(/waste defaulted/i);
    expect(slabConcrete.basis.assumed).toContain("concrete_waste_pct");

    const run = res.lines.find((l) => l.id === "foundation:footing_run")!;
    expect(run.basis.assumed).toContain("internal_footing_run_m");

    // Pure-measurement line with no applicable assumption stays "ok".
    const area = res.lines.find((l) => l.id === "foundation:slab_area")!;
    expect(area.status).toBe("ok");
    expect(area.assumption_flags).toHaveLength(0);
  });

  it("rolls up to the worst per-line status", () => {
    expect(res.status).toBe("assumed"); // concrete/footing lines are assumed
    expect(res.summary.primary_metric).toBe("total_concrete");
    expect(res.summary.primary_value).toBe(16.0);
  });

  it("reflects an explicit config override (no waste assumption then)", () => {
    const r = runFoundationCalculator(ext, { ...SECTIONS, config: { concrete_waste_pct: 0 } });
    const slabConcrete = r.lines.find((l) => l.id === "foundation:slab_concrete")!;
    expect(slabConcrete.quantity).toBe(8.0);
    expect(slabConcrete.status).toBe("ok");
    expect(slabConcrete.assumption_flags.join(" ")).not.toMatch(/waste defaulted/i);
  });
});

describe("foundation adapter — BLOCKED path", () => {
  it("blocks (does not throw) when section measurements are missing", () => {
    const res = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }));
    expect(res.status).toBe("blocked");
    expect(res.lines).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("emits one BLOCKING, tradie-friendly clarification per missing field", () => {
    const res = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }));
    const fields = res.clarifications.map((c) => c.field);
    expect(fields).toEqual(
      expect.arrayContaining(["slab_thickness_mm", "footing_width_mm", "footing_depth_mm"]),
    );
    for (const c of res.clarifications) {
      expect(c.blocking).toBe(true);
      expect(c.scope).toBe("foundation");
      expect(c.question.endsWith("?")).toBe(true);
    }
    const thickness = res.clarifications.find((c) => c.field === "slab_thickness_mm")!;
    expect(thickness.question).toBe("What is the slab thickness in mm?");
    expect(thickness.unit).toBe("mm");
    expect(thickness.suggestions).toEqual(["100", "125", "150"]);
  });

  it("asks for slab size when there is no footprint at all", () => {
    const res = runFoundationCalculator(makeExt(), SECTIONS);
    const fields = res.clarifications.map((c) => c.field);
    expect(fields).toContain("slab_size");
  });

  it("asks for perimeter when only area is known", () => {
    const res = runFoundationCalculator(makeExt({ area_m2: 80 }), SECTIONS);
    const perim = res.clarifications.find((c) => c.field === "slab_perimeter_m");
    expect(perim).toBeTruthy();
    expect(perim!.blocking).toBe(true);
  });

  it("NO silent fallback: blocked output invents no value", () => {
    const res = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }));
    expect(res.lines).toHaveLength(0); // no fabricated lines
    expect(res.assumptions).toHaveLength(0); // nothing assumed
    expect(res.summary.primary_value).toBe(0); // no guessed total
  });
});

describe("foundation adapter — input mapping", () => {
  it("does NOT invent section measurements from extraction", () => {
    // Extraction can carry height_m, but the adapter must not read it as a slab
    // thickness — section dims only ever come from confirmed answers.
    const input = buildFoundationInput(makeExt({ length_m: 10, width_m: 8, height_m: 0.15 }));
    expect(input.slab_thickness_mm).toBeUndefined();
    expect(input.footing_width_mm).toBeUndefined();
    expect(input.footing_depth_mm).toBeUndefined();
  });

  it("lets confirmed answers win over extraction", () => {
    const input = buildFoundationInput(
      makeExt({ length_m: 10, width_m: 8 }),
      { slab_length_m: 12, ...SECTIONS },
    );
    expect(input.slab_length_m).toBe(12);
    expect(input.slab_thickness_mm).toBe(100);
  });

  it("ignores null/undefined confirmed values (no clobbering)", () => {
    const input = buildFoundationInput(
      makeExt({ length_m: 10, width_m: 8 }),
      { slab_length_m: null, slab_width_m: undefined },
    );
    expect(input.slab_length_m).toBe(10);
    expect(input.slab_width_m).toBe(8);
  });
});

describe("foundation adapter — isolation + flag independence", () => {
  const original = process.env.PLAN_READER_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.PLAN_READER_ENABLED;
    else process.env.PLAN_READER_ENABLED = original;
  });

  it("is NOT registered in the live CALCULATORS map (still isolated)", () => {
    expect(Object.keys(CALCULATORS)).not.toContain("foundation");
  });

  it("produces identical output with the feature flag OFF and ON", () => {
    const ext = makeExt({ length_m: 10, width_m: 8 });

    delete process.env.PLAN_READER_ENABLED; // OFF
    const off = runFoundationCalculator(ext, SECTIONS);

    process.env.PLAN_READER_ENABLED = "true"; // ON
    const on = runFoundationCalculator(ext, SECTIONS);

    // The calculator/adapter are pure — the flag gates routes, not maths.
    expect(on).toEqual(off);
  });
});
