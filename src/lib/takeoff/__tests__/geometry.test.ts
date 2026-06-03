import { describe, expect, it } from "vitest";
import {
  circleArea,
  circleCircumference,
  computePlanGeometry,
  rectArea,
  rectPerimeter,
  regionsArea,
  trapezoidArea,
  triangleArea,
} from "../geometry";

describe("primitive area helpers", () => {
  it("rectangle area + perimeter", () => {
    expect(rectArea(6, 8)).toBe(48);
    expect(rectPerimeter(6, 8)).toBe(28);
  });

  it("triangle area = ½·b·h", () => {
    expect(triangleArea(4, 3)).toBe(6);
  });

  it("circle area + circumference", () => {
    expect(circleArea(2)).toBeCloseTo(12.57, 1);
    expect(circleCircumference(2)).toBeCloseTo(12.57, 1);
  });

  it("trapezoid area = ½·(a+b)·h", () => {
    expect(trapezoidArea(4, 6, 2)).toBe(10);
  });

  it("ignores non-finite / negative inputs", () => {
    expect(rectArea(-3, 8)).toBe(0);
    expect(triangleArea(Number.NaN, 3)).toBe(0);
    expect(regionsArea([{ width_m: -1, length_m: 5 }])).toBe(0);
  });
});

describe("regionsArea (composite footprints)", () => {
  it("sums sub-rectangle areas", () => {
    // An L-shape: a 6×8 leg plus a 4×3 leg = 48 + 12 = 60 m².
    expect(
      regionsArea([
        { width_m: 6, length_m: 8 },
        { width_m: 4, length_m: 3 },
      ]),
    ).toBe(60);
  });

  it("returns 0 for empty / missing", () => {
    expect(regionsArea([])).toBe(0);
    expect(regionsArea(null)).toBe(0);
    expect(regionsArea(undefined)).toBe(0);
  });
});

describe("computePlanGeometry", () => {
  it("an L-shape from regions sums areas and uses bounding-box perimeter", () => {
    const g = computePlanGeometry({
      shape: "l_shape",
      width_m: 10,
      length_m: 8,
      regions: [
        { width_m: 6, length_m: 8 },
        { width_m: 4, length_m: 3 },
      ],
    });
    expect(g.area_m2).toBe(60);
    // A true L-shape's outline == its bounding box: 2*(10+8) = 36.
    expect(g.perimeter_m).toBe(36);
    expect(g.composite).toBe(true);
    expect(g.label).toContain("L-shape");
  });

  it("does NOT over-quote: composite area < bounding box area", () => {
    const g = computePlanGeometry({
      shape: "l_shape",
      width_m: 10,
      length_m: 8,
      regions: [
        { width_m: 6, length_m: 8 },
        { width_m: 4, length_m: 3 },
      ],
    });
    expect(g.area_m2).toBeLessThan(rectArea(10, 8)); // 60 < 80
  });

  it("triangle primitive", () => {
    const g = computePlanGeometry({
      shape: "triangle",
      width_m: 4,
      length_m: 3,
      tri_base_m: 4,
      tri_height_m: 3,
    });
    expect(g.area_m2).toBe(6);
    expect(g.perimeter_m).toBeNull();
    expect(g.composite).toBe(true);
  });

  it("circle primitive computes area + circumference", () => {
    const g = computePlanGeometry({
      shape: "circle",
      width_m: 4,
      length_m: 4,
      radius_m: 2,
    });
    expect(g.area_m2).toBeCloseTo(12.57, 1);
    expect(g.perimeter_m).toBeCloseTo(12.57, 1);
    expect(g.composite).toBe(true);
  });

  it("line (fence) has no area, perimeter = run length", () => {
    const g = computePlanGeometry({
      shape: "line",
      width_m: 0,
      length_m: 24,
    });
    expect(g.area_m2).toBe(0);
    expect(g.perimeter_m).toBe(24);
    expect(g.composite).toBe(false);
  });

  it("falls back to bounding-box rectangle when no regions/primitive", () => {
    const g = computePlanGeometry({ shape: "rect", width_m: 6, length_m: 8 });
    expect(g.area_m2).toBe(48);
    expect(g.perimeter_m).toBe(28);
    expect(g.composite).toBe(false);
  });

  it("primitive with missing dims falls back to bounding box", () => {
    const g = computePlanGeometry({
      shape: "triangle",
      width_m: 6,
      length_m: 8,
      tri_base_m: null,
      tri_height_m: null,
    });
    expect(g.area_m2).toBe(48); // bbox fallback
    expect(g.composite).toBe(false);
  });
});
