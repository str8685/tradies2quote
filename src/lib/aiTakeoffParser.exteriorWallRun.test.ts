import { describe, expect, it } from "vitest";
import {
  extractStructuredPlanMarker,
  parseTakeoffDescription,
  runTakeoff,
} from "./aiTakeoffParser";
import type { MaterialTakeoffResult } from "./materialCalculator";

function pinkBatts(r: MaterialTakeoffResult | null) {
  return r?.materials.find((m) => m.id === "pink-batts");
}

// "gib both sides" supplies gibSides so canRunCalculator(wall) runs (mirrors a
// real scan transcript, which carries the lining sides).
const WITH_EXTERIOR =
  "[T2Q_PLAN] type=wall wall_run_m=40 exterior_wall_run_m=20 height_m=2.4\ngib both sides";
const WITHOUT_EXTERIOR =
  "[T2Q_PLAN] type=wall wall_run_m=40 height_m=2.4\ngib both sides";

describe("exterior_wall_run_m wiring — scan marker → calculator", () => {
  it("parses exterior_wall_run_m off the marker", () => {
    const m = extractStructuredPlanMarker(WITH_EXTERIOR);
    expect(m?.exteriorWallRunM).toBe(20);
    expect(m?.wallRunM).toBe(40);
  });

  it("threads exterior run into the wall calculator input (clamped to the total)", () => {
    const parsed = parseTakeoffDescription(WITH_EXTERIOR);
    expect(parsed.type).toBe("wall");
    if (parsed.type === "wall") {
      expect(parsed.input.exteriorWallLengthM).toBe(20);
      expect(parsed.input.wallLengthM).toBe(40);
    }
  });

  it("exterior present → exact exterior-only insulation, NOT review-required", () => {
    const r = runTakeoff(parseTakeoffDescription(WITH_EXTERIOR));
    const batts = pinkBatts(r);
    expect(batts).toBeDefined();
    expect(batts!.requiresReview).toBeFalsy();
    expect(batts!.notes).toBe("Exterior walls only.");
    expect(batts!.quantity).toBeGreaterThan(0);
  });

  it("exterior present calculates; exterior absent is BLOCKED at zero (strict)", () => {
    const withExt = pinkBatts(runTakeoff(parseTakeoffDescription(WITH_EXTERIOR)))!;
    const withoutExt = pinkBatts(runTakeoff(parseTakeoffDescription(WITHOUT_EXTERIOR)))!;
    expect(withExt.quantity).toBeGreaterThan(0);
    expect(withoutExt.quantity).toBe(0);
    expect(withoutExt.blocked).toBe(true);
  });

  it("exterior ABSENT → STRICT: blocked zero-quantity line, never sized off the total run", () => {
    const parsed = parseTakeoffDescription(WITHOUT_EXTERIOR);
    if (parsed.type === "wall") {
      expect(parsed.input.exteriorWallLengthM).toBeUndefined();
    }
    const batts = pinkBatts(runTakeoff(parsed));
    expect(batts!.blocked).toBe(true);
    expect(batts!.quantity).toBe(0);
    expect(batts!.notes).toMatch(/enter the exterior wall run|type the pack count/i);
  });

  it("an inconsistent exterior > total is clamped to the total (no over-insulation)", () => {
    const parsed = parseTakeoffDescription("[T2Q_PLAN] type=wall wall_run_m=30 exterior_wall_run_m=45 height_m=2.4");
    if (parsed.type === "wall") {
      expect(parsed.input.exteriorWallLengthM).toBe(30);
    }
  });

  it("deck path is unaffected — no exterior wiring, no insulation line", () => {
    const parsed = parseTakeoffDescription("[T2Q_PLAN] type=deck length_m=6 width_m=4");
    expect(parsed.type).toBe("deck");
    const r = runTakeoff(parsed);
    expect(pinkBatts(r)).toBeUndefined();
  });
});
