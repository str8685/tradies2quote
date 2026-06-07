import { describe, expect, it } from "vitest";
import {
  calculateDeckTakeoff,
  calculateMaterialTakeoff,
  type MaterialTakeoffResult,
} from "./materialCalculator";

function categories(result: MaterialTakeoffResult): Set<string> {
  return new Set(result.materials.map((m) => m.category));
}

// Plan-driven material DOMAIN separation: a wall/house job must carry the wall
// material families (Framing / Lining (GIB) / Insulation) and NEVER deck
// families; a deck job must carry deck families and NEVER wall-only insulation.
describe("material families stay in the correct domain", () => {
  it("house/wall takeoff renders Framing + Lining (GIB) + Insulation, never deck", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 24,
      exteriorWallLengthM: 12,
      wallHeightM: 2.4,
      includeInsulation: true,
    });
    const cats = categories(r);
    expect(cats).toContain("Framing"); // studs / plates / nogs
    expect(cats).toContain("Lining"); // 10mm GIB board
    expect(cats).toContain("Insulation"); // pink batts (exterior)

    // No deck families leak into a wall job.
    for (const deckCat of ["Joists", "Bearers", "Decking", "Piles"]) {
      expect(cats.has(deckCat)).toBe(false);
    }
    // The GIB line lives in the lining domain.
    expect(r.materials.find((m) => m.id === "gib-10mm")?.category).toBe("Lining");
  });

  it("deck takeoff renders deck families and NEVER wall insulation / GIB", () => {
    const r = calculateDeckTakeoff({ deckLengthM: 6, deckWidthM: 4 });
    const cats = categories(r);
    expect(cats).toContain("Decking");
    expect(cats).toContain("Joists");
    expect(cats).toContain("Bearers");

    // Deck must not leak wall-only insulation or lining.
    expect(cats.has("Insulation")).toBe(false);
    expect(cats.has("Lining")).toBe(false);
    expect(r.materials.some((m) => m.id === "pink-batts")).toBe(false);
    expect(r.materials.some((m) => m.id === "gib-10mm")).toBe(false);
  });
});
