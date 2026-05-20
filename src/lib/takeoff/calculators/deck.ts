// ─────────────────────────────────────────────────────────────────────────
// Deck calculator — wrapper around the legacy materialCalculator.
//
// The existing `calculateDeckTakeoff` in src/lib/materialCalculator.ts
// has been battle-tested by Waves 40–43 (ratio guards, unit-confusion
// fixes, stock-length conversion). Re-implementing it would lose all
// that hardening. Instead this wrapper:
//
//   1. Translates the takeoff-module ExtractedExtraction into the
//      legacy DeckTakeoffInput shape.
//   2. Calls the legacy calculator.
//   3. Translates each legacy MaterialTakeoffLine into the new
//      TakeoffLine shape with per-line status + basis.
//
// All of the original formula strings are preserved on the basis so
// explain.ts can render them unchanged.
// ─────────────────────────────────────────────────────────────────────────

import {
  calculateDeckTakeoff,
  type DeckTakeoffInput,
  type MaterialTakeoffLine,
} from "../../materialCalculator";
import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";

export function runDeckCalculator(ext: ExtractedExtraction): ScopeResult {
  const length_m = ext.dimensions.length_m ?? 0;
  const width_m = ext.dimensions.width_m ?? 0;
  const assumptions: string[] = [];

  const input: DeckTakeoffInput = {
    deckLengthM: length_m,
    deckWidthM: width_m,
    joistSpacingMm: ext.spacing_mm ?? undefined,
    wastePercent: ext.waste_percent ?? undefined,
    timberStockLengthM: ext.stock_length_m ?? undefined,
  };
  if (ext.spacing_mm === null || ext.spacing_mm === undefined) {
    assumptions.push("Used default joist spacing 450mm (NZ residential).");
  }
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }
  if (ext.stock_length_m === null || ext.stock_length_m === undefined) {
    assumptions.push("Used default 4.8m timber stock length.");
  }

  const legacy = calculateDeckTakeoff(input);
  const lines: TakeoffLine[] = legacy.materials.map((m) =>
    legacyToTakeoffLine(m, assumptions, legacy.warnings),
  );

  const status = worstStatus([
    ...(legacy.warnings.length > 0 ? (["needs_review"] as const) : []),
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "deck",
    status,
    summary: {
      primary_metric: "deck area",
      primary_value: legacy.summary.netWallAreaM2,
      unit: "m²",
      inputs: {
        length_m,
        width_m,
        joist_spacing_mm: ext.spacing_mm ?? 450,
        stock_length_m: ext.stock_length_m ?? 4.8,
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

/**
 * Convert a legacy MaterialTakeoffLine into the new TakeoffLine.
 * `commonAssumptions` and `globalWarnings` are scope-level signals
 * that promote a line out of "ok" — they're reused by every
 * legacy-wrapping calculator so the mapping logic lives in one place.
 */
export function legacyToTakeoffLine(
  m: MaterialTakeoffLine,
  commonAssumptions: string[],
  globalWarnings: string[],
): TakeoffLine {
  // Detect the ratio-guard annotation the legacy calculator writes
  // into the formula when it clamps a line. That always means "needs
  // review" — the inputs were so far off the cap kicked in.
  const ratioGuarded = /\[ratio_guard:/.test(m.formula);
  const validation_flags: string[] = ratioGuarded
    ? ["ratio_guard_triggered"]
    : [];
  const status =
    ratioGuarded || globalWarnings.length > 0
      ? "needs_review"
      : commonAssumptions.length > 0
        ? "assumed"
        : "ok";
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    quantity: m.quantity,
    unit: m.unit,
    status,
    basis: {
      formula: m.formula,
      inputs: {},
      assumed: commonAssumptions,
    },
    confidence:
      status === "ok" ? 0.9 : status === "assumed" ? 0.7 : 0.5,
    assumption_flags: commonAssumptions,
    validation_flags,
    explanation: m.notes ?? "",
    priceMatchKey: m.priceMatchKey,
  };
}
