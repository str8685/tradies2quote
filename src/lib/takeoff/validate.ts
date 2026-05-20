// ─────────────────────────────────────────────────────────────────────────
// Validation / guardrail layer.
//
// Runs AFTER extraction and BEFORE calculation. If validation says
// "blocked" the orchestrator does not call any calculator — it returns a
// clarification result so the tradie can fix the input.
//
// Three categories of check:
//   1. Hard constraints — physically impossible inputs (negative
//      lengths, zero areas, NaN). These hard-block.
//   2. Plausibility — dimensions outside the sane envelope, unit
//      confusion (length 4800 in a metres-named field), spacing
//      values not in {300, 400, 450, 600}. These soft-flag.
//   3. Cross-field — area/perimeter mismatch, openings larger than the
//      wall they sit in. These soft-flag.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ScopeType,
  TakeoffStatus,
} from "./schemas";

export type ValidationResult = {
  status: TakeoffStatus;
  reasons: string[];
  /** Soft flags that don't block calculation but should colour the UI. */
  flags: string[];
};

const MIN_PLAN_M = 1;
const MAX_PLAN_M = 100;
const MIN_HEIGHT_M = 0.5;
const MAX_HEIGHT_M = 20;

/**
 * Validate a single scope's extraction. Returns `blocked` only when
 * the calculator literally cannot run.
 */
export function validateExtractionForScope(
  ext: ExtractedExtraction,
  scope: ScopeType,
): ValidationResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const { dimensions } = ext;

  const requireDim = (
    label: string,
    v: number | null | undefined,
    min: number,
    max: number,
  ): "missing" | "out-of-range" | "ok" => {
    if (v === null || v === undefined) {
      reasons.push(`${label} is missing`);
      return "missing";
    }
    if (!Number.isFinite(v) || v <= 0) {
      reasons.push(`${label}=${v} is not a positive number`);
      return "out-of-range";
    }
    if (v < min || v > max) {
      flags.push(`${label}=${v}m is outside the typical ${min}–${max}m range`);
      return "out-of-range";
    }
    return "ok";
  };

  switch (scope) {
    case "deck": {
      const l = requireDim("length_m", dimensions.length_m, MIN_PLAN_M, MAX_PLAN_M);
      const w = requireDim("width_m", dimensions.width_m, MIN_PLAN_M, MAX_PLAN_M);
      // Hard-block on missing OR physically impossible (negative/zero/NaN).
      // Out-of-range values are pushed to `reasons` by requireDim, so a
      // non-empty reasons array means at least one critical input is
      // unusable and we can't run the calculator.
      if (l === "missing" || w === "missing" || reasons.length > 0) {
        return { status: "blocked", reasons, flags };
      }
      // Length:width ratio sanity — a 20:1 deck is almost certainly
      // a fence or boardwalk, flag it.
      const ratio =
        (dimensions.length_m ?? 0) / Math.max(0.0001, dimensions.width_m ?? 0);
      if (ratio > 20) {
        flags.push(
          `length:width ratio ${ratio.toFixed(1)}:1 is unusual for a deck`,
        );
      }
      break;
    }
    case "cladding": {
      requireDim("length_m", dimensions.length_m, MIN_PLAN_M, MAX_PLAN_M);
      requireDim("height_m", dimensions.height_m, MIN_HEIGHT_M, MAX_HEIGHT_M);
      if (!Number.isFinite(dimensions.length_m ?? NaN) || reasons.length > 0) {
        return { status: "blocked", reasons, flags };
      }
      // Sum of openings shouldn't exceed wall area.
      const wallArea =
        (dimensions.length_m ?? 0) * (dimensions.height_m ?? 0);
      const openArea = ext.openings.reduce((s, o) => {
        const w = o.width_m ?? 0;
        const h = o.height_m ?? 0;
        const c = o.count ?? 1;
        return s + w * h * c;
      }, 0);
      if (openArea > 0 && openArea >= wallArea) {
        flags.push(
          `openings total ${openArea.toFixed(2)}m² ≥ wall area ${wallArea.toFixed(2)}m²`,
        );
      }
      break;
    }
    case "framing": {
      const l = requireDim("length_m", dimensions.length_m, MIN_PLAN_M, MAX_PLAN_M);
      const h = requireDim("height_m", dimensions.height_m, MIN_HEIGHT_M, MAX_HEIGHT_M);
      if (l === "missing" || h === "missing" || reasons.length > 0) {
        return { status: "blocked", reasons, flags };
      }
      if (
        ext.spacing_mm !== null &&
        ext.spacing_mm !== undefined &&
        ![300, 400, 450, 600].includes(ext.spacing_mm)
      ) {
        flags.push(
          `stud spacing ${ext.spacing_mm}mm is non-standard (NZ uses 400 or 600)`,
        );
      }
      break;
    }
    case "roofing": {
      const haveArea =
        Number.isFinite(dimensions.area_m2 ?? NaN) &&
        (dimensions.area_m2 ?? 0) > 0;
      const haveLW =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        Number.isFinite(dimensions.width_m ?? NaN);
      if (!haveArea && !haveLW) {
        reasons.push("roof needs either area_m2 OR length_m + width_m (plan)");
        return { status: "blocked", reasons, flags };
      }
      if (dimensions.pitch_deg === null || dimensions.pitch_deg === undefined) {
        flags.push("pitch_deg missing — assuming 15° (low-pitch)");
      }
      break;
    }
    case "lining": {
      const haveArea =
        Number.isFinite(dimensions.area_m2 ?? NaN) &&
        (dimensions.area_m2 ?? 0) > 0;
      const haveLH =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        Number.isFinite(dimensions.height_m ?? NaN);
      if (!haveArea && !haveLH) {
        reasons.push("lining needs either area_m2 OR length_m + height_m");
        return { status: "blocked", reasons, flags };
      }
      break;
    }
    case "insulation": {
      const haveArea =
        Number.isFinite(dimensions.area_m2 ?? NaN) &&
        (dimensions.area_m2 ?? 0) > 0;
      const haveLH =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        Number.isFinite(dimensions.height_m ?? NaN);
      if (!haveArea && !haveLH) {
        reasons.push("insulation needs either area_m2 OR length_m + height_m");
        return { status: "blocked", reasons, flags };
      }
      break;
    }
    case "fencing": {
      const havePerimeter =
        Number.isFinite(dimensions.perimeter_m ?? NaN) &&
        (dimensions.perimeter_m ?? 0) > 0;
      const haveLength =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        (dimensions.length_m ?? 0) > 0;
      if (!havePerimeter && !haveLength) {
        reasons.push("fence needs perimeter_m or length_m");
        return { status: "blocked", reasons, flags };
      }
      requireDim("height_m", dimensions.height_m, 0.6, 3);
      break;
    }
    case "concrete": {
      const haveLW =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        Number.isFinite(dimensions.width_m ?? NaN);
      const haveVol =
        Number.isFinite(dimensions.volume_m3 ?? NaN) &&
        (dimensions.volume_m3 ?? 0) > 0;
      if (!haveLW && !haveVol) {
        reasons.push("concrete needs length_m + width_m OR volume_m3");
        return { status: "blocked", reasons, flags };
      }
      break;
    }
    case "fixing": {
      // Skirtings / architraves are LM-based; we need either a
      // perimeter or a count.
      const haveLength =
        Number.isFinite(dimensions.length_m ?? NaN) &&
        (dimensions.length_m ?? 0) > 0;
      const havePerimeter =
        Number.isFinite(dimensions.perimeter_m ?? NaN) &&
        (dimensions.perimeter_m ?? 0) > 0;
      if (!haveLength && !havePerimeter) {
        reasons.push("fixing scope needs length_m or perimeter_m");
        return { status: "blocked", reasons, flags };
      }
      break;
    }
    case "generic": {
      // Generic only blocks on a completely empty extraction.
      const haveAny =
        Number.isFinite(dimensions.length_m ?? NaN) ||
        Number.isFinite(dimensions.width_m ?? NaN) ||
        Number.isFinite(dimensions.area_m2 ?? NaN) ||
        Number.isFinite(dimensions.perimeter_m ?? NaN) ||
        Number.isFinite(dimensions.volume_m3 ?? NaN);
      if (!haveAny) {
        reasons.push("no dimensions extracted");
        return { status: "blocked", reasons, flags };
      }
      break;
    }
  }

  // Cumulative status: if reasons is non-empty we'd have returned blocked
  // above. Flags are soft → status = needs_review when present,
  // otherwise ok.
  return {
    status: flags.length > 0 ? "needs_review" : "ok",
    reasons,
    flags,
  };
}
