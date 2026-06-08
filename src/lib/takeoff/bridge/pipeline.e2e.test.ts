// End-to-end (still ISOLATED, non-runtime) test of the floor-plan path:
//
//   ExtractedSheet → adaptSheetToBridgeInput → applyConfirmations
//                  → sheetToExtraction → runCalculator
//
// This is a TEST harness only — it does not wire anything into a route, UI, or
// the live planreader flow. It proves the contract pieces compose into
// deterministic quantities (success) and that incomplete confirmation blocks
// before any calculator runs (no guessing). It deliberately relies ONLY on
// legitimately role-confirmed dims — never a building_* → length conversion
// (locked policy; see FLOORPLAN_ROLE_CONTRACT.md).
import { describe, expect, it } from "vitest";
import type { ExtractedSheet } from "@/lib/planreader/schema";
import { adaptSheetToBridgeInput } from "./sheetAdapter";
import { applyConfirmations } from "./confirmation";
import { sheetToExtraction } from "./sheetToExtraction";
import { runCalculator } from "../calculators";

// A framing floor-plan sheet: stud height is explicitly labelled (auto-tagged),
// but the total wall run is printed as a bare number → must be USER-CONFIRMED.
function framingSheet(): ExtractedSheet {
  return {
    units: "m",
    scale_text: "1:100",
    scale_confidence: 0.92,
    ocr_confidence: 0.9,
    title_block: {},
    ocr_blocks: [],
    dimensions: [
      { value_m: 2.4, raw_text: "Stud height 2.4m", bbox: null, source: "text" },
      { value_m: 24, raw_text: "24000", bbox: null, source: "text" }, // bare → untagged
    ],
    detected_symbols: [],
    geometry: {
      polylines: [],
      closed_areas: [],
      openings: [{ kind: "door", bbox: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
    },
    takeoff: null,
    warnings: [],
    review_required: false,
  };
}

describe("E2E: ExtractedSheet → adapter → confirmation → bridge → calculator", () => {
  it("CASE 1 — fully confirmed framing input yields deterministic quantities", () => {
    const sheet = framingSheet();

    // 1. adapt: stud height is auto-tagged; the bare 24000 lands in `untagged`.
    const adapted = adaptSheetToBridgeInput(sheet, "framing");
    expect(adapted.bridgeInput.roledDimensions.map((d) => d.role)).toEqual(["height"]);
    expect(adapted.untagged.map((u) => u.raw_text)).toEqual(["24000"]);

    // 2. confirm: user assigns the bare 24000 as the total wall run (length).
    const resolved = applyConfirmations(adapted, [
      { kind: "confirm_role", ref: { raw_text: "24000", value_m: 24 }, role: "length", source: "user-typed" },
    ]);
    expect(resolved.bridgeInput.roledDimensions.map((d) => d.role).sort()).toEqual(["height", "length"]);
    expect(resolved.pendingAcknowledgements).toHaveLength(0);

    // 3. bridge: produces a valid ExtractedExtraction (not blocked).
    const bridged = sheetToExtraction(resolved.bridgeInput);
    expect(bridged.ok).toBe(true);
    if (!bridged.ok) return;
    expect(bridged.extraction.dimensions.length_m).toBe(24);
    expect(bridged.extraction.dimensions.height_m).toBe(2.4);

    // 4. calculator: real deterministic framing takeoff.
    const result = runCalculator("framing", bridged.extraction);
    expect(result.scope).toBe("framing");
    expect(result.status).not.toBe("blocked");
    expect(result.lines.length).toBeGreaterThan(0);
    // every emitted line carries a real quantity (no zero-from-default).
    expect(result.lines.every((l) => l.quantity > 0)).toBe(true);

    // Determinism: run the WHOLE pipeline again from scratch → identical result.
    const adapted2 = adaptSheetToBridgeInput(framingSheet(), "framing");
    const resolved2 = applyConfirmations(adapted2, [
      { kind: "confirm_role", ref: { raw_text: "24000", value_m: 24 }, role: "length", source: "user-typed" },
    ]);
    const bridged2 = sheetToExtraction(resolved2.bridgeInput);
    expect(bridged2.ok).toBe(true);
    if (!bridged2.ok) return;
    const result2 = runCalculator("framing", bridged2.extraction);
    expect(JSON.stringify(result2)).toBe(JSON.stringify(result));
  });

  it("CASE 2 — partially confirmed input stays blocked; the calculator never runs", () => {
    const sheet = framingSheet();
    const adapted = adaptSheetToBridgeInput(sheet, "framing");

    // User leaves the wall run unresolved → only height is consumable.
    const resolved = applyConfirmations(adapted, [
      { kind: "leave_unresolved", ref: { raw_text: "24000", value_m: 24 } },
    ]);
    expect(resolved.unresolved.map((u) => u.raw_text)).toEqual(["24000"]);

    // bridge BLOCKS — framing still needs the wall-run length.
    const bridged = sheetToExtraction(resolved.bridgeInput);
    expect(bridged.ok).toBe(false);
    if (bridged.ok) return;
    expect(bridged.blocked.scope).toBe("framing");
    expect(bridged.blocked.reasons.map((r) => r.field)).toContain("length");
    expect(bridged.blocked.reasons[0].message).toMatch(/won't be assumed/i);

    // No extraction was produced → there is nothing to feed the calculator.
    // (No numbers are invented; the job must go back for confirmation.)
    expect("extraction" in bridged).toBe(false);
  });
});
