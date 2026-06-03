import { describe, expect, it } from "vitest";
import { parseTakeoff } from "../materials-takeoff";

describe("parseTakeoff (tool-input normalisation)", () => {
  it("normalises lines: trims, clamps unit + category, defaults ai_estimated", () => {
    const res = parseTakeoff({
      understoodAs: "Reline a bathroom",
      lines: [
        {
          description: "  GIB Aqualine 13mm  ",
          quantity: 6,
          unit: "sheet",
          note: "Wet-area board",
          ai_estimated: false,
          category: "linings",
        },
        {
          description: "Framing",
          quantity: null,
          unit: "weird-unit", // → "each"
          category: "not-a-category", // → "other"
          // ai_estimated omitted → defaults true
        },
      ],
      assumptions: ["90x45 framing", 7],
      reviewFlags: [{ message: "Confirm non-load-bearing" }, { nope: 1 }],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const t = res.value;
    expect(t.lines[0].description).toBe("GIB Aqualine 13mm");
    expect(t.lines[0].ai_estimated).toBe(false);
    expect(t.lines[1].unit).toBe("each");
    expect(t.lines[1].category).toBe("other");
    expect(t.lines[1].ai_estimated).toBe(true);
    expect(t.assumptions).toEqual(["90x45 framing"]); // non-strings dropped
    expect(t.reviewFlags).toEqual([{ message: "Confirm non-load-bearing" }]);
  });

  it("backfills understoodAs from the job text when missing", () => {
    const res = parseTakeoff(
      { lines: [{ description: "Pile", category: "framing" }] },
      "Build 6 piles for a deck",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.understoodAs).toBe("Build 6 piles for a deck");
  });

  it("drops empty-description lines", () => {
    const res = parseTakeoff({
      lines: [
        { description: "  ", category: "other" },
        { description: "Real", category: "framing" },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.lines).toHaveLength(1);
  });

  it("rejects (triggers retry) when there are no usable lines", () => {
    expect(parseTakeoff({ lines: [] }).ok).toBe(false);
    expect(parseTakeoff({}).ok).toBe(false);
    expect(parseTakeoff({ lines: [{ description: "" }] }).ok).toBe(false);
  });
});
