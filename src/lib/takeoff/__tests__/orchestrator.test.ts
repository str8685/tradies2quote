import { describe, expect, it } from "vitest";
import {
  runTakeoff,
  runTakeoffWithExtraction,
} from "../orchestrator";
import { routeScope } from "../scope-router";
import { extractFromText } from "../extraction";
import { validateExtractionForScope } from "../validate";
import { buildClarifications } from "../clarify";
import type { ExtractedExtraction } from "../schemas";

const baseExtraction = (overrides: Partial<ExtractedExtraction>): ExtractedExtraction => ({
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
  ...overrides,
});

describe("scope router", () => {
  it("routes a deck description to deck", () => {
    const route = routeScope("Build a 4.8 by 3 metre deck on piles");
    expect(route.primary).toBe("deck");
    expect(route.scopes).toContain("deck");
  });

  it("routes a multi-scope description to multiple scopes", () => {
    const route = routeScope(
      "Build a 6m fence with a small deck and roofing over the entry",
    );
    expect(route.scopes).toEqual(expect.arrayContaining(["deck", "fencing", "roofing"]));
  });

  it("falls back to generic when nothing matches", () => {
    const route = routeScope("just some stuff to quote");
    expect(route.primary).toBe("generic");
  });
});

describe("orchestrator — happy path scopes", () => {
  it("rectangular deck — full takeoff with ok/assumed status", () => {
    const result = runTakeoff(
      "Build a 4.8m by 3m deck on piles, joists at 450mm centres, 6m timber stock.",
    );
    expect(result.primary_scope).toBe("deck");
    const deck = result.scopes.find((s) => s.scope === "deck");
    expect(deck).toBeTruthy();
    expect(deck!.status).not.toBe("blocked");
    expect(deck!.lines.length).toBeGreaterThan(0);
    // Every line carries a basis + status + confidence.
    for (const l of deck!.lines) {
      expect(l.basis.formula).toBeTruthy();
      expect(l.status).toMatch(/ok|assumed|needs_review/);
      expect(l.confidence).toBeGreaterThan(0);
    }
  });

  it("cladding with openings — net area accounts for windows/doors", () => {
    const ext = baseExtraction({
      scope_type: "cladding",
      dimensions: { length_m: 8, height_m: 2.4 },
      openings: [
        { kind: "door", width_m: 0.82, height_m: 2.04, count: 1 },
        { kind: "window", width_m: 1.2, height_m: 1.2, count: 2 },
      ],
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const cladding = result.scopes[0];
    expect(cladding.summary.primary_metric).toBe("net cladding area");
    // 8×2.4 = 19.2 gross; minus 1×1.67 + 2×1.44 = 4.55 → 14.65 net.
    expect(cladding.summary.primary_value).toBeCloseTo(14.65, 1);
  });

  it("framing with spacing — produces stud/plate/nog counts", () => {
    const ext = baseExtraction({
      scope_type: "framing",
      dimensions: { length_m: 6, height_m: 2.4 },
      spacing_mm: 600,
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const lines = result.scopes[0].lines;
    expect(lines.find((l) => l.id === "studs-90x45")).toBeTruthy();
    expect(lines.find((l) => l.id === "plates-90x45")).toBeTruthy();
    expect(lines.find((l) => l.id === "nogs-90x45")).toBeTruthy();
  });

  it("roofing — actual area = plan area / cos(pitch)", () => {
    const ext = baseExtraction({
      scope_type: "roofing",
      dimensions: { area_m2: 100, length_m: 10, width_m: 10, pitch_deg: 30 },
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const actual = result.scopes[0].summary.primary_value;
    // 100 / cos(30°) ≈ 115.47
    expect(actual).toBeGreaterThan(110);
    expect(actual).toBeLessThan(120);
  });

  it("lining — sheet count from area + sides", () => {
    const ext = baseExtraction({
      scope_type: "lining",
      dimensions: { area_m2: 20 },
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const sheets = result.scopes[0].lines.find((l) => l.id === "lining-sheets");
    expect(sheets).toBeTruthy();
    expect(sheets!.quantity).toBeGreaterThan(0);
    expect(sheets!.unit).toBe("sheets");
  });

  it("concrete slab — volume from L×W×thickness", () => {
    const ext = baseExtraction({
      scope_type: "concrete",
      dimensions: { length_m: 5, width_m: 4, height_m: 100 },
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const conc = result.scopes[0].lines.find((l) => l.id === "concrete-volume");
    expect(conc).toBeTruthy();
    // 5 × 4 × 0.1 = 2 m³ + 5% waste ≈ 2.1
    expect(conc!.quantity).toBeGreaterThan(1.9);
    expect(conc!.quantity).toBeLessThan(2.3);
  });

  it("fencing — posts, rails, palings from perimeter", () => {
    const ext = baseExtraction({
      scope_type: "fencing",
      dimensions: { perimeter_m: 30, height_m: 1.8 },
    });
    const result = runTakeoffWithExtraction(ext);
    expect(result.status).not.toBe("blocked");
    const lines = result.scopes[0].lines;
    expect(lines.find((l) => l.id === "fence-posts")).toBeTruthy();
    expect(lines.find((l) => l.id === "fence-rails")).toBeTruthy();
    expect(lines.find((l) => l.id === "fence-palings")).toBeTruthy();
  });
});

describe("orchestrator — clarification + validation paths", () => {
  it("ambiguous input — deck without dimensions blocks and asks for length/width", () => {
    const result = runTakeoff("Build me a deck please.");
    const deck = result.scopes.find((s) => s.scope === "deck");
    expect(deck?.status).toBe("blocked");
    const fields = deck!.clarifications.map((q) => q.field);
    expect(fields).toContain("length_m");
    expect(fields).toContain("width_m");
    expect(result.status).toBe("blocked");
  });

  it("invalid extraction (negative length) is rejected by validate", () => {
    const ext = baseExtraction({
      scope_type: "deck",
      dimensions: { length_m: -3, width_m: 4 },
    });
    const v = validateExtractionForScope(ext, "deck");
    expect(v.status).toBe("blocked");
    expect(v.reasons.some((r) => r.includes("not a positive"))).toBe(true);
  });

  it("validator soft-flags a non-standard stud spacing without blocking", () => {
    const ext = baseExtraction({
      scope_type: "framing",
      dimensions: { length_m: 6, height_m: 2.4 },
      spacing_mm: 500,
    });
    const v = validateExtractionForScope(ext, "framing");
    expect(v.status).toBe("needs_review");
    expect(v.flags.length).toBeGreaterThan(0);
  });

  it("buildClarifications returns blocking=true when a required field is missing", () => {
    const ext = baseExtraction({
      scope_type: "deck",
      dimensions: { length_m: null, width_m: null },
    });
    const { questions, blocking } = buildClarifications("deck", ext);
    expect(blocking).toBe(true);
    expect(questions.some((q) => q.field === "length_m" && q.blocking)).toBe(true);
  });
});

describe("orchestrator — multi-scope splitting", () => {
  it("mixed job runs each scope through its own calculator", () => {
    const result = runTakeoff(
      "6m by 3m deck plus a 20m² roof and 30m of fencing.",
    );
    const scopes = result.scopes.map((s) => s.scope);
    expect(scopes).toEqual(expect.arrayContaining(["deck", "roofing", "fencing"]));
    // Each scope produces its own primary metric/value.
    for (const s of result.scopes) {
      if (s.status !== "blocked") {
        expect(s.summary.primary_value).toBeGreaterThan(0);
      }
    }
  });
});

describe("extraction layer", () => {
  it("extracts rectangle + spacing + waste from text", () => {
    const ext = extractFromText(
      "4.8m by 3m deck, joists at 450mm centres, 10% waste, 6m timber",
      "deck",
    );
    expect(ext.dimensions.length_m).toBeCloseTo(4.8, 2);
    expect(ext.dimensions.width_m).toBeCloseTo(3, 2);
    expect(ext.spacing_mm).toBe(450);
    expect(ext.waste_percent).toBe(10);
    expect(ext.stock_length_m).toBe(6);
    expect(ext.needs_clarification).toHaveLength(0);
  });

  it("leaves missing fields explicit (null) rather than guessing", () => {
    const ext = extractFromText("a deck job", "deck");
    expect(ext.dimensions.length_m).toBeNull();
    expect(ext.dimensions.width_m).toBeNull();
    expect(ext.needs_clarification).toEqual(
      expect.arrayContaining(["length_m", "width_m"]),
    );
  });

  it("respects [T2Q_PLAN] marker over loose text", () => {
    const text = `[T2Q_PLAN] type=deck length_m=4.8 width_m=3.82 joist_spacing_mm=450
Notes about other stuff 100x50 timber that isn't the plan`;
    const ext = extractFromText(text, "deck");
    expect(ext.dimensions.length_m).toBe(4.8);
    expect(ext.dimensions.width_m).toBe(3.82);
    expect(ext.source_basis).toBe("marker");
  });
});
