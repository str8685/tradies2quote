// ─────────────────────────────────────────────────────────────────────────
// sheetAdapter — ExtractedSheet → BridgeSheetInput, SCAFFOLD ONLY (non-runtime).
//
// Glues the plan-reader extraction (an ExtractedSheet of labelled dims +
// detected openings) to the bridge input the calculators consume, using ONLY
// the deterministic text tagger. It:
//   - tags dimensions whose printed text explicitly names a calculator role,
//   - keeps untagged dimensions separate for a later USER-CONFIRMATION step,
//   - keeps recognized overall building dims (building_length/_width) OUT of
//     the calculator-consumable input — they are surfaced separately and never
//     converted to wall run / perimeter (decision #2),
//   - passes detected openings through with NULL sizes (never measured/guessed).
//
// Pure + deterministic. Type-only import of ExtractedSheet (no runtime coupling).
// NOT imported by any route, UI, calculator, or live planreader flow. No wiring.
// ─────────────────────────────────────────────────────────────────────────

import type { ExtractedSheet } from "@/lib/planreader/schema";
import type { ScopeType } from "../schemas";
import type {
  BridgeOpening,
  BridgeSheetInput,
  RoledDimension,
} from "./sheetToExtraction";
import { tagDimensions, type RawLabelledDimension } from "./roleTagger";

/** Roles that no calculator consumes (recognized building overall dims). */
const NON_CONSUMABLE_ROLES = new Set<RoledDimension["role"]>([
  "building_length",
  "building_width",
]);

export interface AdaptedSheet {
  /**
   * Ready to hand to `sheetToExtraction`. Carries ONLY calculator-consumable
   * roled dims (length/width/height/area/perimeter) + detected openings.
   * If empty/insufficient, the bridge will block — the adapter never guesses.
   */
  bridgeInput: BridgeSheetInput;
  /**
   * Labelled dims the tagger could not confidently role — preserved verbatim
   * for the later user-confirmation step (NOT discarded, NOT guessed).
   */
  untagged: RawLabelledDimension[];
  /**
   * Recognized overall building dims (building_length/_width). Surfaced so a
   * future user-confirmed step can decide whether they become a wall run or a
   * perimeter — the adapter never makes that conversion.
   */
  buildingDims: RoledDimension[];
  /** Pass-through scale context for the confirmation UI (no decisions taken). */
  scale: { text: string | null; confidence: number };
}

function toRaw(d: ExtractedSheet["dimensions"][number]): RawLabelledDimension {
  return { value_m: d.value_m, raw_text: d.raw_text };
}

/** Detected openings → bridge openings: count each, sizes stay NULL (unmeasured). */
function adaptOpenings(geo: ExtractedSheet["geometry"]): BridgeOpening[] {
  return geo.openings.map((o) => ({
    kind: o.kind,
    width_m: null,
    height_m: null,
    count: 1,
  }));
}

/**
 * Adapt one ExtractedSheet for one target scope. Pure; non-mutating.
 */
export function adaptSheetToBridgeInput(
  sheet: ExtractedSheet,
  scope: ScopeType,
): AdaptedSheet {
  const { tagged, untagged } = tagDimensions(sheet.dimensions.map(toRaw));

  const consumable: RoledDimension[] = [];
  const buildingDims: RoledDimension[] = [];
  for (const r of tagged) {
    if (NON_CONSUMABLE_ROLES.has(r.role)) buildingDims.push(r);
    else consumable.push(r);
  }

  const bridgeInput: BridgeSheetInput = {
    scope,
    roledDimensions: consumable,
    openings: adaptOpenings(sheet.geometry),
  };

  return {
    bridgeInput,
    untagged,
    buildingDims,
    scale: { text: sheet.scale_text, confidence: sheet.scale_confidence },
  };
}
