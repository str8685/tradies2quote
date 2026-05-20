// ─────────────────────────────────────────────────────────────────────────
// Golden dataset — known-correct takeoff scenarios.
//
// Each case is a real estimation job with the outcome we expect the
// engine to produce. The runner (golden.test.ts) feeds the input through
// the orchestrator and asserts on status, structure and the evaluator
// verdict. This is the regression net: a change that quietly breaks one
// of these jobs fails CI.
//
// HOW TO ADD A CASE
//   Append an entry below. Use kind:"text" to exercise the regex
//   extractor end-to-end, or kind:"extraction" to pin exact geometry
//   (e.g. openings) without depending on the parser.
//
// HOW TO ASSERT EVALUATOR OUTCOME
//   - evaluatorStatus  → exact match (use for jobs that MUST caution/fail).
//   - evaluatorAtMost  → ceiling (use for clean jobs: "never worse than").
//     Clean jobs use a "caution" ceiling rather than exact "pass" so a
//     conservative heuristic firing doesn't break the suite — the safety
//     property we guard is "a clean job is never hard-failed". Tighten to
//     evaluatorStatus:"pass" per case once you've confirmed it's stable.
//
// Run only this suite:  npx vitest run src/lib/takeoff/__tests__/golden
// ─────────────────────────────────────────────────────────────────────────

import type {
  EvaluatorStatus,
  ExtractedExtraction,
  ScopeType,
  TakeoffStatus,
} from "../../schemas";

export type GoldenScopeExpectation = {
  scope: ScopeType;
  status?: TakeoffStatus;
  minLines?: number;
  /** Inclusive [min, max] range for summary.primary_value. */
  primaryValueRange?: [number, number];
  requireLineIds?: string[];
};

export type GoldenExpectation = {
  overallStatus?: TakeoffStatus;
  primaryScope?: ScopeType;
  /** Exact evaluator verdict. */
  evaluatorStatus?: EvaluatorStatus;
  /** Evaluator verdict must be no worse than this. */
  evaluatorAtMost?: EvaluatorStatus;
  scopes?: GoldenScopeExpectation[];
  /** Scopes that must come back blocked with at least one clarification. */
  blockedScopes?: ScopeType[];
};

export type GoldenCase =
  | { name: string; kind: "text"; description: string; expect: GoldenExpectation }
  | {
      name: string;
      kind: "extraction";
      extraction: ExtractedExtraction;
      expect: GoldenExpectation;
    };

const ext = (o: Partial<ExtractedExtraction>): ExtractedExtraction => ({
  confidence: 0.85,
  project_type: null,
  scope_type: "generic",
  sub_scopes: [],
  dimensions: {},
  openings: [],
  notes: [],
  needs_clarification: [],
  clarification_questions: [],
  source_basis: "manual",
  ...o,
});

export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "decking — rectangular deck on piles",
    kind: "text",
    description:
      "Build a 4.8m by 3m deck on piles, joists at 450mm centres, 6m timber stock.",
    expect: {
      primaryScope: "deck",
      evaluatorAtMost: "caution",
      scopes: [{ scope: "deck", minLines: 1 }],
    },
  },
  {
    name: "cladding — windows/doors deducted from net area",
    kind: "extraction",
    extraction: ext({
      scope_type: "cladding",
      dimensions: { length_m: 8, height_m: 2.4 },
      material_spec: "weatherboard with windows and a door",
      openings: [
        { kind: "door", width_m: 0.82, height_m: 2.04, count: 1 },
        { kind: "window", width_m: 1.2, height_m: 1.2, count: 2 },
      ],
    }),
    expect: {
      primaryScope: "cladding",
      evaluatorAtMost: "caution",
      scopes: [{ scope: "cladding", primaryValueRange: [14, 15.3] }],
    },
  },
  {
    name: "cladding — openings mentioned but missing MUST caution",
    kind: "extraction",
    extraction: ext({
      scope_type: "cladding",
      dimensions: { length_m: 8, height_m: 2.4 },
      material_spec: "weatherboard with 3 windows and a ranchslider",
      openings: [],
    }),
    expect: {
      primaryScope: "cladding",
      evaluatorStatus: "caution",
      scopes: [{ scope: "cladding", minLines: 1 }],
    },
  },
  {
    name: "framing — standard 600mm stud spacing",
    kind: "extraction",
    extraction: ext({
      scope_type: "framing",
      dimensions: { length_m: 6, height_m: 2.4 },
      spacing_mm: 600,
    }),
    expect: {
      primaryScope: "framing",
      evaluatorAtMost: "caution",
      scopes: [
        {
          scope: "framing",
          requireLineIds: ["studs-90x45", "plates-90x45", "nogs-90x45"],
        },
      ],
    },
  },
  {
    name: "roofing — pitched area exceeds plan area",
    kind: "extraction",
    extraction: ext({
      scope_type: "roofing",
      dimensions: { area_m2: 100, length_m: 10, width_m: 10, pitch_deg: 30 },
    }),
    expect: {
      primaryScope: "roofing",
      evaluatorAtMost: "caution",
      scopes: [{ scope: "roofing", primaryValueRange: [110, 120] }],
    },
  },
  {
    name: "concrete — slab volume from L×W×thickness",
    kind: "extraction",
    extraction: ext({
      scope_type: "concrete",
      dimensions: { length_m: 5, width_m: 4, height_m: 100 },
    }),
    expect: {
      primaryScope: "concrete",
      evaluatorAtMost: "caution",
      scopes: [{ scope: "concrete", requireLineIds: ["concrete-volume"] }],
    },
  },
  {
    name: "fencing — posts/rails/palings from perimeter",
    kind: "extraction",
    extraction: ext({
      scope_type: "fencing",
      dimensions: { perimeter_m: 30, height_m: 1.8 },
    }),
    expect: {
      primaryScope: "fencing",
      evaluatorAtMost: "caution",
      scopes: [
        {
          scope: "fencing",
          requireLineIds: ["fence-posts", "fence-rails", "fence-palings"],
        },
      ],
    },
  },
  {
    name: "ambiguous — deck with no dimensions MUST block",
    kind: "text",
    description: "Build me a deck please.",
    expect: {
      overallStatus: "blocked",
      blockedScopes: ["deck"],
    },
  },
  {
    name: "multi-scope — deck + roof + fence each get their own scope",
    kind: "text",
    description: "6m by 3m deck plus a 20m² roof and 30m of fencing.",
    expect: {
      scopes: [{ scope: "deck" }, { scope: "roofing" }, { scope: "fencing" }],
    },
  },
];
