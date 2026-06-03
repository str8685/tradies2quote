import { describe, expect, it } from "vitest";
import {
  buildWeeklyDigest,
  correctionsToEvalSuggestions,
  type WeeklyDigestData,
} from "../weekly";

const BASE: WeeklyDigestData = {
  windowDays: 7,
  memoriesTotal: 42,
  memoriesNewThisWeek: 5,
  topCorrections: [
    { field: "unit_price", description: "H3.2 90x45", from: "5.50", to: "6.80" },
    { field: "description", description: "GIB Aqualine", from: "Gib board", to: "GIB Aqualine 13mm" },
  ],
  topPrices: [{ material: "Pink Batts R2.6", price: 18.5, unit: "each" }],
  agentStats: [
    { name: "Quote Generation", total: 10, failed: 1 },
    { name: "Materials Takeoff", total: 4, failed: 0 },
  ],
};

describe("correctionsToEvalSuggestions", () => {
  it("turns price + rename corrections into eval seeds", () => {
    const seeds = correctionsToEvalSuggestions(BASE.topCorrections);
    expect(seeds[0]).toMatch(/H3\.2 90x45.*6\.80.*5\.50/);
    expect(seeds[1]).toMatch(/Rename.*Gib board.*GIB Aqualine 13mm/);
  });
});

describe("buildWeeklyDigest", () => {
  it("summarises learning + agent success in the subject", () => {
    const d = buildWeeklyDigest(BASE);
    // 14 runs, 1 failed → 93%.
    expect(d.subject).toMatch(/5 new things learned/);
    expect(d.subject).toMatch(/93% agent success/);
  });

  it("includes corrections, prices, agent health, and eval seeds in the body", () => {
    const { text } = buildWeeklyDigest(BASE);
    expect(text).toContain("H3.2 90x45");
    expect(text).toContain("Pink Batts R2.6");
    expect(text).toContain("Quote Generation: 9/10 ok");
    expect(text).toMatch(/1 failed/);
    expect(text).toContain("WORTH ADDING TO THE EVAL SET");
    expect(text).toContain("Nothing for you to do");
  });

  it("handles an idle week with no learning gracefully", () => {
    const d = buildWeeklyDigest({
      windowDays: 7,
      memoriesTotal: 0,
      memoriesNewThisWeek: 0,
      topCorrections: [],
      topPrices: [],
      agentStats: [],
    });
    expect(d.subject).toMatch(/flywheel idle/);
    expect(d.text).toContain("Nothing for you to do");
  });

  it("escapes HTML in user-derived strings", () => {
    const d = buildWeeklyDigest({
      ...BASE,
      topPrices: [{ material: "<script>x</script>", price: 1, unit: null }],
    });
    expect(d.html).not.toContain("<script>x");
    expect(d.html).toContain("&lt;script&gt;");
  });
});
