// ─────────────────────────────────────────────────────────────────────────
// Cladding calculator — wrapper around the legacy calculator.
// Same approach as ./deck.ts.
// ─────────────────────────────────────────────────────────────────────────

import {
  calculateCladdingTakeoff,
  type CladdingTakeoffInput,
} from "../../materialCalculator";
import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { legacyToTakeoffLine } from "./deck";

export function runCladdingCalculator(ext: ExtractedExtraction): ScopeResult {
  const length_m = ext.dimensions.length_m ?? 0;
  const height_m = ext.dimensions.height_m ?? 2.4;
  const assumptions: string[] = [];

  if (ext.dimensions.height_m === null || ext.dimensions.height_m === undefined) {
    assumptions.push("Used default wall height 2.4m.");
  }
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }
  if (ext.stock_length_m === null || ext.stock_length_m === undefined) {
    assumptions.push("Used default 4.8m timber stock length.");
  }
  // Board cover width drives the lineal-metre count (same failure mode as the
  // deck-board bug). Flag when it wasn't given so it isn't silently 150mm.
  if (ext.coverage_mm === null || ext.coverage_mm === undefined) {
    assumptions.push(
      "Assumed 150mm cladding cover — state the board profile/cover width for an accurate board count.",
    );
  }

  const opening_area_m2 = ext.openings.reduce(
    (s, o) =>
      s +
      (o.width_m ?? 0) * (o.height_m ?? 0) * (o.count ?? 1),
    0,
  );

  const input: CladdingTakeoffInput = {
    wallLengthM: length_m,
    wallHeightM: height_m,
    openingAreaM2: opening_area_m2 || undefined,
    claddingCoverageMm: ext.coverage_mm ?? undefined,
    wastePercent: ext.waste_percent ?? undefined,
    timberStockLengthM: ext.stock_length_m ?? undefined,
    numberOfOpenings: ext.openings.reduce((s, o) => s + (o.count ?? 1), 0) || undefined,
  };

  const legacy = calculateCladdingTakeoff(input);
  const lines: TakeoffLine[] = legacy.materials.map((m) =>
    legacyToTakeoffLine(m, assumptions, legacy.warnings),
  );

  const status = worstStatus([
    ...(legacy.warnings.length > 0 ? (["needs_review"] as const) : []),
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "cladding",
    status,
    summary: {
      primary_metric: "net cladding area",
      primary_value: legacy.summary.netWallAreaM2,
      unit: "m²",
      inputs: {
        length_m,
        height_m,
        opening_area_m2,
        coverage_mm: ext.coverage_mm ?? 150,
        waste_percent: ext.waste_percent ?? 10,
      },
    },
    lines,
    warnings: legacy.warnings,
    assumptions,
    clarifications: [],
    explanation: "",
  };
}
