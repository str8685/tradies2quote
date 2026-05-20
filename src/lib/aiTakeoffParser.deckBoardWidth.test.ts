import { describe, expect, it } from "vitest";
import {
  extractDeckBoardWidthMm,
  parseTakeoffDescription,
} from "./aiTakeoffParser";
import { calculateDeckTakeoff } from "./materialCalculator";

describe("extractDeckBoardWidthMm", () => {
  it("reads a plain decking profile", () => {
    expect(extractDeckBoardWidthMm("8x5.5 deck, 140x32 decking")).toBe(140);
    expect(extractDeckBoardWidthMm("90x19 decking on 450 joists")).toBe(90);
  });

  it("reads the dressed size in parentheses (ITM style)", () => {
    expect(
      extractDeckBoardWidthMm(
        "150x40 RAD H3.2 GT PREMIUM DECKING (140x32)",
      ),
    ).toBe(140);
  });

  it("reads a millimetre phrasing", () => {
    expect(extractDeckBoardWidthMm("140mm decking, kwila")).toBe(140);
    expect(extractDeckBoardWidthMm("decking boards 140mm")).toBe(140);
  });

  it("does NOT grab joist/framing sizes", () => {
    expect(
      extractDeckBoardWidthMm("6x4 deck with 140x45 joists at 450mm"),
    ).toBeUndefined();
    expect(extractDeckBoardWidthMm("100x100 H5 posts")).toBeUndefined();
  });

  it("returns undefined when no decking width is stated", () => {
    expect(extractDeckBoardWidthMm("build me a deck please")).toBeUndefined();
    expect(extractDeckBoardWidthMm("")).toBeUndefined();
  });
});

describe("parseDeckDescription wires board width into the input", () => {
  it("sets boardWidthMm from the description", () => {
    const parsed = parseTakeoffDescription(
      "Build a 8m x 5.5m deck on piles, 140x32 decking, 140x45 joists at 450mm centres",
    );
    expect(parsed.type).toBe("deck");
    const input = parsed.input as { boardWidthMm?: number };
    expect(input.boardWidthMm).toBe(140);
  });
});

describe("calculateDeckTakeoff respects board width", () => {
  it("wide boards produce fewer decking lineal metres than narrow", () => {
    const wide = calculateDeckTakeoff({
      deckLengthM: 8,
      deckWidthM: 5.5,
      boardWidthMm: 140,
    });
    const narrow = calculateDeckTakeoff({
      deckLengthM: 8,
      deckWidthM: 5.5,
      boardWidthMm: 90,
    });
    const lm = (r: typeof wide) =>
      r.materials.find((m) => m.id === "decking-boards")!.quantity;

    expect(lm(wide)).toBeLessThan(lm(narrow));
    // 140mm boards on a 5.5m-wide deck ≈ 334 LM — in the ballpark of the
    // real ITM deck quote (330 LM), vs ~510 LM if mis-costed as 90mm.
    expect(lm(wide)).toBeGreaterThan(300);
    expect(lm(wide)).toBeLessThan(360);
    expect(lm(narrow)).toBeGreaterThan(480);
  });

  it("names the decking line with the real board width", () => {
    const r = calculateDeckTakeoff({
      deckLengthM: 6,
      deckWidthM: 4,
      boardWidthMm: 140,
    });
    const board = r.materials.find((m) => m.id === "decking-boards")!;
    expect(board.name).toContain("140mm");
  });
});
