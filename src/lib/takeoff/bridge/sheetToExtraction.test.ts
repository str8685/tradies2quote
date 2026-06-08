import { describe, expect, it } from "vitest";
import {
  sheetToExtraction,
  SUPPORTED_BRIDGE_SCOPES,
  type BridgeSheetInput,
  type RoledDimension,
} from "./sheetToExtraction";

const dim = (
  role: RoledDimension["role"],
  value_m: number,
  source: RoledDimension["source"] = "user-typed",
): RoledDimension => ({ role, value_m, source });

const input = (over: Partial<BridgeSheetInput> & { scope: BridgeSheetInput["scope"] }): BridgeSheetInput => ({
  roledDimensions: [],
  openings: [],
  ...over,
});

// ── Case 1: overall labelled dims present → derivable extraction ───────────
describe("sheetToExtraction — derivable extraction when required roles present", () => {
  it("framing: length + height → ok extraction carrying exactly those dims", () => {
    const res = sheetToExtraction(
      input({ scope: "framing", roledDimensions: [dim("length", 8.4), dim("height", 2.4)] }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.extraction.scope_type).toBe("framing");
    expect(res.extraction.dimensions.length_m).toBe(8.4);
    expect(res.extraction.dimensions.height_m).toBe(2.4);
    // absent roles stay null — never defaulted
    expect(res.extraction.dimensions.width_m).toBeNull();
    expect(res.extraction.dimensions.area_m2).toBeNull();
    expect(res.extraction.source_basis).toBe("manual");
  });

  it("lining: area alone satisfies the area-OR-(length+height) set", () => {
    const res = sheetToExtraction(
      input({ scope: "lining", roledDimensions: [dim("area", 31.5, "geometry-measured")] }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.extraction.dimensions.area_m2).toBe(31.5);
    expect(res.extraction.confidence).toBe(0.9); // all geometry-measured
  });

  it("insulation: length + height (no area) is also satisfiable", () => {
    const res = sheetToExtraction(
      input({ scope: "insulation", roledDimensions: [dim("length", 6), dim("height", 2.4)] }),
    );
    expect(res.ok).toBe(true);
  });
});

// ── Case 2: required dims missing → blocked with explicit reasons ───────────
describe("sheetToExtraction — missing required dims block (never assumed)", () => {
  it("framing with only length → blocked, reason names the missing height", () => {
    const res = sheetToExtraction(
      input({ scope: "framing", roledDimensions: [dim("length", 8.4)] }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.blocked.scope).toBe("framing");
    expect(res.blocked.reasons.map((r) => r.field)).toContain("height");
    expect(res.blocked.reasons[0].code).toBe("missing_required_dimension");
    // message must not promise a default
    expect(res.blocked.reasons[0].message).toMatch(/won't be assumed/i);
  });

  it("no dims at all → blocked, not a zero-quantity extraction", () => {
    const res = sheetToExtraction(input({ scope: "insulation" }));
    expect(res.ok).toBe(false);
  });
});

// ── Case 3: openings labelled → mapped through verbatim ─────────────────────
describe("sheetToExtraction — openings pass through, never invented", () => {
  it("maps labelled openings onto the extraction", () => {
    const res = sheetToExtraction(
      input({
        scope: "framing",
        roledDimensions: [dim("length", 8.4), dim("height", 2.4)],
        openings: [
          { kind: "door", width_m: 0.81, height_m: 1.98, count: 1 },
          { kind: "window", width_m: 1.2, height_m: 1.0, count: 2 },
        ],
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.extraction.openings).toEqual([
      { kind: "door", width_m: 0.81, height_m: 1.98, count: 1 },
      { kind: "window", width_m: 1.2, height_m: 1.0, count: 2 },
    ]);
  });

  it("an opening with unknown size passes nulls through — sizes are NOT guessed", () => {
    const res = sheetToExtraction(
      input({
        scope: "framing",
        roledDimensions: [dim("length", 8.4), dim("height", 2.4)],
        openings: [{ kind: "door", width_m: null, height_m: null, count: 1 }],
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.extraction.openings[0].width_m).toBeNull();
    expect(res.extraction.openings[0].height_m).toBeNull();
  });
});

// ── Case 4: unsupported / under-labelled → blocked, not guessed ─────────────
describe("sheetToExtraction — unsupported scope is blocked, never guessed", () => {
  it("an out-of-scope scope (e.g. roofing) → blocked unsupported_scope", () => {
    const res = sheetToExtraction(input({ scope: "roofing" }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.blocked.reasons[0].code).toBe("unsupported_scope");
  });

  it("only the three target scopes are supported", () => {
    expect(SUPPORTED_BRIDGE_SCOPES.sort()).toEqual(["framing", "insulation", "lining"]);
  });

  it("building_length/width + height do NOT satisfy framing (overall dims ≠ wall run)", () => {
    // Decision #2: `length` means total wall run; overall building dims are a
    // distinct role and must never be silently used as the wall run.
    const res = sheetToExtraction(
      input({
        scope: "framing",
        roledDimensions: [dim("building_length", 8.4), dim("building_width", 6.0), dim("height", 2.4)],
      }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.blocked.reasons.map((r) => r.field)).toContain("length");
  });
});

// ── No-guess invariants: conflicts block, junk values ignored, no defaults ──
describe("sheetToExtraction — no-guess invariants", () => {
  it("conflicting duplicate role values → blocked (never silently picks one)", () => {
    const res = sheetToExtraction(
      input({
        scope: "framing",
        roledDimensions: [dim("length", 8.4), dim("length", 9.0), dim("height", 2.4)],
      }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.blocked.reasons[0].code).toBe("conflicting_dimension");
  });

  it("identical duplicate role values are fine (not a conflict)", () => {
    const res = sheetToExtraction(
      input({
        scope: "framing",
        roledDimensions: [dim("length", 8.4), dim("length", 8.4), dim("height", 2.4)],
      }),
    );
    expect(res.ok).toBe(true);
  });

  it("zero / negative / non-finite values are ignored, not coerced — so they block", () => {
    const res = sheetToExtraction(
      input({ scope: "framing", roledDimensions: [dim("length", 8.4), dim("height", 0)] }),
    );
    expect(res.ok).toBe(false); // height 0 ignored → missing → blocked
  });

  it("does not mutate the input", () => {
    const i = input({ scope: "framing", roledDimensions: [dim("length", 8.4), dim("height", 2.4)] });
    const snap = JSON.stringify(i);
    sheetToExtraction(i);
    expect(JSON.stringify(i)).toBe(snap);
  });
});
