import { describe, expect, it } from "vitest";
import { runFoundationCalculator } from "../foundationAdapter";
import type { FoundationClarification } from "../foundationAdapter";
import { buildFoundationReviewModel } from "../foundationReviewModel";
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

// Blocked result: no footprint + no sections → slab_size + 3 section fields.
const blocked = runFoundationCalculator(makeExt());
const model = buildFoundationReviewModel(blocked.clarifications);
const byKey = Object.fromEntries(model.fields.map((f) => [f.key, f]));

describe("review model — status + structure", () => {
  it("is blocked with one field per clarification", () => {
    expect(model.status).toBe("blocked");
    expect(model.fields.length).toBe(blocked.clarifications.length);
  });

  it("is 'ready' with no fields when there are no clarifications", () => {
    const ready = buildFoundationReviewModel([]);
    expect(ready.status).toBe("ready");
    expect(ready.fields).toEqual([]);
    expect(ready.required_keys).toEqual([]);
  });
});

describe("review model — display order preservation", () => {
  it("fields are sorted ascending by order", () => {
    const orders = model.fields.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("re-sorts even if given a scrambled clarification list", () => {
    const scrambled = [...blocked.clarifications].reverse();
    const m = buildFoundationReviewModel(scrambled);
    const orders = m.fields.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(m.fields[0].key).toBe("slab_size");
  });
});

describe("review model — label / question / hint mapping", () => {
  it("label = clarification question, hint = clarification hint", () => {
    const thickness = byKey.slab_thickness_mm;
    const src = blocked.clarifications.find((c) => c.field === "slab_thickness_mm")!;
    expect(thickness.label).toBe(src.question);
    expect(thickness.label).toBe("What is the slab thickness in mm?");
    expect(thickness.hint).toBe(src.hint);
  });

  it("maps a missing hint to null (not undefined / not invented)", () => {
    // Construct a clarification with no hint to lock the null mapping.
    const noHint: FoundationClarification = {
      id: "foundation_clar_x",
      scope: "foundation",
      field: "footing_width_mm",
      question: "How wide are the footings in mm?",
      blocking: true,
      input_kind: "number",
      required: true,
      source: "missing_required_input",
      display_order: 4,
    };
    const m = buildFoundationReviewModel([noHint]);
    expect(m.fields[0].hint).toBeNull();
  });
});

describe("review model — control mapping per input_kind", () => {
  it("number → numeric control with unit label + confirmed key", () => {
    const t = byKey.slab_thickness_mm;
    expect(t.control).toBe("number");
    expect(t.unit).toBe("mm");
    expect(t.confirmed_keys).toEqual(["slab_thickness_mm"]);
    expect(t.parts).toBeUndefined();
  });

  it("dimensions_pair → two linked numeric inputs with both confirmed keys", () => {
    const s = byKey.slab_size;
    expect(s.control).toBe("dimensions_pair");
    expect(s.unit).toBe("m");
    expect(s.parts).toEqual([
      { confirmed_key: "slab_length_m", label: "Length", unit: "m" },
      { confirmed_key: "slab_width_m", label: "Width", unit: "m" },
    ]);
    expect(s.confirmed_keys).toEqual(["slab_length_m", "slab_width_m"]);
  });

  it("select → reserved mapping (options from suggestions, empty today)", () => {
    const sel: FoundationClarification = {
      id: "foundation_clar_sel",
      scope: "foundation",
      field: "demo_select",
      question: "Pick one?",
      blocking: true,
      input_kind: "select",
      required: true,
      source: "missing_required_input",
      display_order: 10,
      suggestions: ["a", "b"],
    };
    const m = buildFoundationReviewModel([sel]);
    expect(m.fields[0].control).toBe("select");
    expect(m.fields[0].options).toEqual(["a", "b"]);
    expect(m.fields[0].confirmed_keys).toEqual(["demo_select"]);
  });

  it("throws on an unknown dimensions_pair field (contract drift)", () => {
    const bad: FoundationClarification = {
      id: "foundation_clar_bad",
      scope: "foundation",
      field: "mystery_pair",
      question: "Two numbers?",
      blocking: true,
      input_kind: "dimensions_pair",
      required: true,
      source: "missing_required_input",
      display_order: 1,
    };
    expect(() => buildFoundationReviewModel([bad])).toThrow(/dimensions_pair mapping/);
  });
});

describe("review model — required vs optional metadata", () => {
  it("required fields are explicit (required true / optional false)", () => {
    expect(byKey.slab_thickness_mm.required).toBe(true);
    expect(byKey.slab_thickness_mm.optional).toBe(false);
    expect(byKey.slab_size.required).toBe(true);
  });

  it("optional fields are explicitly optional", () => {
    const invalid = runFoundationCalculator(makeExt({ length_m: 10, width_m: 8 }), {
      ...SECTIONS,
      internal_footing_run_m: -5,
    });
    const m = buildFoundationReviewModel(invalid.clarifications);
    const run = m.fields.find((f) => f.key === "internal_footing_run_m")!;
    expect(run.required).toBe(false);
    expect(run.optional).toBe(true);
  });

  it("required_keys flattens dimensions_pair and excludes optional fields", () => {
    expect(model.required_keys).toEqual(
      expect.arrayContaining([
        "slab_length_m",
        "slab_width_m",
        "slab_thickness_mm",
        "footing_width_mm",
        "footing_depth_mm",
      ]),
    );
    expect(model.required_keys).not.toContain("internal_footing_run_m");
  });
});

describe("review model — suggestions passthrough", () => {
  it("passes contract suggestions through verbatim", () => {
    expect(byKey.slab_thickness_mm.suggestions).toEqual(["100", "125", "150"]);
    expect(byKey.footing_width_mm.suggestions).toEqual(["300", "400", "450"]);
  });

  it("defaults suggestions to [] when the contract omits them", () => {
    expect(byKey.slab_size.suggestions).toEqual([]);
  });
});

describe("review model — NO invented defaults", () => {
  it("never seeds a value/default on any field", () => {
    for (const f of model.fields) {
      expect(f).not.toHaveProperty("value");
      expect(f).not.toHaveProperty("default");
    }
  });

  it("number fields carry only metadata, no preset answer", () => {
    const keys = Object.keys(byKey.slab_thickness_mm).sort();
    expect(keys).toEqual(
      [
        "confirmed_keys",
        "control",
        "hint",
        "key",
        "label",
        "optional",
        "order",
        "required",
        "source",
        "suggestions",
        "unit",
      ].sort(),
    );
  });
});
