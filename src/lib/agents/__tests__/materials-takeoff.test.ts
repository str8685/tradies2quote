import { describe, it, expect } from "vitest";
import { normaliseUnit } from "../materials-takeoff";

describe("normaliseUnit", () => {
  it("maps common aliases to the canonical unit", () => {
    expect(normaliseUnit("ea")).toBe("each");
    expect(normaliseUnit("each")).toBe("each");
    expect(normaliseUnit("pcs")).toBe("each");
    expect(normaliseUnit("metre")).toBe("lm");
    expect(normaliseUnit("linear metre")).toBe("lm");
    expect(normaliseUnit("sqm")).toBe("m2");
    expect(normaliseUnit("M^2")).toBe("m2");
    expect(normaliseUnit("m^3")).toBe("m3");
    expect(normaliseUnit("Kg")).toBe("kg");
    expect(normaliseUnit("Bag")).toBe("bag");
    expect(normaliseUnit("Sheet")).toBe("sheet");
    expect(normaliseUnit("panel")).toBe("sheet");
    expect(normaliseUnit("roll")).toBe("roll");
    expect(normaliseUnit("L")).toBe("litre");
    expect(normaliseUnit("Litre")).toBe("litre");
    expect(normaliseUnit("hr")).toBe("hr");
    expect(normaliseUnit("hour")).toBe("hr");
    expect(normaliseUnit("day")).toBe("day");
  });

  it("falls back to 'each' for unknown inputs", () => {
    expect(normaliseUnit("")).toBe("each");
    expect(normaliseUnit("widget")).toBe("each");
    expect(normaliseUnit("???")).toBe("each");
  });

  it("is case + whitespace insensitive", () => {
    expect(normaliseUnit("  KG  ")).toBe("kg");
    expect(normaliseUnit("  Roll ")).toBe("roll");
  });
});
