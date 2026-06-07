import { describe, expect, it } from "vitest";
import { blockedLineGuide, blockedScopeFromDescription } from "./blockedLineGuide";

describe("blockedScopeFromDescription", () => {
  it("reads the scope off a blocked line description", () => {
    expect(blockedScopeFromDescription("framing takeoff — needs dimensions before it can be quoted")).toBe("framing");
    expect(blockedScopeFromDescription("insulation takeoff — needs dimensions before it can be quoted")).toBe("insulation");
    expect(blockedScopeFromDescription("90x45 SG8 Studs")).toBeNull();
    expect(blockedScopeFromDescription(undefined)).toBeNull();
  });
});

describe("blockedLineGuide — human recovery copy per line type", () => {
  it("framing/wall ask for wall length + height", () => {
    for (const scope of ["framing", "wall"]) {
      const g = blockedLineGuide(`${scope} takeoff — needs dimensions before it can be quoted`);
      expect(g.toLowerCase()).toContain("wall length");
      expect(g.toLowerCase()).toContain("wall height");
      // Always offers the obvious next actions.
      expect(g.toLowerCase()).toContain("recalculate");
      expect(g.toLowerCase()).toContain("quantity");
      expect(g.toLowerCase()).toContain("remove");
    }
  });

  it("insulation copy is exterior-area oriented", () => {
    const g = blockedLineGuide("insulation takeoff — needs dimensions before it can be quoted");
    expect(g.toLowerCase()).toContain("exterior wall area");
  });

  it("concrete asks for L×W or volume; fixing asks for length/perimeter", () => {
    expect(blockedLineGuide("concrete takeoff — needs dimensions before it can be quoted").toLowerCase()).toContain("volume");
    expect(blockedLineGuide("fixing takeoff — needs dimensions before it can be quoted").toLowerCase()).toContain("perimeter");
  });

  it("unknown scope still gives an actionable fallback (no crash, no guess)", () => {
    const g = blockedLineGuide("mystery takeoff — needs dimensions before it can be quoted");
    expect(g.toLowerCase()).toContain("dimensions are missing");
    expect(g.toLowerCase()).toContain("recalculate");
  });
});
