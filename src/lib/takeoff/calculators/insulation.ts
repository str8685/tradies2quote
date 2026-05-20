// ─────────────────────────────────────────────────────────────────────────
// Insulation calculator.
//
// Area-based. Defaults to NZ pink-batt pack coverage (8.8 m² per pack,
// the residential R2.2 wall pack). Caller can pass a different
// coverage via ext.notes (e.g. "R3.6 ceiling batts 6 m² packs").
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { round2, safeCeil } from "../normalise";

const DEFAULT_PACK_COVERAGE_M2 = 8.8;

export function runInsulationCalculator(ext: ExtractedExtraction): ScopeResult {
  const explicitArea = ext.dimensions.area_m2 ?? null;
  const length_m = ext.dimensions.length_m ?? 0;
  const height_m = ext.dimensions.height_m ?? 0;
  const wastePct = ext.waste_percent ?? 5; // batts have less off-cut waste than sheets

  const grossArea =
    explicitArea !== null && explicitArea > 0
      ? explicitArea
      : round2(length_m * height_m);

  const openingArea = ext.openings.reduce(
    (s, o) =>
      s + (o.width_m ?? 0) * (o.height_m ?? 0) * (o.count ?? 1),
    0,
  );
  const netArea = Math.max(grossArea - openingArea, 0);

  // Detect pack-coverage hint in material spec or notes.
  let packCoverage = DEFAULT_PACK_COVERAGE_M2;
  const all = `${ext.material_spec ?? ""} ${ext.notes.join(" ")}`;
  const coverageMatch = all.match(/(\d+(?:\.\d+)?)\s*m²?\s*(?:per\s+)?pack/i);
  if (coverageMatch) {
    const n = Number(coverageMatch[1]);
    if (Number.isFinite(n) && n > 0 && n < 30) packCoverage = n;
  }

  const assumptions: string[] = [];
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 5% waste (cuts only).");
  }
  if (!coverageMatch) {
    assumptions.push(
      `Used default pack coverage ${DEFAULT_PACK_COVERAGE_M2} m² (R2.2 wall batts).`,
    );
  }

  const packs = safeCeil(
    (netArea * (1 + wastePct / 100)) / packCoverage,
  );

  const lines: TakeoffLine[] = [
    {
      id: "insulation-batts",
      name: ext.material_spec ?? "Pink Batts insulation",
      category: "Insulation",
      quantity: packs,
      unit: "packs",
      status: assumptions.length > 0 ? "assumed" : "ok",
      basis: {
        formula: `ceil(netArea=${netArea}m² × (1+${wastePct}/100) / packCoverage=${packCoverage}m²) = ${packs}`,
        inputs: {
          net_area_m2: netArea,
          pack_coverage_m2: packCoverage,
          waste_percent: wastePct,
        },
        assumed: assumptions,
      },
      confidence: assumptions.length > 0 ? 0.7 : 0.9,
      assumption_flags: assumptions,
      validation_flags: [],
      explanation: `${packs} packs cover ${netArea}m² (with ${wastePct}% waste).`,
      priceMatchKey: "pink-batts",
    },
  ];

  const status = worstStatus([
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "insulation",
    status,
    summary: {
      primary_metric: "net area",
      primary_value: netArea,
      unit: "m²",
      inputs: {
        gross_area_m2: grossArea,
        opening_area_m2: openingArea,
        pack_coverage_m2: packCoverage,
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
