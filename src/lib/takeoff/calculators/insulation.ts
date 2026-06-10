// ─────────────────────────────────────────────────────────────────────────
// Insulation calculator — EXTERIOR WALLS ONLY (P0 hard rule).
//
// Area-based. Defaults to NZ pink-batt pack coverage (8.8 m² per pack,
// the residential R2.2 wall pack). Caller can pass a different
// coverage via ext.notes (e.g. "R3.6 ceiling batts 6 m² packs").
//
// Exterior evidence is REQUIRED before any quantity is produced:
//   - ext.exterior_wall_run_m  → area sized from exterior run × height
//     (the run is the evidence — prose dims are ignored for sizing), or
//   - ext.wall_kind === "exterior" → the stated dims ARE the exterior
//     walls per the tradie's own words, sized as before.
// Anything else (interior / mixed / unknown) returns a BLOCKED result
// with zero lines. validate.ts blocks these upstream; this is
// belt-and-braces for callers that bypass validation. Insulation on
// interior-only walls must be impossible, not just flagged.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { round2, safeCeil } from "../normalise";

const DEFAULT_PACK_COVERAGE_M2 = 8.8;

function blockedInsulationResult(reason: string): ScopeResult {
  return {
    scope: "insulation",
    status: "blocked",
    summary: {
      primary_metric: "n/a",
      primary_value: 0,
      unit: "",
      inputs: {},
    },
    lines: [],
    warnings: [reason],
    assumptions: [],
    clarifications: [],
    explanation: `Insulation blocked — ${reason}`,
  };
}

export function runInsulationCalculator(ext: ExtractedExtraction): ScopeResult {
  // ── Exterior-evidence gate (fail closed) ────────────────────────────
  const extRun = ext.exterior_wall_run_m ?? null;
  const haveExtRun =
    extRun !== null && Number.isFinite(extRun) && extRun > 0;
  if (!haveExtRun && ext.wall_kind !== "exterior") {
    return blockedInsulationResult(
      ext.wall_kind === "interior"
        ? "interior walls — insulation is quoted for exterior walls only"
        : "no exterior-wall evidence — insulation is quoted for exterior walls only",
    );
  }

  const explicitArea = ext.dimensions.area_m2 ?? null;
  const length_m = ext.dimensions.length_m ?? 0;
  const height_m = ext.dimensions.height_m ?? 0;
  const wastePct = ext.waste_percent ?? 5; // batts have less off-cut waste than sheets

  // When the exterior run is known it IS the sizing basis (exterior-only
  // by construction). Otherwise the stated dims are exterior walls per
  // the tradie's statement (wall_kind === "exterior").
  const basisNote = haveExtRun
    ? `exterior wall run ${extRun}m × height ${height_m}m`
    : "stated exterior-wall dimensions";
  const grossArea = haveExtRun
    ? round2((extRun as number) * height_m)
    : explicitArea !== null && explicitArea > 0
      ? explicitArea
      : round2(length_m * height_m);

  if (!(grossArea > 0)) {
    return blockedInsulationResult(
      haveExtRun
        ? "insulation needs the wall height (to size exterior run × height)"
        : "insulation needs either area_m2 OR length_m + height_m",
    );
  }

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
          exterior_basis: basisNote,
          exterior_wall_run_m: haveExtRun ? (extRun as number) : null,
        },
        assumed: assumptions,
      },
      confidence: assumptions.length > 0 ? 0.7 : 0.9,
      assumption_flags: assumptions,
      validation_flags: [],
      explanation: `${packs} packs cover ${netArea}m² of exterior wall (with ${wastePct}% waste). Exterior walls only.`,
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
        exterior_basis: basisNote,
      },
    },
    lines,
    warnings: [],
    assumptions,
    clarifications: [],
    explanation: "",
  };
}
