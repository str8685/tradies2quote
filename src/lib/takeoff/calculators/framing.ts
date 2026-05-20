// ─────────────────────────────────────────────────────────────────────────
// Framing calculator.
//
// Studs / plates / nogs / opening trimmers. Wraps the legacy wall
// framing calculator for the studs/plates/nogs portion, but does NOT
// emit lining/insulation/finishing materials — those belong to the
// lining/insulation/fixing scopes respectively. This is the
// "structural skeleton" only.
// ─────────────────────────────────────────────────────────────────────────

import {
  calculateMaterialTakeoff,
  type MaterialTakeoffInput,
} from "../../materialCalculator";
import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { legacyToTakeoffLine } from "./deck";

const FRAMING_LINE_IDS = new Set([
  "studs-90x45",
  "plates-90x45",
  "nogs-90x45",
  "framing-nails",
]);

export function runFramingCalculator(ext: ExtractedExtraction): ScopeResult {
  const length_m = ext.dimensions.length_m ?? 0;
  const height_m = ext.dimensions.height_m ?? 2.4;
  const assumptions: string[] = [];

  if (ext.dimensions.height_m === null || ext.dimensions.height_m === undefined) {
    assumptions.push("Used default wall height 2.4m.");
  }
  if (ext.spacing_mm === null || ext.spacing_mm === undefined) {
    assumptions.push("Used default 600mm stud spacing.");
  }
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }

  const doors = ext.openings
    .filter((o) => o.kind === "door")
    .reduce((s, o) => s + (o.count ?? 1), 0);
  const windows = ext.openings
    .filter((o) => o.kind === "window")
    .reduce((s, o) => s + (o.count ?? 1), 0);

  const input: MaterialTakeoffInput = {
    wallLengthM: length_m,
    wallHeightM: height_m,
    studSpacingMm: ext.spacing_mm ?? undefined,
    numberOfDoors: doors,
    numberOfWindows: windows,
    // Force gibSides to a value so the calculator runs; we'll DROP all
    // GIB/lining/insulation/finishing lines below and keep only the
    // framing skeleton.
    gibSides: 1,
    includeInsulation: false,
    includeSkirting: false,
    includeArchitraves: false,
    wastePercent: ext.waste_percent ?? undefined,
    timberStockLengthM: ext.stock_length_m ?? undefined,
  };

  const legacy = calculateMaterialTakeoff(input);
  const lines: TakeoffLine[] = legacy.materials
    .filter((m) => FRAMING_LINE_IDS.has(m.id))
    .map((m) => legacyToTakeoffLine(m, assumptions, legacy.warnings));

  const status = worstStatus([
    ...(legacy.warnings.length > 0 ? (["needs_review"] as const) : []),
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "framing",
    status,
    summary: {
      primary_metric: "wall area",
      primary_value: legacy.summary.wallAreaM2,
      unit: "m²",
      inputs: {
        length_m,
        height_m,
        stud_spacing_mm: ext.spacing_mm ?? 600,
        doors,
        windows,
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
