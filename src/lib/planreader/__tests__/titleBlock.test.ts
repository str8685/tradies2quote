import { describe, expect, it } from "vitest";
import { parseTitleBlock } from "../titleBlock";

describe("parseTitleBlock", () => {
  it("extracts common labelled fields", () => {
    const tb = parseTitleBlock(
      [
        "PROJECT: Smith Residence",
        "DRAWING TITLE: Ground Floor Plan",
        "SHEET No: A-101",
        "SCALE: 1:100",
        "DATE: 2026-05-01",
        "DRAWN BY: CS",
      ].join("\n"),
    );
    expect(tb.fields.project).toBe("Smith Residence");
    expect(tb.fields.sheet_title).toBe("Ground Floor Plan");
    expect(tb.sheet_label).toBe("A-101");
    expect(tb.scale.mm_per_drawing_unit).toBe(100);
    expect(tb.fields.drawn_by).toBe("CS");
  });

  it("sniffs a sheet id when not explicitly labelled", () => {
    const tb = parseTitleBlock("Foundation layout\nS2.01\nfooting plan");
    expect(tb.sheet_label).toBe("S-2.01");
  });

  it("detects metric units", () => {
    expect(parseTitleBlock("All dimensions in mm").units).toBe("mm");
  });

  it("returns empty structure for blank input", () => {
    const tb = parseTitleBlock("");
    expect(tb.fields).toEqual({});
    expect(tb.sheet_label).toBeNull();
    expect(tb.scale.confidence).toBe(0);
  });

  it("parses scale from a free-form block without a scale label", () => {
    const tb = parseTitleBlock("Deck plan\n1:50\nTreated pine");
    expect(tb.scale.mm_per_drawing_unit).toBe(50);
  });
});
