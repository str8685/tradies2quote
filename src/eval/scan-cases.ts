// ─────────────────────────────────────────────────────────────────────────
// Drawing-scan eval cases — ground truth for shape-reading accuracy.
//
// Each case points at a real hand-drawn plan photo in
//   src/eval/fixtures/drawings/<image>
// and records what the answer SHOULD be (shape + true area, measured off the
// real drawing yourself). The eval (scan-eval.test.ts) runs the real vision
// prompt against each image and scores how close the model got.
//
// To add a case:
//   1. Photograph a hand-drawn plan (or export a sketch).
//   2. Save it as src/eval/fixtures/drawings/<id>.jpg (or .png).
//   3. Work out the TRUE area/perimeter yourself and add a case below.
//   4. Run: npm run eval:scan
//
// Cases whose image file is missing are skipped, so this list can grow
// faster than you add photos.
// ─────────────────────────────────────────────────────────────────────────

import type { ShapeKind } from "@/lib/takeoff/geometry";

export type ScanExpect = {
  /** Acceptable shape(s). Pass an array when more than one reading is fine. */
  shape: ShapeKind | ShapeKind[];
  /** True plan area in m², measured off the drawing by hand. */
  area_m2: number;
  /** Allowed % error on area before it's a miss. Default 10%. */
  areaTolerancePct?: number;
  /** Optional true perimeter in m (fences, slabs). */
  perimeter_m?: number;
  perimeterTolerancePct?: number;
};

export type ScanCase = {
  id: string;
  /** Filename under src/eval/fixtures/drawings/ */
  image: string;
  /** Deck | Fence | Framing | Concrete | Roofing | Other */
  jobType: string;
  /** Timber stock length the tradie buys in (default 6). */
  timberLength?: number;
  /** Optional free-text hint, mirrors the in-app "optional context" field. */
  hint?: string;
  expect: ScanExpect;
  notes?: string;
};

/**
 * Seed cases. The numbers below are PLACEHOLDERS describing the kind of
 * drawing each slot expects — replace them with the real values once you drop
 * the matching photo into the fixtures folder. They double as documentation of
 * the shape coverage we care about.
 */
export const SCAN_CASES: ScanCase[] = [
  {
    id: "rect-deck-6x4",
    image: "rect-deck-6x4.jpg",
    jobType: "Deck",
    expect: { shape: "rect", area_m2: 24, perimeter_m: 20 },
    notes: "Plain rectangular deck — the baseline that must never regress.",
  },
  {
    id: "l-shape-deck",
    image: "l-shape-deck.jpg",
    jobType: "Deck",
    expect: { shape: ["l_shape", "rect"], area_m2: 30, areaTolerancePct: 12 },
    notes:
      "L-shaped deck. Bounding box would over-quote; composite area must be lower.",
  },
  {
    id: "triangle-patio",
    image: "triangle-patio.jpg",
    jobType: "Concrete",
    expect: { shape: "triangle", area_m2: 9, areaTolerancePct: 12 },
    notes: "Triangular patio/pad — tests ½·b·h primitive.",
  },
  {
    id: "circle-pad",
    image: "circle-pad.jpg",
    jobType: "Concrete",
    expect: { shape: "circle", area_m2: 12.57, areaTolerancePct: 12 },
    notes: "Round concrete pad, ~2m radius — tests πr².",
  },
  {
    id: "boundary-fence-24m",
    image: "boundary-fence-24m.jpg",
    jobType: "Fence",
    expect: { shape: "line", area_m2: 0, perimeter_m: 24, perimeterTolerancePct: 8 },
    notes: "Straight boundary fence run — perimeter/length only.",
  },
];
