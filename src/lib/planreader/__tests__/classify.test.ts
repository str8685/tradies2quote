import { describe, expect, it } from "vitest";
import {
  classifyFromText,
  combineClassification,
} from "../classify";
import type { SheetClassification } from "../schema";

describe("classifyFromText — filename + title-block heuristics", () => {
  it("classifies a clear deck filename", () => {
    const r = classifyFromText({ filename: "backyard-deck-plan.pdf" });
    expect(r.sheet_type).toBe("deck");
    expect(r.confidence).toBeGreaterThan(0.3);
    expect(r.basis.some((b) => b.startsWith("filename:"))).toBe(true);
  });

  it("classifies a foundation title block strongly", () => {
    const r = classifyFromText({
      titleBlockText: "FOUNDATION PLAN — footing layout, slab on grade, D12 mesh",
    });
    expect(r.sheet_type).toBe("foundation");
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("classifies a floor plan from title-block text", () => {
    const r = classifyFromText({
      titleBlockText: "GROUND FLOOR PLAN — building layout, rooms and openings",
    });
    expect(r.sheet_type).toBe("floor_plan");
  });

  it("title-block text outweighs a misleading filename", () => {
    const r = classifyFromText({
      filename: "sheet-03.pdf",
      titleBlockText: "NORTH ELEVATION",
    });
    expect(r.sheet_type).toBe("elevation");
  });

  it("returns unknown@0 when nothing matches", () => {
    const r = classifyFromText({
      filename: "scan_2026_06_07.pdf",
      titleBlockText: "Drawing 1234",
    });
    expect(r.sheet_type).toBe("unknown");
    expect(r.confidence).toBe(0);
    expect(r.basis).toHaveLength(0);
  });

  it("recognises a door/window schedule", () => {
    const r = classifyFromText({ titleBlockText: "DOOR SCHEDULE" });
    expect(r.sheet_type).toBe("schedule");
  });

  it("never exceeds the 0.9 text-only ceiling", () => {
    const r = classifyFromText({
      filename: "foundation-footing-slab-pile-foundation.pdf",
      titleBlockText: "FOUNDATION PLAN FOOTING SLAB PILE LAYOUT REINFORCING MESH",
    });
    expect(r.confidence).toBeLessThanOrEqual(0.9);
  });

  it("penalises confidence when two types tie (ambiguous sheet)", () => {
    const ambiguous = classifyFromText({
      titleBlockText: "FOUNDATION PLAN and GROUND FLOOR PLAN combined",
    });
    const clean = classifyFromText({ titleBlockText: "FOUNDATION PLAN" });
    expect(ambiguous.confidence).toBeLessThan(clean.confidence);
  });
});

describe("combineClassification — text + vision merge", () => {
  const mk = (
    sheet_type: SheetClassification["sheet_type"],
    confidence: number,
  ): SheetClassification => ({ sheet_type, confidence, basis: [] });

  it("boosts confidence when text and vision agree", () => {
    const text = mk("deck", 0.5);
    const vision = mk("deck", 0.7);
    const r = combineClassification(text, vision);
    expect(r.sheet_type).toBe("deck");
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.basis).toContain("agree");
  });

  it("falls back to vision when text is unknown", () => {
    const r = combineClassification(mk("unknown", 0), mk("foundation", 0.8));
    expect(r.sheet_type).toBe("foundation");
    expect(r.confidence).toBe(0.8);
  });

  it("caps confidence and flags a text-vs-vision conflict", () => {
    const r = combineClassification(mk("deck", 0.8), mk("floor_plan", 0.85));
    expect(r.sheet_type).toBe("floor_plan");
    expect(r.confidence).toBeLessThanOrEqual(0.6);
    expect(r.basis.some((b) => b.startsWith("conflict:"))).toBe(true);
  });

  it("ignores an unknown vision verdict", () => {
    const text = mk("deck", 0.55);
    const r = combineClassification(text, mk("unknown", 0));
    expect(r).toEqual(text);
  });
});
