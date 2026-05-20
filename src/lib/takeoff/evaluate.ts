// ─────────────────────────────────────────────────────────────────────────
// Evaluator — post-calculation plausibility pass.
//
// Runs AFTER the deterministic calculator and the validator. It reviews
// the extraction + the calculator output and flags results that are
// suspicious even though they passed basic validation.
//
// HARD RULES (mirror the product safety contract):
//   - Pure function. No I/O, no LLM, no randomness.
//   - NEVER recalculates or mutates a quantity. It only reads and judges.
//   - Conservative by design: most anomalies are "caution" (a one-tick
//     confirm at the send gate), and only physically-broken output is
//     "fail" (a hard block). This keeps false alarms low while mates
//     are testing.
//
// The heuristics are deliberately tied to data the calculators already
// expose (summary.inputs, line quantity/unit/category) so they degrade
// gracefully: if a signal isn't present the check is skipped rather than
// guessing.
// ─────────────────────────────────────────────────────────────────────────

import type {
  EvaluatorReason,
  EvaluatorVerdict,
  ExtractedExtraction,
  ScopeResult,
  ScopeType,
} from "./schemas";
import { worstEvaluatorStatus } from "./schemas";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Evaluate a single calculated scope. Blocked scopes (no lines) return a
 * vacuous "pass" — their blocked-ness is already carried by the line
 * status and hard-gated at send. The evaluator's job is the EXTRA layer
 * over numbers that did get produced.
 */
export function evaluateScope(
  result: ScopeResult,
  ext: ExtractedExtraction,
): EvaluatorVerdict {
  const reasons: EvaluatorReason[] = [];
  const scope = result.scope;
  const push = (
    code: string,
    message: string,
    severity: "caution" | "fail",
  ) => reasons.push({ code, message, severity, scope });

  // ── Universal: every emitted quantity must be a sane finite number.
  for (const l of result.lines) {
    if (!Number.isFinite(l.quantity) || l.quantity < 0) {
      push(
        "nonfinite_quantity",
        `"${l.name}" produced an invalid quantity (${l.quantity}).`,
        "fail",
      );
    } else if (l.quantity === 0) {
      push(
        "zero_quantity",
        `"${l.name}" came out as zero — check the inputs.`,
        "caution",
      );
    }
  }

  // ── Universal: a single line wildly larger than the primary metric is
  //    almost always unit confusion (mm fed into a metres field, etc.).
  const primary = num(result.summary.primary_value) ?? 0;
  if (primary > 0) {
    for (const l of result.lines) {
      if (Number.isFinite(l.quantity) && l.quantity > primary * 5000) {
        push(
          "quantity_blowup",
          `"${l.name}" (${l.quantity} ${l.unit}) is implausibly large for a ${result.summary.primary_metric} of ${primary}${result.summary.unit}.`,
          "caution",
        );
      }
    }
  }

  // ── Per-scope plausibility.
  switch (scope) {
    case "cladding": {
      const haystack = `${ext.material_spec ?? ""} ${ext.project_type ?? ""} ${ext.notes.join(" ")}`;
      const mentionsOpenings =
        /window|door|joiner|opening|ranchslider|slider/i.test(haystack);
      if (mentionsOpenings && ext.openings.length === 0) {
        push(
          "cladding_openings_ignored",
          "Windows/doors are mentioned but no openings were deducted — net cladding area may be overstated.",
          "caution",
        );
      }
      reasons.push(...fixingsBelowBoards(result, scope));
      break;
    }
    case "framing": {
      const len = num(result.summary.inputs.length_m);
      const spacing =
        num(result.summary.inputs.stud_spacing_mm) ??
        num(ext.spacing_mm) ??
        600;
      const studLine = result.lines.find(
        (l) => /stud/i.test(l.id) || /stud/i.test(l.name),
      );
      if (
        len &&
        len > 0 &&
        spacing > 0 &&
        studLine &&
        Number.isFinite(studLine.quantity)
      ) {
        const expected = Math.ceil((len * 1000) / spacing) + 1;
        if (
          expected > 0 &&
          (studLine.quantity < expected * 0.5 ||
            studLine.quantity > expected * 2)
        ) {
          push(
            "stud_count_inconsistent",
            `Stud count (${studLine.quantity}) looks off for a ${len}m wall at ${spacing}mm centres (expected roughly ${expected}).`,
            "caution",
          );
        }
      }
      break;
    }
    case "roofing": {
      const plan = num(result.summary.inputs.plan_area_m2);
      const actual = num(result.summary.inputs.actual_area_m2);
      const pitch = num(result.summary.inputs.pitch_deg);
      // A pitched roof's actual area must exceed its plan area. If they're
      // (near) equal while a real pitch is set, the pitch factor was lost.
      if (plan && actual && pitch && pitch > 5 && actual <= plan * 1.001) {
        push(
          "roof_area_not_pitched",
          `Roof area (${actual}m²) looks like the flat plan area — a ${pitch}° pitch should make the actual area larger.`,
          "caution",
        );
      }
      reasons.push(...fixingsBelowBoards(result, scope));
      break;
    }
    case "deck": {
      const len = num(result.summary.inputs.length_m);
      const wid = num(result.summary.inputs.width_m);
      if (len && wid && len > 0 && wid > 0) {
        const footprint = len * wid;
        const stock = num(result.summary.inputs.stock_length_m);
        const board = result.lines.find(
          (l) =>
            /deck|board/i.test(l.name) &&
            /(^|\b)(m|lm|lineal|length)/i.test(l.unit),
        );
        if (board && Number.isFinite(board.quantity)) {
          const lm =
            /length/i.test(board.unit) && stock
              ? board.quantity * stock
              : board.quantity;
          // ~140mm boards ≈ 7.9 lm per m² incl. waste. Flag only past ~2×.
          if (lm > footprint * 16) {
            push(
              "decking_lm_high",
              `Decking length (~${Math.round(lm)}m) looks high for a ${footprint.toFixed(1)}m² deck footprint.`,
              "caution",
            );
          }
        }
      }
      break;
    }
    default: {
      // Other scopes rely on the universal checks plus the shared
      // fixings-vs-boards sanity where both line kinds are present.
      reasons.push(...fixingsBelowBoards(result, scope));
      break;
    }
  }

  return verdictFromReasons(reasons);
}

/**
 * Shared check: a board/sheet/paling count should never exceed the count
 * of the individual fasteners that hold it down. We only compare when the
 * fasteners are counted individually ("each") so we don't false-positive
 * on nails sold by the box/kg.
 */
function fixingsBelowBoards(
  result: ScopeResult,
  scope: ScopeType,
): EvaluatorReason[] {
  const board = result.lines.find(
    (l) =>
      /(sheet|board|paling|length|panel)/i.test(`${l.name} ${l.unit}`) &&
      !/screw|nail|fixing|fastener/i.test(l.name),
  );
  const fixings = result.lines.find(
    (l) =>
      /screw|nail|fixing|fastener/i.test(`${l.name} ${l.category}`) &&
      /each|ea|pcs?/i.test(l.unit),
  );
  if (
    board &&
    fixings &&
    Number.isFinite(board.quantity) &&
    Number.isFinite(fixings.quantity) &&
    board.quantity > 0 &&
    fixings.quantity < board.quantity
  ) {
    return [
      {
        code: "fixings_low_for_boards",
        message: `Fixings (${fixings.quantity}) look too low for ${board.quantity} ${board.unit} — expected at least one per board/sheet.`,
        severity: "caution",
        scope,
      },
    ];
  }
  return [];
}

function verdictFromReasons(reasons: EvaluatorReason[]): EvaluatorVerdict {
  const hasFail = reasons.some((r) => r.severity === "fail");
  const hasCaution = reasons.some((r) => r.severity === "caution");
  const status: EvaluatorVerdict["status"] = hasFail
    ? "fail"
    : hasCaution
      ? "caution"
      : "pass";
  let confidence = 1;
  for (const r of reasons) confidence -= r.severity === "fail" ? 0.5 : 0.15;
  if (hasFail) confidence = Math.min(confidence, 0.25);
  confidence = Math.max(0.05, Math.min(1, confidence));
  return {
    status,
    reasons,
    confidence: Math.round(confidence * 100) / 100,
    requires_manual_confirmation: status !== "pass",
  };
}

/** Aggregate per-scope verdicts into one overall verdict (worst wins). */
export function evaluateTakeoff(verdicts: EvaluatorVerdict[]): EvaluatorVerdict {
  const reasons = verdicts.flatMap((v) => v.reasons);
  const status = worstEvaluatorStatus(verdicts.map((v) => v.status));
  const confidence = verdicts.length
    ? Math.min(...verdicts.map((v) => v.confidence))
    : 1;
  return {
    status,
    reasons,
    confidence: Math.round(confidence * 100) / 100,
    requires_manual_confirmation: status !== "pass",
  };
}
