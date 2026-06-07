import { describe, expect, it } from "vitest";
import { detectTakeoffType } from "./aiTakeoffParser";

// Hardening pass: a house / interior-wall scan must NOT fall into the deck
// calculator. The structured [T2Q_PLAN] type marker is authoritative; the
// keyword fallback is hardened so a stray "deck"/"decking" token can't win.
describe("detectTakeoffType — house/wall scans never route to deck", () => {
  it("type-only wall marker (geometry failed to parse) routes to wall, not deck", () => {
    // This is exactly what the scan now emits when result.plan is null.
    const transcript = [
      "[T2Q_PLAN] type=wall",
      "[T2Q_TIMBER] stock_length_m=6",
      "Job type: Framing.",
      "Tradie buys timber in 6m lengths. Calculate board / stud / plate counts in whole 6m lengths with a 10% waste factor.",
      "What is being built: interior wall framing for a house.",
    ].join("\n\n");
    expect(detectTakeoffType(transcript)).toBe("wall");
  });

  it("wall marker beats any deck wording in the prose", () => {
    const transcript = "[T2Q_PLAN] type=wall length_m=6\nlay some decking nearby maybe";
    expect(detectTakeoffType(transcript)).toBe("wall");
  });

  it("marker-less prose: GIB/plasterboard routes to wall even if 'deck' appears", () => {
    expect(detectTakeoffType("line the walls in GIB, deck off to one side")).toBe("wall");
    expect(detectTakeoffType("plasterboard both sides of the framing")).toBe("wall");
  });

  it("a genuine deck marker still routes to deck", () => {
    expect(detectTakeoffType("[T2Q_PLAN] type=deck length_m=6 width_m=4")).toBe("deck");
  });

  it("marker-less plain deck prose still routes to deck (no regression)", () => {
    expect(detectTakeoffType("build a 6x4 deck with joists at 450 centres")).toBe("deck");
  });
});
