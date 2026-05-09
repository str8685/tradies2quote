import { describe, expect, it } from "vitest";
import {
  calculateMaterialTakeoff,
  type MaterialTakeoffResult,
} from "./materialCalculator";

function getMaterial(result: MaterialTakeoffResult, id: string) {
  return result.materials.find((m) => m.id === id);
}

describe("calculateMaterialTakeoff", () => {
  it("4m wall, 2.4m high, 600 centres, no openings — happy path", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      wallHeightM: 2.4,
      studSpacingMm: 600,
    });

    expect(r.warnings).toEqual([]);
    expect(r.summary.wallAreaM2).toBeCloseTo(9.6, 5);
    expect(r.summary.openingAreaM2).toBe(0);
    expect(r.summary.netWallAreaM2).toBeCloseTo(9.6, 5);

    // baseStuds = ceil(4000/600) + 1 = 7 + 1 = 8, no opening studs
    expect(getMaterial(r, "studs-90x45")?.quantity).toBe(8);
    // plates: ceil((4*3)/4.8) = ceil(2.5) = 3
    expect(getMaterial(r, "plates-90x45")?.quantity).toBe(3);
    // nogs: ceil(4/4.8) = 1
    expect(getMaterial(r, "nogs-90x45")?.quantity).toBe(1);
    // gib both sides default: ceil((9.6 * 2 * 1.1) / (1.2*2.4)) = ceil(21.12/2.88) = 8
    expect(getMaterial(r, "gib-10mm")?.quantity).toBe(8);
    // gib screws: ceil(8 * 40 * 1.1) = 352
    expect(getMaterial(r, "gib-screws")?.quantity).toBe(352);
    // adhesive: ceil(8/4) = 2
    expect(getMaterial(r, "gib-adhesive")?.quantity).toBe(2);
    // insulation default true: ceil((9.6 * 1.1) / 8.8) = ceil(1.2) = 2
    expect(getMaterial(r, "pink-batts")?.quantity).toBe(2);
    // framing nails fixed
    expect(getMaterial(r, "framing-nails")?.quantity).toBe(1);
  });

  it("4m wall with one door reduces net area and adds opening studs", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      numberOfDoors: 1,
    });

    // door area = 1 * 0.82 * 2.04 = 1.6728
    expect(r.summary.openingAreaM2).toBeCloseTo(1.67, 1);
    expect(r.summary.netWallAreaM2).toBeCloseTo(9.6 - 1.6728, 2);
    // base 8 + 4 opening studs = 12
    expect(getMaterial(r, "studs-90x45")?.quantity).toBe(12);
  });

  it("GIB one side halves sheet count vs both sides", () => {
    const oneSide = calculateMaterialTakeoff({
      wallLengthM: 4,
      gibSides: 1,
    });
    const twoSides = calculateMaterialTakeoff({
      wallLengthM: 4,
      gibSides: 2,
    });
    // one side: ceil((9.6 * 1 * 1.1) / 2.88) = ceil(3.667) = 4
    expect(getMaterial(oneSide, "gib-10mm")?.quantity).toBe(4);
    expect(getMaterial(twoSides, "gib-10mm")?.quantity).toBe(8);
  });

  it("GIB both sides matches the baseline", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      gibSides: 2,
    });
    expect(getMaterial(r, "gib-10mm")?.quantity).toBe(8);
  });

  it("insulation on includes Pink Batts", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      includeInsulation: true,
    });
    expect(getMaterial(r, "pink-batts")).toBeTruthy();
    expect(getMaterial(r, "pink-batts")?.quantity).toBe(2);
  });

  it("insulation off omits Pink Batts entirely", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      includeInsulation: false,
    });
    expect(getMaterial(r, "pink-batts")).toBeUndefined();
  });

  it("skirting on includes skirting lengths", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      gibSides: 2,
      includeSkirting: true,
    });
    // ceil((4 * 2 * 1.1) / 4.8) = ceil(8.8/4.8) = ceil(1.833) = 2
    expect(getMaterial(r, "skirting")?.quantity).toBe(2);
  });

  it("architraves on includes architrave lengths for each door", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      numberOfDoors: 1,
      includeArchitraves: true,
    });
    // 1 * (2.04*2 + 0.82) = 4.90; *1.1 = 5.39; ceil(5.39/4.8) = 2
    expect(getMaterial(r, "architraves")?.quantity).toBe(2);
  });

  it("invalid wall length emits warning", () => {
    const r = calculateMaterialTakeoff({ wallLengthM: 0 });
    expect(r.warnings.some((w) => w.includes("wallLengthM"))).toBe(true);
  });

  it("invalid stud spacing emits warning", () => {
    const r = calculateMaterialTakeoff({
      wallLengthM: 4,
      studSpacingMm: 500,
    });
    expect(r.warnings.some((w) => w.includes("studSpacingMm"))).toBe(true);
  });
});
