import { describe, expect, it } from "vitest";
import { calculateMaterialTakeoff, type MaterialTakeoffResult } from "./materialCalculator";

function line(result: MaterialTakeoffResult, id: string) {
  return result.materials.find((m) => m.id === id);
}

// Hardening pass: insulation applies to EXTERIOR walls only, never interior.
describe("calculateMaterialTakeoff — insulation is exterior-only", () => {
  it("exterior wall length known → insulation sized off exterior area, no review warning", () => {
    const exterior = calculateMaterialTakeoff({
      wallLengthM: 40, // total run (exterior + interior)
      exteriorWallLengthM: 20, // only the perimeter walls
      wallHeightM: 2.4,
      includeInsulation: true,
      wastePercent: 0,
      insulationPackCoverageM2: 8.8,
    });
    const total = calculateMaterialTakeoff({
      wallLengthM: 40,
      wallHeightM: 2.4,
      includeInsulation: true,
      wastePercent: 0,
      insulationPackCoverageM2: 8.8,
    });

    const exteriorPacks = line(exterior, "pink-batts")!.quantity;
    const totalPacks = line(total, "pink-batts")!.quantity;

    // 20m exterior × 2.4 = 48 m² → ceil(48/8.8) = 6 packs.
    expect(exteriorPacks).toBe(6);
    // Exterior-only is strictly fewer than insulating the whole 40m run.
    expect(exteriorPacks).toBeLessThan(totalPacks);
    // When we know the exterior length the note is the clean exterior-only one
    // (no "review/confirm" caveat).
    expect(line(exterior, "pink-batts")!.notes).toBe("Exterior walls only.");
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

  it("exterior length unknown → falls back to total but FLAGS the line for review (no silent interior insulation)", () => {
    const result = calculateMaterialTakeoff({
      wallLengthM: 30,
      // exteriorWallLengthM omitted — the common scan case (single total run).
      wallHeightM: 2.4,
      includeInsulation: true,
    });
    // No silent interior insulation: the line is flagged exterior-only for review.
    expect(line(result, "pink-batts")!.notes).toMatch(/review and exclude interior walls/i);
    expect(line(result, "pink-batts")!.formula).toMatch(/exterior-only/i);
  });
});
