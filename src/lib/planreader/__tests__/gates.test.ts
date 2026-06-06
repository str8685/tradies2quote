import { describe, expect, it } from "vitest";
import {
  classificationGate,
  enforceExtractionGates,
  ocrGate,
  requiredDimsGate,
  scaleGate,
} from "../gates";
import type { ExtractedSheet, SheetClassification } from "../schema";

const cls = (
  sheet_type: SheetClassification["sheet_type"],
  confidence: number,
): SheetClassification => ({ sheet_type, confidence, basis: [] });

describe("classificationGate", () => {
  it("hard-fails an unknown sheet", () => {
    const g = classificationGate(cls("unknown", 0));
    expect(g.pass).toBe(false);
    expect(g.hard).toBe(true);
  });

  it("hard-fails a low-confidence supported sheet", () => {
    const g = classificationGate(cls("deck", 0.4));
    expect(g.pass).toBe(false);
    expect(g.hard).toBe(true);
  });

  it("passes a confident supported sheet", () => {
    expect(classificationGate(cls("deck", 0.8)).pass).toBe(true);
  });

  it("passes a recognized-but-unsupported sheet with an advisory reason", () => {
    const g = classificationGate(cls("elevation", 0.9));
    expect(g.pass).toBe(true);
    expect(g.reason).toMatch(/no takeoff extractor/i);
  });
});

describe("scale / ocr / required-dims gates", () => {
  it("scaleGate fails (soft) when no scale", () => {
    const g = scaleGate(0);
    expect(g.pass).toBe(false);
    expect(g.hard).toBe(false);
  });

  it("ocrGate fails (soft) below threshold", () => {
    expect(ocrGate(0.3).pass).toBe(false);
    expect(ocrGate(0.9).pass).toBe(true);
  });

  it("requiredDimsGate HARD-fails with zero dimensions", () => {
    const g = requiredDimsGate(0);
    expect(g.pass).toBe(false);
    expect(g.hard).toBe(true);
  });
});

describe("enforceExtractionGates — OR of independent signals (no averaging)", () => {
  const base = (over: Partial<ExtractedSheet>): ExtractedSheet => ({
    units: "mm",
    scale_text: "1:100",
    scale_confidence: 0.92,
    ocr_confidence: 0.9,
    title_block: {},
    ocr_blocks: [],
    dimensions: [{ value_m: 4.8, raw_text: "4800", bbox: null, source: "text" }],
    detected_symbols: [],
    geometry: { polylines: [], closed_areas: [], openings: [] },
    takeoff: null,
    warnings: [],
    review_required: false,
    ...over,
  });

  it("passes when every active gate passes", () => {
    const e = enforceExtractionGates(base({}), "deck");
    expect(e.review_required).toBe(false);
    expect(e.blocked).toBe(false);
  });

  it("a single failing soft gate forces review even when others are perfect", () => {
    // Perfect OCR + dims, but no scale → review required, not blocked.
    const e = enforceExtractionGates(base({ scale_confidence: 0 }), "deck");
    expect(e.review_required).toBe(true);
    expect(e.blocked).toBe(false);
    expect(e.reasons.join(" ")).toMatch(/scale/i);
  });

  it("a hard gate failure blocks regardless of other strong signals", () => {
    const e = enforceExtractionGates(base({ dimensions: [] }), "deck");
    expect(e.blocked).toBe(true);
    expect(e.review_required).toBe(true);
  });
});
