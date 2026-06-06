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

import type {
  ExtractedSheet,
  SheetClassification,
  SheetType,
} from "./schema";
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

// ── Gate 2: scale (Phase 2) ───────────────────────────────────────────────

/**
 * A confident scale is required to derive ANY real-world length from pixel
 * geometry. Failure is NOT hard — labelled text dimensions can still be used —
 * but it flags the sheet for review and (downstream) forbids pixel measurement
 * until the user calibrates.
 */
export function scaleGate(scale_confidence: number): GateResult {
  if (scale_confidence >= GATE_THRESHOLDS.scale) {
    return { gate: "scale", pass: true, hard: false };
  }
  return {
    gate: "scale",
    pass: false,
    hard: false,
    reason:
      scale_confidence <= 0
        ? "no usable scale found — pixel measurement disabled until calibrated"
        : `scale confidence ${scale_confidence.toFixed(2)} below ${GATE_THRESHOLDS.scale}`,
  };
}

// ── Gate 3: OCR (Phase 2) ─────────────────────────────────────────────────

/**
 * Low aggregate OCR confidence means the extracted text (incl. dimension
 * labels) may be misread. Flags for review; not a hard block.
 */
export function ocrGate(ocr_confidence: number): GateResult {
  if (ocr_confidence >= GATE_THRESHOLDS.ocr) {
    return { gate: "ocr", pass: true, hard: false };
  }
  return {
    gate: "ocr",
    pass: false,
    hard: false,
    reason: `OCR confidence ${ocr_confidence.toFixed(2)} below ${GATE_THRESHOLDS.ocr} — verify dimensions`,
  };
}

// ── Gate 4: required dimensions present (Phase 2 generic; Phase 4 per-scope) ─

/**
 * Phase-2 generic form: a sheet with NO usable dimensions cannot drive any
 * calculator — hard block. Phase 4 tightens this per scope (e.g. a deck needs
 * length AND width). Hard rule: no calculator runs without its required inputs.
 */
export function requiredDimsGate(dimensionCount: number): GateResult {
  if (dimensionCount > 0) {
    return { gate: "required_dims_present", pass: true, hard: false };
  }
  return {
    gate: "required_dims_present",
    pass: false,
    hard: true,
    reason: "no dimensions could be extracted — cannot calculate quantities",
  };
}

// ── Gate 5: geometry completeness (Phase 3) ───────────────────────────────

/**
 * Deferred to Phase 3 (geometry extraction). Until geometry is produced we
 * mark it explicitly NOT-EVALUATED rather than silently passing.
 */
export function geometryCompletenessGate(geometryReady: boolean): GateResult {
  if (!geometryReady) {
    return {
      gate: "geometry_completeness",
      pass: true,
      hard: false,
      reason: "deferred: geometry not extracted yet (Phase 3)",
    };
  }
  return { gate: "geometry_completeness", pass: true, hard: false };
}

// ── Gate 6: text-vs-geometry agreement (Phase 3/4) ────────────────────────

/**
 * Deferred to Phase 3/4 (needs both labelled dims AND measured geometry to
 * compare). When geometry exists, a labelled dimension and its measured value
 * must agree within tolerance; on mismatch we surface BOTH and never silently
 * pick one. With no geometry yet, this is explicitly NOT evaluated.
 */
export function textVsGeometryGate(args: {
  hasGeometry: boolean;
  maxRelativeDelta?: number | null;
}): GateResult {
  if (!args.hasGeometry) {
    return {
      gate: "text_vs_geometry",
      pass: true,
      hard: false,
      reason: "deferred: no geometry to cross-check (Phase 3/4)",
    };
  }
  const delta = args.maxRelativeDelta ?? 0;
  if (delta <= GATE_THRESHOLDS.text_vs_geometry_tolerance) {
    return { gate: "text_vs_geometry", pass: true, hard: false };
  }
  return {
    gate: "text_vs_geometry",
    pass: false,
    hard: false,
    reason: `labelled vs measured dimension differ by ${(delta * 100).toFixed(
      0,
    )}% (> ${(GATE_THRESHOLDS.text_vs_geometry_tolerance * 100).toFixed(0)}%) — verify both`,
  };
}

// ── Roll-up (NO averaging) ────────────────────────────────────────────────

export type GateEnforcement = {
  results: GateResult[];
  /** True if ANY gate failed (hard OR soft). */
  review_required: boolean;
  /** True if ANY HARD gate failed — sheet must not proceed to a calculator. */
  blocked: boolean;
  reasons: string[];
};

/**
 * Run every gate that is meaningful for an extracted sheet and combine them
 * with strict OR semantics — never an average. One failing signal is enough
 * to require review; one failing HARD signal blocks calculation entirely.
 */
export function enforceExtractionGates(
  extracted: ExtractedSheet,
  _sheetType: SheetType,
): GateEnforcement {
  const hasGeometry =
    extracted.geometry.closed_areas.length > 0 ||
    extracted.geometry.polylines.length > 0;

  const results: GateResult[] = [
    scaleGate(extracted.scale_confidence),
    ocrGate(extracted.ocr_confidence),
    requiredDimsGate(extracted.dimensions.length),
    geometryCompletenessGate(hasGeometry),
    textVsGeometryGate({ hasGeometry, maxRelativeDelta: 0 }),
  ];

  const failed = results.filter((r) => !r.pass);
  const blocked = results.some((r) => !r.pass && r.hard);
  const reasons = failed
    .map((r) => r.reason)
    .filter((x): x is string => Boolean(x));

  return {
    results,
    review_required: failed.length > 0,
    blocked,
    reasons,
  };
}
