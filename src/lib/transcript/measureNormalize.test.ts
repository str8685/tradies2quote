// ─────────────────────────────────────────────────────────────────────────
// Spoken-measurement normalization — unit pack (deterministic).
//
// The safety contract: digits only ever APPEAR where the tradie spoke a
// number in a measurement context; existing digits are never altered;
// prose numbers, money slang and marker lines are untouched; every change
// is audited; the pass is idempotent.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import {
  normalizeSpokenMeasurements,
  parseNumberRun,
} from "./measureNormalize";

const norm = (s: string) => normalizeSpokenMeasurements(s).text;

describe("parseNumberRun", () => {
  it("parses ones, teens, tens, compounds, hundreds, decimals", () => {
    expect(parseNumberRun("ten")).toBe("10");
    expect(parseNumberRun("forty five")).toBe("45");
    expect(parseNumberRun("forty-five")).toBe("45");
    expect(parseNumberRun("ninety")).toBe("90");
    expect(parseNumberRun("six hundred")).toBe("600");
    expect(parseNumberRun("six hundred and fifty")).toBe("650");
    expect(parseNumberRun("two point four")).toBe("2.4");
    expect(parseNumberRun("three point six five")).toBe("3.65");
    expect(parseNumberRun("one thousand two hundred")).toBe("1200");
  });
  it("rejects garbage and ambiguity", () => {
    expect(parseNumberRun("hundred")).toBeNull(); // bare "hundred"
    expect(parseNumberRun("point five")).toBeNull(); // no integer part
    expect(parseNumberRun("and")).toBeNull();
  });
});

describe("normalizeSpokenMeasurements — converts in measurement contexts", () => {
  it("number + unit", () => {
    expect(norm("a wall ten metres long")).toBe("a wall 10 metres long");
    expect(norm("two point four metres high")).toBe("2.4 metres high");
    expect(norm("six hundred mil centres")).toBe("600mm centres");
    expect(norm("ceiling at two point seven high")).toBe("ceiling at 2.7 high");
  });

  it("dimension pairs via 'by'", () => {
    expect(norm("ninety by forty five framing")).toBe("90x45 framing");
    expect(norm("a deck six by four metres")).toBe("a deck 6x4 metres");
    expect(norm("140 by 45 bearers")).toBe("140x45 bearers");
  });

  it("integer mil → mm; decimal mil (money slang) untouched", () => {
    expect(norm("pack it out ninety mil")).toBe("pack it out 90mm");
    expect(norm("600 mil centres")).toBe("600mm centres");
    expect(norm("the budget is 1.5 mil")).toBe("the budget is 1.5 mil");
  });

  it("reports every change as an audited correction", () => {
    const r = normalizeSpokenMeasurements("ninety by forty five at six hundred mil centres");
    expect(r.text).toBe("90x45 at 600mm centres");
    expect(r.corrections.length).toBeGreaterThanOrEqual(3);
    expect(r.corrections[0]).toMatchObject({ before: expect.any(String), after: expect.any(String) });
  });
});

describe("normalizeSpokenMeasurements — never over-converts", () => {
  it("prose numbers stay words (no unit, no 'by')", () => {
    expect(norm("I told the two owners about the job")).toBe(
      "I told the two owners about the job",
    );
    expect(norm("one of the walls needs gib")).toBe("one of the walls needs gib");
    expect(norm("we need ten more screws")).toBe("we need ten more screws");
  });

  it("existing digits are never altered", () => {
    const s = "wall 10m x 2.4m, 90x45 H3.2 at 600 centres, 12 Example St";
    expect(norm(s)).toBe(s);
  });

  it("addresses and names pass through untouched", () => {
    const s = "job at 12 Example Street, Gate Pa, Tauranga for Sam Smith";
    expect(norm(s)).toBe(s);
  });

  it("[T2Q_…] marker lines are byte-identical", () => {
    const s = "[T2Q_PLAN] type=wall wall_run_m=40 height_m=2.4\nframe ten metres of wall";
    const out = norm(s);
    expect(out.split("\n")[0]).toBe("[T2Q_PLAN] type=wall wall_run_m=40 height_m=2.4");
    expect(out.split("\n")[1]).toBe("frame 10 metres of wall");
  });

  it("large 'by' pairs (not building dimensions) untouched", () => {
    expect(norm("2026 by 2030 the suburb doubles")).toBe("2026 by 2030 the suburb doubles");
  });

  it("idempotent — second run changes nothing", () => {
    const once = normalizeSpokenMeasurements("ninety by forty five at six hundred mil centres");
    const twice = normalizeSpokenMeasurements(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.corrections).toEqual([]);
  });

  it("digit-preservation invariant: every digit run in the input survives", () => {
    const input = "the 2 walls are 10m and 2.4m with 90x45 at 600 centres";
    const out = norm(input);
    for (const run of input.match(/\d+(?:\.\d+)?/g) ?? []) {
      expect(out).toContain(run);
    }
  });
});
