// ─────────────────────────────────────────────────────────────────────────
// Generic calculator — stock/coverage fallback.
//
// Used when the scope router lands on "generic" or when a more specific
// calculator can't run (e.g. extraction was too sparse). Produces a
// single TakeoffLine carrying whatever raw geometry we did extract, so
// the tradie has something to start from and the UI can flag it as
// `needs_review`. Never silently emits a fake quantity.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { round2 } from "../normalise";

export function runGenericCalculator(ext: ExtractedExtraction): ScopeResult {
  const dims = ext.dimensions;
  const len = dims.length_m ?? 0;
  const wid = dims.width_m ?? 0;
  const area =
    dims.area_m2 !== null && dims.area_m2 !== undefined
      ? dims.area_m2
      : round2(len * wid);
  const volume = dims.volume_m3 ?? 0;
  const perimeter = dims.perimeter_m ?? 0;
  const wastePct = ext.waste_percent ?? 10;

  // Pick the most-likely "primary unit" from what we extracted.
  let quantity = 0;
  let unit = "ea";
  let formula = "";
  let confidence = 0.4;
  if (volume > 0) {
    quantity = round2(volume * (1 + wastePct / 100));
    unit = "m³";
    formula = `volume=${volume}m³ × (1+${wastePct}/100) = ${quantity}`;
    confidence = 0.6;
  } else if (area > 0) {
    quantity = round2(area * (1 + wastePct / 100));
    unit = "m²";
    formula = `area=${area}m² × (1+${wastePct}/100) = ${quantity}`;
    confidence = 0.6;
  } else if (perimeter > 0 || len > 0) {
    const lm = perimeter || len;
    quantity = round2(lm * (1 + wastePct / 100));
    unit = "m";
    formula = `length=${lm}m × (1+${wastePct}/100) = ${quantity}`;
    confidence = 0.6;
  } else {
    quantity = 0;
    unit = "ea";
    formula = "no dimensions extracted";
  }

  const assumptions: string[] = [];
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }

  const lines: TakeoffLine[] = [
    {
      id: "generic-quantity",
      name: ext.material_spec ?? "Material (generic)",
      category: "Generic",
      quantity,
      unit,
      // Generic ALWAYS surfaces as needs_review — we don't know what
      // the material is, only what dimension we extracted, and the
      // tradie must confirm the unit + price match the intent.
      status: quantity > 0 ? "needs_review" : "blocked",
      basis: {
        formula,
        inputs: {
          length_m: len,
          width_m: wid,
          area_m2: area,
          perimeter_m: perimeter,
          volume_m3: volume,
          waste_percent: wastePct,
        },
        assumed: assumptions,
      },
      confidence,
      assumption_flags: assumptions,
      validation_flags:
        quantity > 0
          ? ["generic_scope_unconfirmed"]
          : ["no_dimensions_extracted"],
      explanation:
        quantity > 0
          ? "Generic stock/coverage estimate — confirm material and price before sending."
          : "No usable dimensions found — please clarify what to quote.",
      priceMatchKey: undefined,
    },
  ];

  return {
    scope: "generic",
    status: quantity > 0 ? "needs_review" : "blocked",
    summary: {
      primary_metric: unit === "m³" ? "volume" : unit === "m²" ? "area" : "length",
      primary_value: quantity,
      unit,
      inputs: {
        length_m: len,
        width_m: wid,
        area_m2: area,
        perimeter_m: perimeter,
        volume_m3: volume,
        waste_percent: wastePct,
      },
    },
    lines,
    warnings:
      quantity > 0
        ? ["Generic fallback used — confirm scope and material before sending."]
        : ["Could not extract any usable dimensions."],
    assumptions,
    clarifications: [],
    explanation: "",
  };
}
