import { describe, expect, it } from "vitest";
import { calculateMaterialTakeoff, type MaterialTakeoffResult } from "./materialCalculator";

function line(result: MaterialTakeoffResult, id: string) {
  return result.materials.find((m) => m.id === id);
}

// STRICT exterior-only rule: insulation is calculated ONLY with exterior
// evidence; without it the line is BLOCKED at quantity 0 — never sized off
// the total run, not even flagged.
describe("calculateMaterialTakeoff — insulation is exterior-only (strict)", () => {
  it("exterior wall length known → insulation sized off exterior area, no review warning", () => {
    const exterior = calculateMaterialTakeoff({
      wallLengthM: 40, // total run (exterior + interior)
      exteriorWallLengthM: 20, // only the perimeter walls
      wallHeightM: 2.4,
      includeInsulation: true,
      wastePercent: 0,
      insulationPackCoverageM2: 8.8,
    });

    const exteriorPacks = line(exterior, "pink-batts")!.quantity;

    // 20m exterior × 2.4 = 48 m² → ceil(48/8.8) = 6 packs.
    expect(exteriorPacks).toBe(6);
    // When we know the exterior length the note is the clean exterior-only one
    // (no "review/confirm" caveat) and the line is neither flagged nor blocked.
    expect(line(exterior, "pink-batts")!.notes).toBe("Exterior walls only.");
    expect(line(exterior, "pink-batts")!.requiresReview).toBeFalsy();
    expect(line(exterior, "pink-batts")!.blocked).toBeFalsy();
  });

  it("interior-only wall (exteriorWallLengthM = 0) → zero insulation packs", () => {
    const result = calculateMaterialTakeoff({
      wallLengthM: 12,
      exteriorWallLengthM: 0, // purely an internal room divider
      wallHeightM: 2.4,
      includeInsulation: true,
    });
    // Framing/GIB still produced for the interior wall…
    expect(line(result, "studs-90x45")!.quantity).toBeGreaterThan(0);
    expect(line(result, "gib-10mm")!.quantity).toBeGreaterThan(0);
    // …but NO insulation on an interior wall.
    expect(line(result, "pink-batts")!.quantity).toBe(0);
  });

  it("exterior length unknown → BLOCKED at quantity 0 (never sized off the total run)", () => {
    const result = calculateMaterialTakeoff({
      wallLengthM: 30,
      // exteriorWallLengthM omitted — the common marker-less scan case.
      wallHeightM: 2.4,
      includeInsulation: true,
    });
    const batts = line(result, "pink-batts")!;
    // STRICT: impossible without exterior evidence — zero quantity, blocked,
    // with the recovery instructions in the notes. The generate route and the
    // editor map blocked → takeoff_status="blocked" (hard send block).
    expect(batts.blocked).toBe(true);
    expect(batts.quantity).toBe(0);
    expect(batts.notes).toMatch(/exterior wall run and recalculate|type the pack count/i);
    expect(batts.formula).toMatch(/blocked — exterior-only/i);
  });

  it("determinism: same inputs → identical insulation output", () => {
    const a = calculateMaterialTakeoff({ wallLengthM: 30, wallHeightM: 2.4, includeInsulation: true });
    const b = calculateMaterialTakeoff({ wallLengthM: 30, wallHeightM: 2.4, includeInsulation: true });
    expect(JSON.stringify(line(a, "pink-batts"))).toBe(JSON.stringify(line(b, "pink-batts")));
  });
});
