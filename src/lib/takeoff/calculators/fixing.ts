// ─────────────────────────────────────────────────────────────────────────
// Fixing calculator — skirting, architrave, scotia, cover-strip lineal-
// metre work.
//
// Pure LM-based. The caller passes a perimeter (for skirting) or a
// total length (for architraves; we count 2 × door height + door width
// per door if openings are present).
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
} from "../schemas";
import { worstStatus } from "../schemas";
import { round2, stockLengthsForLM } from "../normalise";

const DEFAULT_STOCK_M = 4.8;

export function runFixingCalculator(ext: ExtractedExtraction): ScopeResult {
  const length_m =
    ext.dimensions.perimeter_m !== null && ext.dimensions.perimeter_m !== undefined
      ? ext.dimensions.perimeter_m
      : (ext.dimensions.length_m ?? 0);
  const stockM = ext.stock_length_m ?? DEFAULT_STOCK_M;
  const wastePct = ext.waste_percent ?? 10;

  const assumptions: string[] = [];
  if (ext.waste_percent === null || ext.waste_percent === undefined) {
    assumptions.push("Used default 10% waste.");
  }
  if (ext.stock_length_m === null || ext.stock_length_m === undefined) {
    assumptions.push(`Used default stock length ${DEFAULT_STOCK_M}m.`);
  }

  const isArchitrave = /architrave/i.test(ext.material_spec ?? "");
  const isScotia = /scotia/i.test(ext.material_spec ?? "");

  // For architraves: 2 × door height + door width per door (one set
  // both sides counts as 1 set; both-sides is a separate option not
  // covered here — caller can include in length_m directly).
  let totalLm = length_m;
  if (isArchitrave && ext.openings.length > 0) {
    const lmFromDoors = ext.openings
      .filter((o) => o.kind === "door")
      .reduce((s, o) => {
        const h = o.height_m ?? 2.04;
        const w = o.width_m ?? 0.82;
        return s + (h * 2 + w) * (o.count ?? 1);
      }, 0);
    if (lmFromDoors > 0) totalLm = round2(lmFromDoors);
  }

  const stockCount = stockLengthsForLM(totalLm, stockM, wastePct);
  const label = isArchitrave
    ? "Architraves"
    : isScotia
      ? "Scotia"
      : "Skirting";

  const lines: TakeoffLine[] = [
    {
      id: `fixing-${label.toLowerCase()}`,
      name: ext.material_spec ?? label,
      category: "Finishing",
      quantity: stockCount,
      unit: "lengths",
      status: assumptions.length > 0 ? "assumed" : "ok",
      basis: {
        formula: `ceil(totalLM=${totalLm}m × (1+${wastePct}/100) / stock=${stockM}m) = ${stockCount}`,
        inputs: {
          total_lm: totalLm,
          stock_length_m: stockM,
          waste_percent: wastePct,
        },
        assumed: assumptions,
      },
      confidence: assumptions.length > 0 ? 0.75 : 0.9,
      assumption_flags: assumptions,
      validation_flags: [],
      explanation: `${stockCount} × ${stockM}m lengths cover ${totalLm}m run.`,
      priceMatchKey: label.toLowerCase(),
    },
  ];

  const status = worstStatus([
    ...(assumptions.length > 0 ? (["assumed"] as const) : []),
    ...lines.map((l) => l.status),
  ]);

  return {
    scope: "fixing",
    status,
    summary: {
      primary_metric: "linear metres",
      primary_value: totalLm,
      unit: "m",
      inputs: {
        total_lm: totalLm,
        stock_length_m: stockM,
        waste_percent: wastePct,
        kind: label,
      },
    },
    lines,
    warnings: [],
    assumptions,
    clarifications: [],
    explanation: "",
  };
}
