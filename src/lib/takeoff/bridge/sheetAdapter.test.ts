import { describe, expect, it } from "vitest";
import type { ExtractedSheet } from "@/lib/planreader/schema";
import { adaptSheetToBridgeInput } from "./sheetAdapter";
import { sheetToExtraction } from "./sheetToExtraction";

// Minimal ExtractedSheet factory — only the fields the adapter reads matter;
// the rest are filled with empty/neutral values.
function sheet(over: Partial<ExtractedSheet> = {}): ExtractedSheet {
  return {
    units: "m",
    scale_text: "1:100",
    scale_confidence: 0.92,
    ocr_confidence: 0.9,
    title_block: {},
    ocr_blocks: [],
    dimensions: [],
    detected_symbols: [],
    geometry: { polylines: [], closed_areas: [], openings: [] },
    takeoff: null,
    warnings: [],
    review_required: false,
    ...over,
  };
}

const dim = (raw_text: string, value_m: number) => ({
  value_m,
  raw_text,
  bbox: null,
  source: "text" as const,
});

describe("adaptSheetToBridgeInput — explicit tags map to consumable roles", () => {
  it("stud height + wall length → bridgeInput roledDimensions", () => {
    const a = adaptSheetToBridgeInput(
      sheet({ dimensions: [dim("Stud height 2.4m", 2.4), dim("Total wall length 24m", 24)] }),
      "framing",
    );
    expect(a.bridgeInput.scope).toBe("framing");
    expect(a.bridgeInput.roledDimensions.map((r) => [r.role, r.value_m])).toEqual([
      ["height", 2.4],
      ["length", 24],
    ]);
    expect(a.bridgeInput.roledDimensions.every((r) => r.source === "labelled-sheet-confirmed")).toBe(true);
    // and it actually satisfies the bridge end-to-end
    expect(sheetToExtraction(a.bridgeInput).ok).toBe(true);
  });
});

describe("adaptSheetToBridgeInput — untagged dims preserved, never guessed", () => {
  it("ambiguous labels stay in `untagged`, out of roledDimensions", () => {
    const a = adaptSheetToBridgeInput(
      sheet({ dimensions: [dim("3600", 3.6), dim("Bed 1: 3.6 x 4.2", 3.6)] }),
      "framing",
    );
    expect(a.bridgeInput.roledDimensions).toHaveLength(0);
    expect(a.untagged.map((u) => u.raw_text)).toEqual(["3600", "Bed 1: 3.6 x 4.2"]);
    // with nothing consumable, the bridge BLOCKS (not a guessed quantity)
    const res = sheetToExtraction(a.bridgeInput);
    expect(res.ok).toBe(false);
  });
});

describe("adaptSheetToBridgeInput — building dims stay non-consumable", () => {
  it("overall length/width go to buildingDims, NOT roledDimensions, and don't satisfy framing", () => {
    const a = adaptSheetToBridgeInput(
      sheet({
        dimensions: [
          dim("Overall length 8400", 8.4),
          dim("Overall width 6000", 6.0),
          dim("Stud height 2.4", 2.4),
        ],
      }),
      "framing",
    );
    expect(a.buildingDims.map((r) => r.role).sort()).toEqual(["building_length", "building_width"]);
    // only height is consumable → framing still needs wall-run length → BLOCKED
    expect(a.bridgeInput.roledDimensions.map((r) => r.role)).toEqual(["height"]);
    const res = sheetToExtraction(a.bridgeInput);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.blocked.reasons.map((r) => r.field)).toContain("length");
  });
});

describe("adaptSheetToBridgeInput — openings pass through with null sizes", () => {
  it("detected openings → count 1 each, sizes null (unmeasured, not guessed)", () => {
    const a = adaptSheetToBridgeInput(
      sheet({
        geometry: {
          polylines: [],
          closed_areas: [],
          openings: [
            { kind: "door", bbox: { x: 0, y: 0, w: 0.1, h: 0.1 } },
            { kind: "window", bbox: { x: 0.2, y: 0.2, w: 0.1, h: 0.1 } },
          ],
        },
      }),
      "framing",
    );
    expect(a.bridgeInput.openings).toEqual([
      { kind: "door", width_m: null, height_m: null, count: 1 },
      { kind: "window", width_m: null, height_m: null, count: 1 },
    ]);
  });
});

describe("adaptSheetToBridgeInput — blocked-capable on empty/missing data", () => {
  it("an empty sheet adapts to an empty (block-capable) bridge input", () => {
    const a = adaptSheetToBridgeInput(sheet(), "insulation");
    expect(a.bridgeInput.roledDimensions).toHaveLength(0);
    expect(a.bridgeInput.openings).toHaveLength(0);
    expect(sheetToExtraction(a.bridgeInput).ok).toBe(false);
  });

  it("carries scale context through for the confirmation step", () => {
    const a = adaptSheetToBridgeInput(sheet({ scale_text: "1:50", scale_confidence: 0.4 }), "lining");
    expect(a.scale).toEqual({ text: "1:50", confidence: 0.4 });
  });

  it("does not mutate the input sheet", () => {
    const s = sheet({ dimensions: [dim("Wall length 24", 24)] });
    const snap = JSON.stringify(s);
    adaptSheetToBridgeInput(s, "framing");
    expect(JSON.stringify(s)).toBe(snap);
  });
});
