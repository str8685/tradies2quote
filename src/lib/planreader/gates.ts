// ─────────────────────────────────────────────────────────────────────────
// Plan-reader — the six independent confidence gates.
//
// DESIGN INVARIANT (do not "improve" by averaging): these gates are NOT
// blended into a single score. Each is evaluated independently and ANY
// failing gate can set review_required / block extraction on its own. A high
// score on one signal must never mask a failure on another.
//
// Gate enforcement order in the pipeline:
//   classification        — Phase 1 (live below). Unknown/low-confidence
//                           sheet never reaches an extractor.
//   scale                 — Phase 2. scale_confidence==0 ⇒ pixel measurement
//                           is forbidden (no auto-measure without calibration).
//   ocr                   — Phase 2. Low OCR confidence ⇒ dims need review.
//   geometry_completeness — Phase 3. Missing closed areas / wall runs ⇒ block.
//   required_dims_present — Phase 4. No calculator runs without its inputs.
//   text_vs_geometry      — Phase 3/4. Labelled vs measured dim must agree
//                           within tolerance; on mismatch surface BOTH.
//
// The thresholds below are the SINGLE SOURCE OF TRUTH for every phase.
// ─────────────────────────────────────────────────────────────────────────

import type { SheetClassification } from "./schema";
import { isSupportedSheetType } from "./schema";

export const GATE_THRESHOLDS = {
  /** Min classifier confidence to let a sheet proceed to extraction. */
  classification: 0.65,
  /** Min scale confidence; below this, pixel measurement is forbidden. */
  scale: 0.5,
  /** Min aggregate OCR confidence before dimensions are trusted. */
  ocr: 0.6,
  /** Max relative disagreement between a labelled and a measured dimension. */
  text_vs_geometry_tolerance: 0.05,
} as const;

export type GateId =
  | "classification"
  | "scale"
  | "ocr"
  | "geometry_completeness"
  | "required_dims_present"
  | "text_vs_geometry";

/**
 * One gate's verdict. `pass=false` means the sheet must be flagged
 * review_required (and, for hard gates, must NOT proceed to a calculator).
 * `hard=true` means failure blocks extraction entirely, not just flags it.
 */
export type GateResult = {
  gate: GateId;
  pass: boolean;
  hard: boolean;
  reason?: string;
};

// ── Gate 1: classification (Phase 1, live) ────────────────────────────────

/**
 * Decide whether a classified sheet may proceed.
 *
 *   - sheet_type "unknown"            → FAIL (hard): never extract a guess.
 *   - confidence < threshold          → FAIL (hard): too uncertain.
 *   - recognized but unsupported type → PASS, but with an advisory reason
 *     (elevation/section/schedule have no extractor; the extract step skips
 *     them — this is "explicit out-of-scope", not "uncertain").
 *   - supported + confident           → PASS.
 */
export function classificationGate(c: SheetClassification): GateResult {
  if (c.sheet_type === "unknown") {
    return {
      gate: "classification",
      pass: false,
      hard: true,
      reason: "sheet type could not be identified",
    };
  }
  if (c.confidence < GATE_THRESHOLDS.classification) {
    return {
      gate: "classification",
      pass: false,
      hard: true,
      reason: `classification confidence ${c.confidence.toFixed(
        2,
      )} below ${GATE_THRESHOLDS.classification} threshold`,
    };
  }
  if (!isSupportedSheetType(c.sheet_type)) {
    return {
      gate: "classification",
      pass: true,
      hard: false,
      reason: `recognized as "${c.sheet_type}" — no takeoff extractor for this sheet type`,
    };
  }
  return { gate: "classification", pass: true, hard: false };
}
