/**
 * Pure helpers for the compliance review panel.
 *
 * Lives in `src/lib/compliance/` (not co-located with the React
 * component) so we can unit-test it in plain Node without jsdom.
 *
 * The component imports these to:
 *   - bucket warnings into categories matching the rules engine
 *     (insulation / treatment / fastener / other)
 *   - turn a flat clarifications array into a form-ready answer state
 *   - parse the user's submitted answers back into a typed
 *     `WallContext` partial so the API can re-run the review
 *
 * Nothing in here imports from `react` or `next` — kept pure.
 */

import type {
  ClarificationQuestion,
  ComplianceReview,
  ComplianceWarning,
  WallCladding,
  WallContext,
  WallLining,
  WallType,
} from "./types";

// ---------------------------------------------------------------------------
// Warning grouping
// ---------------------------------------------------------------------------

export type WarningCategory =
  | "insulation"
  | "treatment"
  | "fastener"
  | "clarification"
  | "other";

/**
 * Bucket warnings into the rule category that produced them. We use the
 * warning's `title` as a stable signal — every rule emits a recognisable
 * phrase. Unrecognised warnings fall into `other`.
 */
export function categoriseWarning(w: ComplianceWarning): WarningCategory {
  const t = w.title.toLowerCase();
  if (/insulation|pink batts/i.test(t)) return "insulation";
  if (/treatment class|h-?class|nzs 3602|nzs 3640/i.test(t)) return "treatment";
  if (/bright|fastener|galvanised|stainless|nail/i.test(t)) return "fastener";
  if (/clarif|missing/i.test(t)) return "clarification";
  return "other";
}

export type WarningsByCategory = Record<WarningCategory, ComplianceWarning[]>;

/** Group an array of warnings by category in a stable order. */
export function groupWarningsByCategory(
  warnings: ReadonlyArray<ComplianceWarning>,
): WarningsByCategory {
  const empty: WarningsByCategory = {
    insulation: [],
    treatment: [],
    fastener: [],
    clarification: [],
    other: [],
  };
  for (const w of warnings) empty[categoriseWarning(w)].push(w);
  return empty;
}

// ---------------------------------------------------------------------------
// Review summary
// ---------------------------------------------------------------------------

export type ReviewSummary = {
  status: ComplianceReview["status"];
  /** Number of clarification questions outstanding. */
  clarificationsCount: number;
  /** Number of warnings, by severity. */
  warningCounts: { info: number; warning: number; blocker: number };
  /** Number of distinct cited knowledge sources. */
  citationCount: number;
  /** Whether the review is currently safe to "Send Quote" without confirmation. */
  isSafeToSend: boolean;
};

/**
 * Build a compact summary object the panel can render at-a-glance.
 *
 * `isSafeToSend` is true iff status is `ok` or `disabled` AND there are
 * no `blocker`-severity warnings. The matcher fields are independent of
 * this — a quote can still be sent if matcher said `missing_price` for
 * a line, that's a UX warning the tradie sees in the editor.
 */
export function summariseReview(review: ComplianceReview): ReviewSummary {
  const counts = { info: 0, warning: 0, blocker: 0 };
  for (const w of review.warnings) counts[w.severity]++;
  const isSafeToSend =
    (review.status === "ok" || review.status === "disabled") &&
    counts.blocker === 0;
  return {
    status: review.status,
    clarificationsCount: review.clarifications.length,
    warningCounts: counts,
    citationCount: review.citations.length,
    isSafeToSend,
  };
}

// ---------------------------------------------------------------------------
// Clarification answer parsing
// ---------------------------------------------------------------------------

/**
 * Map of clarification answers from the form, keyed by `ClarificationQuestion.id`.
 * Each value is the chosen string from the question's `options` (or
 * free-text when no options exist).
 */
export type ClarificationAnswers = Record<string, string>;

/** Initial empty answer state derived from a list of questions. */
export function emptyAnswers(
  questions: ReadonlyArray<ClarificationQuestion>,
): ClarificationAnswers {
  const out: ClarificationAnswers = {};
  for (const q of questions) out[q.id] = "";
  return out;
}

/**
 * Parse the form answers back into a typed `WallContext` partial. Unset
 * or empty answers are simply omitted — the engine treats absence as
 * "still missing" and emits the question again next round.
 */
export function answersToWallContext(
  answers: ClarificationAnswers,
): Partial<WallContext> {
  const wall: Partial<WallContext> = {};

  if (answers["wall.type"] === "internal" || answers["wall.type"] === "external") {
    wall.type = answers["wall.type"] as WallType;
  }
  if (answers["wall.isLoadbearing"] === "yes") wall.isLoadbearing = true;
  else if (answers["wall.isLoadbearing"] === "no") wall.isLoadbearing = false;

  if (answers["wall.isBracing"] === "yes") wall.isBracing = true;
  else if (answers["wall.isBracing"] === "no") wall.isBracing = false;

  if (answers["wall.isWetArea"] === "yes") wall.isWetArea = true;
  else if (answers["wall.isWetArea"] === "no") wall.isWetArea = false;

  if (answers["wall.isThermalEnvelope"] === "yes") wall.isThermalEnvelope = true;
  else if (answers["wall.isThermalEnvelope"] === "no") wall.isThermalEnvelope = false;

  if (answers["wall.acousticOrFireRequired"] === "yes")
    wall.acousticOrFireRequired = true;
  else if (answers["wall.acousticOrFireRequired"] === "no")
    wall.acousticOrFireRequired = false;

  const cladding = answers["wall.cladding"];
  const validCladding: ReadonlyArray<WallCladding> = [
    "weatherboard",
    "fibre_cement",
    "brick_veneer",
    "metal",
    "plaster",
    "other",
  ];
  if (cladding && validCladding.includes(cladding as WallCladding)) {
    wall.cladding = cladding as WallCladding;
  }

  const lining = answers["wall.lining"];
  const validLining: ReadonlyArray<WallLining> = [
    "gib_standard",
    "gib_aqualine",
    "gib_braceline",
    "gib_noiseline",
    "plywood",
    "tongue_groove",
    "other",
  ];
  if (lining && validLining.includes(lining as WallLining)) {
    wall.lining = lining as WallLining;
  }

  const studSpacing = Number(answers["wall.studSpacingMm"]);
  if (Number.isFinite(studSpacing) && studSpacing > 0) {
    wall.studSpacingMm = studSpacing;
  }

  return wall;
}

/** True iff every question listed has a non-empty answer. */
export function answersAreComplete(
  questions: ReadonlyArray<ClarificationQuestion>,
  answers: ClarificationAnswers,
): boolean {
  for (const q of questions) {
    const v = answers[q.id];
    if (typeof v !== "string" || v.length === 0) return false;
  }
  return true;
}
