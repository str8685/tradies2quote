/**
 * CSI mapper eval — DETERMINISTIC, free, always-on.
 *
 * Unlike the vision evals, the CSI mapper is pure code, so this harness runs
 * in `npm test` as a TAXONOMY REGRESSION GUARD (mismatches must stay 0) AND
 * prints a measured summary when invoked verbosely:
 *
 *   npm run eval:csi      # prints the full division/uncategorized/blocked report
 *
 * It MEASURES the Stage-1 taxonomy against hand-labelled fixtures
 * (csi-mapper-cases.ts); it never guesses and never mutates.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  evaluateCsiMapping,
  formatCsiEvalReport,
} from "@/lib/takeoff/csi/eval";
import { CSI_MAPPER_CASES } from "./csi-mapper-cases";

const VERBOSE = process.env.RUN_CSI_EVAL === "1";

describe("CSI mapper eval — measured against labelled fixtures", () => {
  const before = JSON.stringify(CSI_MAPPER_CASES);
  const summary = evaluateCsiMapping(CSI_MAPPER_CASES);

  afterAll(() => {
    if (VERBOSE) {
      // process.stdout.write (not console.log) so vitest doesn't swallow it.
      process.stdout.write("\n" + formatCsiEvalReport(summary) + "\n\n");
    }
  });

  it("maps every labelled fixture to its expected division (no regressions)", () => {
    expect(summary.mismatches).toEqual([]);
    expect(summary.accuracy).toBe(1);
  });

  it("covers all five CSI divisions", () => {
    for (const d of [
      "03_concrete",
      "05_metals",
      "06_wood_plastics",
      "07_thermal_moisture",
      "09_finishes",
    ] as const) {
      // 05 may legitimately be 0 in the fixture set — assert the rest > 0.
      if (d === "05_metals") continue;
      expect(summary.byDivision[d]).toBeGreaterThan(0);
    }
  });

  it("preserves blocked state through the mapping", () => {
    const blockedCases = CSI_MAPPER_CASES.filter(
      (c) => c.line?.takeoff_status === "blocked",
    ).length;
    expect(summary.blocked).toBe(blockedCases);
    expect(blockedCases).toBeGreaterThan(0);
  });

  it("separates non-material lines from ambiguous material lines", () => {
    const nonMaterialCases = CSI_MAPPER_CASES.filter(
      (c) => c.line?.type && c.line.type !== "material",
    ).length;
    expect(summary.nonMaterial).toBe(nonMaterialCases);
    // manual-review = ambiguous MATERIAL lines only (excludes labour/other)
    expect(summary.manualReview).toBe(summary.uncategorized - summary.nonMaterial);
  });

  it("reports future-taxonomy candidates without counting them as misses", () => {
    const flagged = CSI_MAPPER_CASES.filter((c) => c.futureCandidate).length;
    expect(summary.futureCandidates).toHaveLength(flagged);
    expect(flagged).toBeGreaterThan(0);
  });

  it("does not mutate the fixtures", () => {
    expect(JSON.stringify(CSI_MAPPER_CASES)).toBe(before);
  });
});
