import { describe, expect, it } from "vitest";
import { parsePhotoPlan } from "../photo-plan";

describe("parsePhotoPlan (tool-input normalisation)", () => {
  it("normalises items: trims label, clamps confidence, defaults ai_estimated", () => {
    const res = parsePhotoPlan({
      description: "A stud wall with old GIB.",
      items: [
        { label: "  GIB sheet  ", location: "back wall", note: "water-stained", confidence: 1.7, ai_estimated: false },
        { confidence: -2 }, // missing label → placeholder; ai_estimated → true; confidence clamps to 0
      ],
      reviewFlags: ["No scale visible", 5],
      quoteNote: "Strip and reline the back wall.",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const v = res.value;
    expect(v.items[0].label).toBe("GIB sheet");
    expect(v.items[0].confidence).toBe(1); // clamped
    expect(v.items[0].ai_estimated).toBe(false);
    expect(v.items[1].label).toBe("(unlabelled item)");
    expect(v.items[1].confidence).toBe(0); // clamped
    expect(v.items[1].ai_estimated).toBe(true);
    expect(v.reviewFlags).toEqual(["No scale visible"]); // non-strings dropped
  });

  it("backfills placeholders for an empty description / quoteNote", () => {
    const res = parsePhotoPlan({ items: [] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.description).toMatch(/no description/i);
    expect(res.value.quoteNote).toMatch(/no quote note/i);
    expect(res.value.items).toEqual([]);
  });

  it("defaults confidence to 0.5 when missing", () => {
    const res = parsePhotoPlan({ items: [{ label: "Timber" }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.items[0].confidence).toBe(0.5);
  });
});
