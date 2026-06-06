// ─────────────────────────────────────────────────────────────────────────
// Plan-reader eval cases — ground truth for classification + extraction.
//
// Each case points at ONE real plan SHEET image (export each page of a plan
// PDF to a PNG/JPG) in src/eval/fixtures/drawings/<file> and records what the
// answer SHOULD be — measured/read off the sheet BY HAND. The harness
// (plan-reader-eval.test.ts) runs the real classifier + extractor and scores:
//   classification accuracy · scale-extraction success · OCR/dimension quality
//   · required-dims-present rate · per-sheet gate outcomes.
//
// To add a case:
//   1. Export a plan sheet to src/eval/fixtures/drawings/<id>.png (one image
//      per sheet — the harness classifies/extracts per sheet, not per PDF).
//   2. Read the truth yourself: the sheet type, the printed scale, the units,
//      and a few key dimensions in METRES.
//   3. Add a case below pointing `image` at your file.
//   4. Run: npm run eval:plans
//
// Cases whose image file is missing are SKIPPED, so this list can grow ahead
// of the fixtures. NEVER invent expected values — leave a field out if you
// haven't measured it.
// ─────────────────────────────────────────────────────────────────────────

import type { LengthUnit, SheetType } from "@/lib/planreader/schema";

export type PlanReaderExpect = {
  /** The sheet type a correct classifier must return. */
  sheet_type: SheetType;
  /** The printed scale label, if the sheet has one (e.g. "1:100"). */
  scale_text?: string | null;
  /** Do we expect a USABLE scale (scale_confidence > 0)? */
  scale_should_parse?: boolean;
  /** Expected drawing units, if printed. */
  units?: LengthUnit | null;
  /** A few key real-world dimensions in METRES, measured by hand. */
  expected_dims_m?: number[];
  /** Allowed % error before a dimension counts as "found". Default 5%. */
  dim_tolerance_pct?: number;
  /**
   * Should the required-dims gate pass for this sheet? (i.e. is there enough
   * dimensional info on the sheet to drive a calculator at all?)
   */
  expect_required_dims_present?: boolean;
};

export type PlanReaderCase = {
  id: string;
  /** Filename under src/eval/fixtures/drawings/ (one sheet per image). */
  image: string;
  expect: PlanReaderExpect;
  notes?: string;
};

/**
 * Seed cases — placeholders documenting the coverage we need across the three
 * SUPPORTED disciplines. Replace the expected values with hand-measured truth
 * once the matching sheet image is dropped into the fixtures folder. Until a
 * file exists, its case is skipped (so these double as a coverage checklist).
 */
export const PLAN_READER_CASES: PlanReaderCase[] = [
  // ── Deck ────────────────────────────────────────────────────────────────
  {
    id: "deck-rect-6x4",
    image: "deck-rect-6x4.png",
    expect: {
      sheet_type: "deck",
      scale_text: "1:50",
      scale_should_parse: true,
      units: "mm",
      expected_dims_m: [6.0, 4.0],
      expect_required_dims_present: true,
    },
    notes: "Plain rectangular deck plan — baseline classification + dims.",
  },
  {
    id: "deck-lshape",
    image: "deck-lshape.png",
    expect: {
      sheet_type: "deck",
      scale_should_parse: true,
      units: "mm",
      expect_required_dims_present: true,
    },
    notes: "L-shaped deck — multi-segment dimensions.",
  },

  // ── Floor / building layout ──────────────────────────────────────────────
  {
    id: "floorplan-3bed",
    image: "floorplan-3bed.png",
    expect: {
      sheet_type: "floor_plan",
      scale_text: "1:100",
      scale_should_parse: true,
      units: "mm",
      expect_required_dims_present: true,
    },
    notes: "Single-storey 3-bedroom floor plan — rooms, doors, windows.",
  },
  {
    id: "floorplan-extension",
    image: "floorplan-extension.png",
    expect: {
      sheet_type: "floor_plan",
      scale_should_parse: true,
      units: "mm",
      expect_required_dims_present: true,
    },
    notes: "Renovation/extension layout.",
  },

  // ── Foundation ────────────────────────────────────────────────────────────
  {
    id: "foundation-slab",
    image: "foundation-slab.png",
    expect: {
      sheet_type: "foundation",
      scale_text: "1:100",
      scale_should_parse: true,
      units: "mm",
      expect_required_dims_present: true,
    },
    notes: "Slab-on-grade foundation with footing/perimeter dims + mesh note.",
  },
  {
    id: "foundation-piles",
    image: "foundation-piles.png",
    expect: {
      sheet_type: "foundation",
      scale_should_parse: true,
      units: "mm",
      expect_required_dims_present: true,
    },
    notes: "Pile-layout foundation plan.",
  },

  // ── Negative / out-of-scope (should NOT be treated as a supported type) ───
  {
    id: "elevation-north",
    image: "elevation-north.png",
    expect: {
      sheet_type: "elevation",
      // recognized but unsupported — must NOT be extracted as a takeoff sheet.
    },
    notes: "Elevation — classifier must recognize and the extractor must skip.",
  },
];
