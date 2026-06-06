import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOUNDATION_CONFIG,
  FoundationInputError,
  calculateFoundationTakeoff,
  type FoundationInput,
  type FoundationLine,
} from "../foundationCalculator";

function line(out: ReturnType<typeof calculateFoundationTakeoff>, key: FoundationLine["key"]) {
  const l = out.lines.find((x) => x.key === key);
  if (!l) throw new Error(`missing line ${key}`);
  return l;
}

// A fully-specified, hand-computed baseline:
//   slab 10×8, thickness 100mm, footing 300×600mm, default 10% waste,
//   mesh 6.0×2.4 with 0.2 lap.
const BASE: FoundationInput = {
  slab_length_m: 10,
  slab_width_m: 8,
  slab_thickness_mm: 100,
  footing_width_mm: 300,
  footing_depth_mm: 600,
};

describe("foundation calculator — valid known inputs", () => {
  const out = calculateFoundationTakeoff(BASE);

  it("slab area = L × W", () => {
    expect(line(out, "slab_area").quantity).toBe(80);
  });

  it("slab concrete = area × thickness × (1+waste), ordered to 0.1", () => {
    // 80 × 0.1 = 8.0 ; ×1.1 = 8.8
    expect(line(out, "slab_concrete").quantity).toBe(8.8);
  });

  it("footing run = perimeter (+0 internal)", () => {
    expect(line(out, "footing_run").quantity).toBe(36); // 2×(10+8)
  });

  it("footing concrete = run × w × d × (1+waste), ordered to 0.1", () => {
    // 36 × 0.3 × 0.6 = 6.48 ; ×1.1 = 7.128 → 7.2
    expect(line(out, "footing_concrete").quantity).toBe(7.2);
  });

  it("total concrete = slab + footing", () => {
    expect(line(out, "total_concrete").quantity).toBe(16.0);
  });

  it("mesh = ceil(area / effective coverage), lap modelled", () => {
    // eff = (6-0.2)(2.4-0.2) = 5.8×2.2 = 12.76 ; 80/12.76 = 6.27 → 7
    expect(line(out, "mesh").quantity).toBe(7);
  });

  it("every line is deterministic (confidence 1) and carries a formula", () => {
    for (const l of out.lines) {
      expect(l.confidence).toBe(1);
      expect(l.formula.length).toBeGreaterThan(0);
      expect(Object.keys(l.inputs).length).toBeGreaterThan(0);
    }
  });

  it("records the waste + no-internal-footing assumptions", () => {
    expect(out.assumptions.join(" ")).toMatch(/waste defaulted to 10%/i);
    expect(out.assumptions.join(" ")).toMatch(/no internal\/load-bearing footings/i);
  });
});

describe("foundation calculator — HARD FAIL on missing required inputs", () => {
  it("throws with everything missing", () => {
    expect(() => calculateFoundationTakeoff({})).toThrow(FoundationInputError);
  });

  it("lists each missing required measurement", () => {
    try {
      calculateFoundationTakeoff({});
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(FoundationInputError);
      const missing = (e as FoundationInputError).missing;
      expect(missing.some((m) => m.includes("slab_length_m"))).toBe(true);
      expect(missing).toContain("slab_thickness_mm");
      expect(missing).toContain("footing_width_mm");
      expect(missing).toContain("footing_depth_mm");
    }
  });

  it("throws when thickness is missing", () => {
    const { slab_thickness_mm, ...rest } = BASE;
    void slab_thickness_mm;
    expect(() => calculateFoundationTakeoff(rest)).toThrow(/slab_thickness_mm/);
  });

  it("throws when footing section is missing", () => {
    const { footing_depth_mm, ...rest } = BASE;
    void footing_depth_mm;
    expect(() => calculateFoundationTakeoff(rest)).toThrow(/footing_depth_mm/);
  });

  it("area-only path requires an explicit perimeter", () => {
    expect(() =>
      calculateFoundationTakeoff({
        slab_area_m2: 80,
        slab_thickness_mm: 100,
        footing_width_mm: 300,
        footing_depth_mm: 600,
      }),
    ).toThrow(/slab_perimeter_m/);
  });

  it("does NOT silently default a required measurement", () => {
    // Missing thickness must throw — never assume a slab depth.
    const { slab_thickness_mm, ...rest } = BASE;
    void slab_thickness_mm;
    expect(() => calculateFoundationTakeoff(rest)).toThrow(FoundationInputError);
  });
});

describe("foundation calculator — zero / boundary cases", () => {
  it("treats zero dimensions as missing (throws)", () => {
    expect(() =>
      calculateFoundationTakeoff({ ...BASE, slab_length_m: 0, slab_width_m: 0 }),
    ).toThrow(FoundationInputError);
  });

  it("treats negative dimensions as missing (throws)", () => {
    expect(() =>
      calculateFoundationTakeoff({ ...BASE, slab_width_m: -8 }),
    ).toThrow(FoundationInputError);
  });

  it("rejects a negative internal footing run", () => {
    expect(() =>
      calculateFoundationTakeoff({ ...BASE, internal_footing_run_m: -5 }),
    ).toThrow(/internal_footing_run_m/);
  });

  it("accepts internal_footing_run_m = 0 explicitly", () => {
    const out = calculateFoundationTakeoff({ ...BASE, internal_footing_run_m: 0 });
    expect(line(out, "footing_run").quantity).toBe(36);
  });

  it("handles a tiny slab without producing zero mesh", () => {
    const out = calculateFoundationTakeoff({
      slab_length_m: 1,
      slab_width_m: 1,
      slab_thickness_mm: 100,
      footing_width_mm: 300,
      footing_depth_mm: 600,
    });
    expect(line(out, "mesh").quantity).toBe(1); // ceil(1/12.76) = 1
    expect(line(out, "slab_area").quantity).toBe(1);
  });
});

describe("foundation calculator — unit consistency", () => {
  it("converts mm thickness to m correctly", () => {
    // 100 m² × 0.15 m = 15 ; ×1.1 = 16.5
    const out = calculateFoundationTakeoff({
      slab_length_m: 10,
      slab_width_m: 10,
      slab_thickness_mm: 150,
      footing_width_mm: 300,
      footing_depth_mm: 600,
    });
    expect(line(out, "slab_concrete").quantity).toBe(16.5);
    expect(line(out, "slab_concrete").inputs.thickness_m).toBe(0.15);
  });

  it("converts footing mm width/depth to m correctly", () => {
    const out = calculateFoundationTakeoff(BASE);
    const f = line(out, "footing_concrete");
    expect(f.inputs.width_m).toBe(0.3);
    expect(f.inputs.depth_m).toBe(0.6);
  });

  it("internal run adds to perimeter in metres", () => {
    const out = calculateFoundationTakeoff({ ...BASE, internal_footing_run_m: 10 });
    expect(line(out, "footing_run").quantity).toBe(46); // 36 + 10
  });
});

describe("foundation calculator — rounding & waste behaviour", () => {
  it("applies the waste factor to concrete volumes", () => {
    const noWaste = calculateFoundationTakeoff({ ...BASE, config: { concrete_waste_pct: 0 } });
    // 80 × 0.1 = 8.0 exactly, no waste.
    expect(line(noWaste, "slab_concrete").quantity).toBe(8.0);
    expect(line(noWaste, "slab_concrete").waste_factor).toBe(0);
  });

  it("orders concrete UP to the configured step (0.1 m³)", () => {
    // footing 7.128 must round UP to 7.2, never down to 7.1.
    expect(line(calculateFoundationTakeoff(BASE), "footing_concrete").quantity).toBe(7.2);
  });

  it("guards float drift (8.800000001 → 8.8, not 8.9)", () => {
    // The canonical 10×8×100mm slab at 10% waste is the classic fp-drift trap.
    expect(line(calculateFoundationTakeoff(BASE), "slab_concrete").quantity).toBe(8.8);
  });

  it("mesh count rounds UP to whole sheets", () => {
    const out = calculateFoundationTakeoff(BASE);
    expect(Number.isInteger(line(out, "mesh").quantity)).toBe(true);
    expect(line(out, "mesh").quantity).toBe(7);
  });

  it("honours a custom waste percentage", () => {
    const out = calculateFoundationTakeoff({ ...BASE, config: { concrete_waste_pct: 20 } });
    // 8.0 × 1.2 = 9.6
    expect(line(out, "slab_concrete").quantity).toBe(9.6);
  });

  it("honours a custom mesh sheet size", () => {
    const out = calculateFoundationTakeoff({
      ...BASE,
      config: { mesh_sheet_length_m: 3.6, mesh_sheet_width_m: 2.0, mesh_lap_m: 0 },
    });
    // eff = 3.6×2.0 = 7.2 ; 80/7.2 = 11.11 → 12
    expect(line(out, "mesh").quantity).toBe(12);
  });

  it("throws when the mesh lap is >= a sheet dimension (config bug)", () => {
    expect(() =>
      calculateFoundationTakeoff({ ...BASE, config: { mesh_lap_m: 3 } }),
    ).toThrow(/mesh_lap_m/);
  });
});

describe("foundation calculator — config surface", () => {
  it("exposes resolved config on the result", () => {
    const out = calculateFoundationTakeoff(BASE);
    expect(out.config).toEqual(DEFAULT_FOUNDATION_CONFIG);
  });
});
