// ─────────────────────────────────────────────────────────────────────────
// Roofing calculator.
//
// Plan area + pitch → actual area. Then convert to sheet count by
// dividing by sheet coverage (length × cover width). Defaults are long-
// run colorsteel: 0.762m cover width, sheets supplied to length so
// "lengths" rather than "sheets" is the right unit when length is
// known. For lengths-on-tile or sheet-cut roofs, the caller can hint
// via ext.material_spec.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { roofAreaFromPitch, round2, safeCeil } from "../normalise";

const DEFAULT_PITCH_DEG = 15;
const DEFAULT_COVER_WIDTH_M = 0.762; // long-run colorsteel
const DEFAULT_SHEET_AREA_M2 = 2.16; // 2.7m × 0.8m typical tile-batten panel

export function runRoofingCalculator(ext: ExtractedExtraction): ScopeResult {
  const assumptions: string[] = [];
  const wastePct = ext.waste_percent ?? 10;
  const pitch =
    ext.dimensions.pitch_deg !== null && ext.dimensions.pitch_deg !== undefined
      ? ext.dimensions.pitch_deg
      : DEFAULT_PITCH_DEG;
  if (ext.dimensions.pitch_deg === null || ext.dimensions.pitch_deg === undefined) {
    assumptions.push(`Assumed pitch ${DEFAULT_PITCH_DEG}° (low-pitch default).`);
  }
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }

  // Plan area: explicit, or L×W.
  const planArea =
    ext.dimensions.area_m2 !== null && ext.dimensions.area_m2 !== undefined
      ? ext.dimensions.area_m2
      : round2(
          (ext.dimensions.length_m ?? 0) * (ext.dimensions.width_m ?? 0),
        );

  const actualArea = roofAreaFromPitch(planArea, pitch);
  const lines: TakeoffLine[] = [];

  // Long-run colorsteel: lengths-cut-to-roof. Quantity = number of
  // lengths along the cover-width direction; LM per length = the
  // ridge-to-eave run.
  const isTile = /(tile)/i.test(ext.material_spec ?? "");
  const coverWidth = DEFAULT_COVER_WIDTH_M;
  if (!isTile) {
    const widthM =
      Number.isFinite(ext.dimensions.width_m ?? NaN) &&
      (ext.dimensions.width_m ?? 0) > 0
        ? (ext.dimensions.width_m as number)
        : Math.sqrt(planArea); // fall back to a square assumption
    const sheetCount = safeCeil(
      ((widthM * (1 + wastePct / 100)) / coverWidth),
    );
    lines.push({
      id: "roof-sheets",
      name: ext.material_spec ?? "Long-run colorsteel sheets",
      category: "Roofing",
      quantity: sheetCount,
      unit: "lengths",
      status: assumptions.length > 0 ? "assumed" : "ok",
      basis: {
        formula: `ceil(width=${widthM}m × (1+${wastePct}/100) / cover=${coverWidth}m) = ${sheetCount}`,
        inputs: {
          plan_area_m2: planArea,
          actual_area_m2: actualArea,
          pitch_deg: pitch,
          cover_width_m: coverWidth,
          waste_percent: wastePct,
        },
        assumed: assumptions,
      },
      confidence: assumptions.length > 0 ? 0.65 : 0.85,
      assumption_flags: assumptions,
      validation_flags: [],
      explanation: `${sheetCount} sheets across ${widthM}m width. Lengths cut to your roof run.`,
      priceMatchKey: "long-run-colorsteel",
    });
  } else {
    const sheets = safeCeil(
      (actualArea * (1 + wastePct / 100)) / DEFAULT_SHEET_AREA_M2,
    );
    lines.push({
      id: "roof-tiles",
      name: ext.material_spec ?? "Roof tiles",
      category: "Roofing",
      quantity: sheets,
      unit: "packs",
      status: assumptions.length > 0 ? "assumed" : "ok",
      basis: {
        formula: `ceil(actualArea=${actualArea}m² × (1+${wastePct}/100) / panelArea=${DEFAULT_SHEET_AREA_M2}m²) = ${sheets}`,
        inputs: {
          plan_area_m2: planArea,
          actual_area_m2: actualArea,
          pitch_deg: pitch,
          panel_area_m2: DEFAULT_SHEET_AREA_M2,
          waste_percent: wastePct,
        },
        assumed: assumptions,
      },
      confidence: assumptions.length > 0 ? 0.6 : 0.8,
      assumption_flags: assumptions,
      validation_flags: [],
      explanation: `${sheets} packs cover ${actualArea}m² actual roof area.`,
      priceMatchKey: "roof-tiles",
    });
  }

  // Fixings — roofing screws ~6 per m² for long-run.
  const fixings = safeCeil(actualArea * 6 * (1 + wastePct / 100));
  lines.push({
    id: "roof-fixings",
    name: "Roofing screws",
    category: "Fixings",
    quantity: fixings,
    unit: "each",
    status: "ok",
    basis: {
      formula: `ceil(actualArea=${actualArea}m² × 6 × (1+${wastePct}/100)) = ${fixings}`,
      inputs: { actual_area_m2: actualArea, per_m2: 6, waste_percent: wastePct },
      assumed: [],
    },
    confidence: 0.8,
    assumption_flags: [],
    validation_flags: [],
    explanation: "",
    priceMatchKey: "roofing-screws",
  });

  const status = worstStatus([
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "roofing",
    status,
    summary: {
      primary_metric: "actual roof area",
      primary_value: actualArea,
      unit: "m²",
      inputs: {
        plan_area_m2: planArea,
        actual_area_m2: actualArea,
        pitch_deg: pitch,
        waste_percent: wastePct,
      },
    },
    lines,
    warnings: [],
    assumptions,
    clarifications: [],
    explanation: "",
  };
}
