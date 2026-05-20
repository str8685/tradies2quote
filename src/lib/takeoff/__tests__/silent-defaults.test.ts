// Phase A regression: every quantity-driving default must announce itself
// (push an assumption + flip its line to "assumed") so it can't be applied
// silently. This is what wires the whole default class into the reliability
// layer (assumed status → "// review these" → send gate).

import { describe, expect, it } from "vitest";
import { runTakeoffWithExtraction } from "../orchestrator";
import type { ExtractedExtraction } from "../schemas";

const ext = (o: Partial<ExtractedExtraction>): ExtractedExtraction => ({
  confidence: 0.85,
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

const line = (scopeResult: ReturnType<typeof runTakeoffWithExtraction>, id: string) =>
  scopeResult.scopes[0].lines.find((l) => l.id === id);

describe("silent default flagging (Phase A)", () => {
  it("roofing flags the sheet cover width", () => {
    const r = runTakeoffWithExtraction(
      ext({
        scope_type: "roofing",
        dimensions: { area_m2: 100, length_m: 10, width_m: 10, pitch_deg: 30 },
        waste_percent: 10,
      }),
    );
    const sheets = line(r, "roof-sheets");
    expect(sheets?.status).toBe("assumed");
    expect(
      r.scopes[0].assumptions.some((a) => /sheet cover/i.test(a)),
    ).toBe(true);
  });

  it("fencing flags post spacing / paling width on the lines", () => {
    const r = runTakeoffWithExtraction(
      ext({ scope_type: "fencing", dimensions: { perimeter_m: 30, height_m: 1.8 } }),
    );
    expect(line(r, "fence-posts")?.status).toBe("assumed");
    expect(line(r, "fence-palings")?.status).toBe("assumed");
    expect(
      r.scopes[0].assumptions.some((a) => /post spacing/i.test(a)),
    ).toBe(true);
    expect(
      r.scopes[0].assumptions.some((a) => /paling/i.test(a)),
    ).toBe(true);
  });

  it("lining flags the sheet size", () => {
    const r = runTakeoffWithExtraction(
      ext({ scope_type: "lining", dimensions: { area_m2: 20 }, waste_percent: 10 }),
    );
    expect(line(r, "lining-sheets")?.status).toBe("assumed");
    expect(
      r.scopes[0].assumptions.some((a) => /lining sheets/i.test(a)),
    ).toBe(true);
  });

  it("concrete flags mesh/DPM coverage but not a fully-specified volume", () => {
    const r = runTakeoffWithExtraction(
      ext({
        scope_type: "concrete",
        dimensions: { length_m: 5, width_m: 4, height_m: 100 },
        waste_percent: 5,
      }),
    );
    // Thickness + waste were given, so the volume line stays exact.
    expect(line(r, "concrete-volume")?.status).toBe("ok");
    // But the mesh/DPM coverage is a default — must be flagged.
    expect(line(r, "concrete-mesh")?.status).toBe("assumed");
    expect(line(r, "concrete-poly")?.status).toBe("assumed");
    expect(
      r.scopes[0].assumptions.some((a) => /mesh/i.test(a)),
    ).toBe(true);
  });

  it("cladding flags the board cover when it wasn't given", () => {
    const r = runTakeoffWithExtraction(
      ext({ scope_type: "cladding", dimensions: { length_m: 8, height_m: 2.4 } }),
    );
    expect(r.scopes[0].status).toBe("assumed");
    expect(r.scopes[0].lines.some((l) => l.status === "assumed")).toBe(true);
    expect(
      r.scopes[0].assumptions.some((a) => /cladding cover/i.test(a)),
    ).toBe(true);
  });
});
