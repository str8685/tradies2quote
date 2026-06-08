// ─────────────────────────────────────────────────────────────────────────
// Floor-plan → material EVAL METRICS — STRUCTURE ONLY (non-runtime, no fixtures).
//
// Pure scoring functions over (expected, actual) pairs. They do NOT run the
// pipeline and do NOT read any image — a future harness will produce `actual`
// by running the real planreader/bridge/calculator path against labelled
// fixtures (which don't exist yet — task #35), then feed the pairs here.
//
// Defining the metric SHAPE now lets the fixtures + harness land later without
// re-litigating what "accuracy" means. Every metric is measured, never guessed;
// the no-guess-violation counter is a first-class, hard signal.
// ─────────────────────────────────────────────────────────────────────────

import type { SheetType } from "@/lib/planreader/schema";

/** Hand-labelled truth for one floor-plan fixture. */
export interface FloorPlanExpected {
  sheet_type: SheetType;
  /** Expected parsed scale denominator (the N in 1:N), or null if none/NTS. */
  scale_ratio_denominator: number | null;
  /** Dimensions (m) the sheet legibly prints — for labelled-dim recall. */
  labelled_dims_m: number[];
  /** Expected total/exterior wall length (m), or null if not derivable. */
  wall_length_m: number | null;
  /** Expected material quantities by stable line key (e.g. "studs", "gib"). */
  materials: Record<string, number>;
  /** Whether this sheet SHOULD block (insufficient measured-or-labelled data). */
  expected_blocked: boolean;
}

/** What the pipeline actually produced for that fixture. */
export interface FloorPlanActual {
  sheet_type: SheetType;
  scale_ratio_denominator: number | null;
  labelled_dims_m: number[];
  wall_length_m: number | null;
  materials: Record<string, number>;
  blocked: boolean;
  /**
   * Count of numbers the pipeline emitted WITHOUT a measured-or-labelled
   * source (i.e. a guess / silent default leaked through). Must be 0.
   */
  no_guess_violations: number;
}

export interface FloorPlanEvalCase {
  id: string;
  expected: FloorPlanExpected;
  actual: FloorPlanActual;
}

export interface FloorPlanEvalSummary {
  total: number;
  /** sheet_type match rate. */
  classificationAccuracy: number;
  /** parsed-scale match rate (both-null counts as a match). */
  scaleParseAccuracy: number;
  /** mean fraction of expected labelled dims found within tolerance. */
  labelledDimRecall: number;
  /** mean |Δ|/truth over cases with an expected wall length; null if none. */
  wallLengthErrorPct: number | null;
  /** mean per-line |Δ|/truth over non-blocked cases with materials; null if none. */
  materialErrorPct: number | null;
  /** blocked-vs-auto decision quality. */
  blockedDecision: {
    correct: number;
    /** expected to block but auto-calculated — the WORST failure. */
    falseAuto: number;
    /** expected to auto but blocked — over-cautious. */
    overBlock: number;
  };
  /** total no-guess violations across all cases (target: 0). */
  noGuessViolations: number;
  tolerancePct: number;
}

function within(a: number, b: number, tol: number): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / Math.abs(b) <= tol;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Score a set of (expected, actual) floor-plan pairs. Pure; deterministic.
 * `tolerancePct` (default 0.05) is the relative band for dimension/material
 * matches — the same 5% used by the text-vs-geometry gate.
 */
export function summariseFloorPlanEval(
  cases: readonly FloorPlanEvalCase[],
  opts: { tolerancePct?: number } = {},
): FloorPlanEvalSummary {
  const tol = opts.tolerancePct ?? 0.05;
  const total = cases.length;

  let classMatches = 0;
  let scaleMatches = 0;
  const recalls: number[] = [];
  const wallErrs: number[] = [];
  const materialErrs: number[] = [];
  let correct = 0;
  let falseAuto = 0;
  let overBlock = 0;
  let noGuessViolations = 0;

  for (const { expected: e, actual: a } of cases) {
    if (a.sheet_type === e.sheet_type) classMatches += 1;
    if (a.scale_ratio_denominator === e.scale_ratio_denominator) scaleMatches += 1;

    // labelled-dim recall: fraction of expected dims found within tolerance.
    if (e.labelled_dims_m.length > 0) {
      const found = e.labelled_dims_m.filter((ed) =>
        a.labelled_dims_m.some((ad) => within(ad, ed, tol)),
      ).length;
      recalls.push(found / e.labelled_dims_m.length);
    }

    // wall-length error %, only where a truth exists and the pipeline produced one.
    if (e.wall_length_m != null && a.wall_length_m != null && e.wall_length_m > 0) {
      wallErrs.push(Math.abs(a.wall_length_m - e.wall_length_m) / e.wall_length_m);
    }

    // material error %, only on cases that should NOT block.
    if (!e.expected_blocked) {
      const keys = Object.keys(e.materials);
      if (keys.length > 0) {
        const perLine = keys.map((k) => {
          const ev = e.materials[k];
          const av = a.materials[k];
          if (av === undefined) return 1; // missing expected line = full miss
          return ev === 0 ? (av === 0 ? 0 : 1) : Math.abs(av - ev) / Math.abs(ev);
        });
        materialErrs.push(mean(perLine));
      }
    }

    // blocked-vs-auto decision.
    if (e.expected_blocked === a.blocked) correct += 1;
    else if (e.expected_blocked && !a.blocked) falseAuto += 1;
    else overBlock += 1;

    noGuessViolations += a.no_guess_violations;
  }

  return {
    total,
    classificationAccuracy: total === 0 ? 1 : classMatches / total,
    scaleParseAccuracy: total === 0 ? 1 : scaleMatches / total,
    labelledDimRecall: recalls.length === 0 ? 1 : mean(recalls),
    wallLengthErrorPct: wallErrs.length === 0 ? null : mean(wallErrs),
    materialErrorPct: materialErrs.length === 0 ? null : mean(materialErrs),
    blockedDecision: { correct, falseAuto, overBlock },
    noGuessViolations,
    tolerancePct: tol,
  };
}
