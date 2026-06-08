import { describe, expect, it } from "vitest";
import { applyConfirmations, type ConfirmationDecision } from "./confirmation";
import type { AdaptedSheet } from "./sheetAdapter";
import { sheetToExtraction } from "./sheetToExtraction";

const adapted = (over: Partial<AdaptedSheet> = {}): AdaptedSheet => ({
  bridgeInput: { scope: "framing", roledDimensions: [], openings: [] },
  untagged: [],
  buildingDims: [],
  scale: { text: "1:100", confidence: 0.92 },
  ...over,
});

const heightOnly = (scope: AdaptedSheet["bridgeInput"]["scope"] = "framing"): AdaptedSheet =>
  adapted({ bridgeInput: { scope, roledDimensions: [{ role: "height", value_m: 2.4, source: "labelled-sheet-confirmed" }], openings: [] } });

// ── Confirm an untagged dimension into a consumable role ────────────────────
describe("applyConfirmations — confirm untagged → consumable role", () => {
  it("adds the role, clears it from unresolved, and satisfies the bridge", () => {
    const a = { ...heightOnly(), untagged: [{ raw_text: "Length: 8400", value_m: 8.4 }] };
    const decisions: ConfirmationDecision[] = [
      { kind: "confirm_role", ref: { raw_text: "Length: 8400", value_m: 8.4 }, role: "length", source: "user-typed" },
    ];
    const r = applyConfirmations(a, decisions);
    expect(r.bridgeInput.roledDimensions.map((d) => d.role).sort()).toEqual(["height", "length"]);
    expect(r.bridgeInput.roledDimensions.find((d) => d.role === "length")?.source).toBe("user-typed");
    expect(r.unresolved).toHaveLength(0);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(true);
  });
});

// ── Leave a dimension unresolved ────────────────────────────────────────────
describe("applyConfirmations — leave unresolved keeps no-guess", () => {
  it("an unresolved length → framing still blocks (never guessed)", () => {
    const a = { ...heightOnly(), untagged: [{ raw_text: "8400", value_m: 8.4 }] };
    const r = applyConfirmations(a, [
      { kind: "leave_unresolved", ref: { raw_text: "8400", value_m: 8.4 } },
    ]);
    expect(r.unresolved.map((u) => u.raw_text)).toEqual(["8400"]);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(false);
  });

  it("no decisions at all → unresolved preserved, bridge blocks", () => {
    const a = { ...heightOnly(), untagged: [{ raw_text: "8400", value_m: 8.4 }] };
    const r = applyConfirmations(a, []);
    expect(r.unresolved).toHaveLength(1);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(false);
  });
});

// ── Keep building dims informational only ───────────────────────────────────
describe("applyConfirmations — building dims informational by default", () => {
  it("informational building dims never enter the consumable input", () => {
    const a = adapted({
      bridgeInput: { scope: "framing", roledDimensions: [{ role: "height", value_m: 2.4, source: "labelled-sheet-confirmed" }], openings: [] },
      buildingDims: [
        { role: "building_length", value_m: 8.4, source: "labelled-sheet-confirmed" },
        { role: "building_width", value_m: 6.0, source: "labelled-sheet-confirmed" },
      ],
    });
    const r = applyConfirmations(a, [
      { kind: "building_informational", ref: { role: "building_length", value_m: 8.4 } },
      { kind: "building_informational", ref: { role: "building_width", value_m: 6.0 } },
    ]);
    expect(r.informationalBuildingDims.map((d) => d.role).sort()).toEqual(["building_length", "building_width"]);
    expect(r.bridgeInput.roledDimensions.map((d) => d.role)).toEqual(["height"]);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(false); // still needs wall-run length
  });
});

// ── Explicitly confirm a conversion (only when acknowledged) ────────────────
describe("applyConfirmations — building → consumable conversion requires acknowledgement", () => {
  const base = () =>
    adapted({
      bridgeInput: { scope: "framing", roledDimensions: [{ role: "height", value_m: 2.4, source: "labelled-sheet-confirmed" }], openings: [] },
      buildingDims: [{ role: "building_length", value_m: 8.4, source: "labelled-sheet-confirmed" }],
    });

  it("acknowledged conversion is applied + audited, and satisfies the bridge", () => {
    const r = applyConfirmations(base(), [
      { kind: "building_convert", ref: { role: "building_length", value_m: 8.4 }, toRole: "length", acknowledged: true },
    ]);
    expect(r.bridgeInput.roledDimensions.map((d) => d.role).sort()).toEqual(["height", "length"]);
    expect(r.appliedConversions).toHaveLength(1);
    expect(r.appliedConversions[0]).toMatchObject({ fromRole: "building_length", toRole: "length", value_m: 8.4 });
    expect(r.appliedConversions[0].note).toMatch(/NOT the wall run/i);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(true);
  });

  it("UN-acknowledged conversion is pending, NOT applied → bridge still blocks", () => {
    const r = applyConfirmations(base(), [
      { kind: "building_convert", ref: { role: "building_length", value_m: 8.4 }, toRole: "length", acknowledged: false },
    ]);
    expect(r.pendingAcknowledgements).toHaveLength(1);
    expect(r.pendingAcknowledgements[0].message).toMatch(/won't be applied/i);
    expect(r.bridgeInput.roledDimensions.map((d) => d.role)).toEqual(["height"]);
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(false);
  });
});

// ── Opening sizes (later) ───────────────────────────────────────────────────
describe("applyConfirmations — opening sizes provided later", () => {
  it("fills a detected opening's size; junk sizes are not coerced", () => {
    const a = adapted({
      bridgeInput: {
        scope: "framing",
        roledDimensions: [],
        openings: [{ kind: "door", width_m: null, height_m: null, count: 1 }],
      },
    });
    const r = applyConfirmations(a, [
      { kind: "opening_size", ref: { index: 0 }, width_m: 0.81, height_m: 1.98, count: 2 },
      { kind: "opening_size", ref: { index: 5 }, width_m: 1, height_m: 1, count: 1 }, // out of range → ignored
    ]);
    expect(r.bridgeInput.openings[0]).toEqual({ kind: "door", width_m: 0.81, height_m: 1.98, count: 2 });
  });

  it("a non-finite/<=0 size stays null (never coerced)", () => {
    const a = adapted({ bridgeInput: { scope: "framing", roledDimensions: [], openings: [{ kind: "window", width_m: null, height_m: null, count: 1 }] } });
    const r = applyConfirmations(a, [
      { kind: "opening_size", ref: { index: 0 }, width_m: 0, height_m: Number.NaN, count: null },
    ]);
    expect(r.bridgeInput.openings[0].width_m).toBeNull();
    expect(r.bridgeInput.openings[0].height_m).toBeNull();
  });
});

// ── No-guess invariants on incomplete / invalid confirmation ────────────────
describe("applyConfirmations — no-guess on incomplete/invalid input", () => {
  it("a decision referencing a non-existent dim is ignored (never fabricated)", () => {
    const a = { ...heightOnly(), untagged: [{ raw_text: "8400", value_m: 8.4 }] };
    const r = applyConfirmations(a, [
      { kind: "confirm_role", ref: { raw_text: "NOT ON SHEET", value_m: 99 }, role: "length", source: "user-typed" },
    ]);
    expect(r.bridgeInput.roledDimensions.map((d) => d.role)).toEqual(["height"]);
    expect(r.unresolved).toHaveLength(1); // untouched
    expect(sheetToExtraction(r.bridgeInput).ok).toBe(false);
  });

  it("does not mutate the adapted input", () => {
    const a = { ...heightOnly(), untagged: [{ raw_text: "Length: 8400", value_m: 8.4 }] };
    const snap = JSON.stringify(a);
    applyConfirmations(a, [
      { kind: "confirm_role", ref: { raw_text: "Length: 8400", value_m: 8.4 }, role: "length", source: "user-typed" },
    ]);
    expect(JSON.stringify(a)).toBe(snap);
  });
});
