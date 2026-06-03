import { describe, expect, it } from "vitest";
import { correctionsToEvalCases } from "../evalSeeds";
import type { CorrectionItem } from "../weekly";

const C = (over: Partial<CorrectionItem>): CorrectionItem => ({
  field: "unit_price",
  description: "H3.2 90x45",
  from: "5.50",
  to: "6.80",
  ...over,
});

describe("correctionsToEvalCases", () => {
  it("turns a price correction into a runnable case", () => {
    const [c] = correctionsToEvalCases([C({})]);
    expect(c.material).toBe("H3.2 90x45");
    expect(c.expected).toBe(6.8);
    expect(c.was).toBe(5.5);
    expect(c.id).toBe("h3-2-90x45");
    expect(c.transcript.toLowerCase()).toContain("h3.2 90x45");
  });

  it("skips description (rename) corrections — not a price assertion", () => {
    expect(
      correctionsToEvalCases([C({ field: "description", to: "GIB Aqualine" })]),
    ).toHaveLength(0);
  });

  it("skips non-numeric, zero, or negative targets", () => {
    expect(correctionsToEvalCases([C({ to: "oops" })])).toHaveLength(0);
    expect(correctionsToEvalCases([C({ to: "0" })])).toHaveLength(0);
    expect(correctionsToEvalCases([C({ to: "-3" })])).toHaveLength(0);
  });

  it("skips blank materials and de-dupes by material", () => {
    expect(correctionsToEvalCases([C({ description: "   " })])).toHaveLength(0);
    const dupes = correctionsToEvalCases([
      C({ to: "6.80" }),
      C({ to: "7.10" }), // same material → de-duped (first wins)
    ]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].expected).toBe(6.8);
  });

  it("leaves `was` null when the original price wasn't numeric", () => {
    expect(correctionsToEvalCases([C({ from: "n/a" })])[0].was).toBeNull();
  });
});
