// ─────────────────────────────────────────────────────────────────────────
// Lining calculator — interior wall / ceiling lining sheets.
//
// Pure geometry: net area (after openings) × number of sides ÷ sheet
// coverage. Same formula the legacy wall calculator uses, isolated
// here so the lining scope can run standalone (e.g. "line the
// existing wall with 13mm Aqualine").
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { round2, safeCeil, sheetsForArea } from "../normalise";

const DEFAULT_SHEET_W = 1.2;
const DEFAULT_SHEET_H = 2.4;

export function runLiningCalculator(ext: ExtractedExtraction): ScopeResult {
  const length_m = ext.dimensions.length_m ?? 0;
  const height_m = ext.dimensions.height_m ?? 0;
  const explicit_area = ext.dimensions.area_m2 ?? null;
  const wastePct = ext.waste_percent ?? 10;

  const grossArea =
    explicit_area !== null && explicit_area > 0
      ? explicit_area
      : round2(length_m * height_m);

  const openingArea = ext.openings.reduce(
    (s, o) =>
      s +
      (o.width_m ?? 0) * (o.height_m ?? 0) * (o.count ?? 1),
    0,
  );
  const netArea = Math.max(grossArea - openingArea, 0);

  const sides: 1 | 2 = ext.notes.some((n) => /both\s+sides?|two\s+sides?/i.test(n))
    ? 2
    : 1;
  const sheetW = DEFAULT_SHEET_W;
  const sheetH = DEFAULT_SHEET_H;
  const sheetArea = sheetW * sheetH;
  const sheets = sheetsForArea(netArea * sides, sheetW, sheetH, wastePct);

  const assumptions: string[] = [];
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }
  if (!ext.notes.some((n) => /both\s+sides?|two\s+sides?|one\s+side/i.test(n))) {
    assumptions.push("Assumed lining one side only.");
  }
  // Sheet size drives the sheet count and isn't read from the spec yet.
  assumptions.push(
    "Assumed 1.2×2.4m lining sheets — change if using 1.2×3.0m or a different size.",
  );

  const lines: TakeoffLine[] = [];
  const wasteMult = 1 + wastePct / 100;
  lines.push({
    id: "lining-sheets",
    name: ext.material_spec ?? "Plasterboard sheets",
    category: "Lining",
    quantity: sheets,
    unit: "sheets",
    status: assumptions.length > 0 ? "assumed" : "ok",
    basis: {
      formula: `ceil(netArea=${netArea}m² × sides=${sides} × (1+${wastePct}/100) / (${sheetW}×${sheetH})) = ${sheets}`,
      inputs: {
        net_area_m2: netArea,
        sides,
        sheet_area_m2: sheetArea,
        waste_percent: wastePct,
      },
      assumed: assumptions,
    },
    confidence: assumptions.length > 0 ? 0.7 : 0.9,
    assumption_flags: assumptions,
    validation_flags: [],
    explanation: `${sheets} sheets cover ${round2(netArea * sides)}m² (with ${wastePct}% waste).`,
    priceMatchKey: "plasterboard-sheets",
  });

  // Screws — ~40 per sheet on stud framing, +10% waste.
  const screws = safeCeil(sheets * 40 * wasteMult);
  lines.push({
    id: "lining-screws",
    name: "Plasterboard screws",
    category: "Fixings",
    quantity: screws,
    unit: "each",
    status: "ok",
    basis: {
      formula: `ceil(sheets=${sheets} × 40 × (1+${wastePct}/100)) = ${screws}`,
      inputs: { sheets, per_sheet: 40, waste_percent: wastePct },
      assumed: [],
    },
    confidence: 0.85,
    assumption_flags: [],
    validation_flags: [],
    explanation: "",
    priceMatchKey: "gib-screws",
  });

  // Adhesive — 1 tube per 4 sheets.
  const adhesive = safeCeil(sheets / 4);
  lines.push({
    id: "lining-adhesive",
    name: "Plasterboard adhesive",
    category: "Fixings",
    quantity: adhesive,
    unit: "tubes",
    status: "ok",
    basis: {
      formula: `ceil(sheets=${sheets} / 4) = ${adhesive}`,
      inputs: { sheets },
      assumed: [],
    },
    confidence: 0.85,
    assumption_flags: [],
    validation_flags: [],
    explanation: "",
    priceMatchKey: "gib-adhesive",
  });

  const status = worstStatus([
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "lining",
    status,
    summary: {
      primary_metric: "net lining area",
      primary_value: round2(netArea * sides),
      unit: "m²",
      inputs: {
        gross_area_m2: grossArea,
        opening_area_m2: openingArea,
        sides,
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
