import { describe, it, expect } from "vitest";
import type { QuoteLineItem } from "../quote-types";
import {
  lineItemIsInsulation,
  reviewInsulationItem,
  runInsulationRules,
} from "./insulation-rules";
import type { JobContext } from "./types";

const pinkBatts = (): QuoteLineItem => ({
  type: "material",
  description: "Pink Batts R2.6 ceiling",
  quantity: 12,
  unit: "pack",
  unit_price: 0,
  line_total: 0,
});

const battenTimber = (): QuoteLineItem => ({
  type: "material",
  description: "H3.2 50x50 batten",
  quantity: 10,
  unit: "m",
  unit_price: 0,
  line_total: 0,
});

const internalDryWall: JobContext = {
  description: "build a 6m x 2.7m internal wall",
  wall: {
    type: "internal",
    isWetArea: false,
    acousticOrFireRequired: false,
    isThermalEnvelope: false,
  },
};

const externalEnvelope: JobContext = {
  description: "build a 6m x 2.7m external wall, weatherboards over 90x45",
  wall: {
    type: "external",
    isThermalEnvelope: true,
    cladding: "weatherboard",
  },
};

const unknownWall: JobContext = {
  description: "build a 6m x 2.7m wall",
};

describe("lineItemIsInsulation — battens vs Pink Batts (test 9)", () => {
  it("Pink Batts product → insulation", () => {
    expect(lineItemIsInsulation(pinkBatts())).toBe(true);
  });

  it("'H3.2 50x50 batten' → NOT insulation (it's timber)", () => {
    expect(lineItemIsInsulation(battenTimber())).toBe(false);
  });

  it("non-material lines are never classed as insulation", () => {
    const labour: QuoteLineItem = {
      type: "labour",
      description: "Labour — install Pink Batts",
      quantity: 1,
      unit: "hour",
      unit_price: 0,
      line_total: 0,
    };
    expect(lineItemIsInsulation(labour)).toBe(false);
  });
});

describe("reviewInsulationItem — internal vs external wall", () => {
  it("internal dry partition + Pink Batts → missing_context with explicit warning (test 1)", () => {
    const r = reviewInsulationItem(pinkBatts(), internalDryWall);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.meta.reason).toMatch(/Internal dry partition/i);
    expect(r.meta.required_confirmations?.[0]).toMatch(/acoustic|fire|thermal/i);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].title).toMatch(/insulation.*not required.*default/i);
    expect(r.warnings[0].message).toMatch(/Pink Batts/i);
    // Citations include H1.
    expect(r.meta.citations?.some((c) => c.source_id === "nzbc-h1")).toBe(true);
  });

  it("external thermal-envelope wall + Pink Batts → 'rule' / required by H1", () => {
    const r = reviewInsulationItem(pinkBatts(), externalEnvelope);
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.meta.confidence).toBe("high");
    expect(r.meta.reason).toMatch(/H1/);
    expect(r.warnings).toHaveLength(0);
  });

  it("unknown wall + Pink Batts → missing_context, asks for confirmation", () => {
    const r = reviewInsulationItem(pinkBatts(), unknownWall);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.warnings.some((w) => w.severity === "warning")).toBe(true);
  });

  it("non-insulation line items are passed through with no meta", () => {
    const r = reviewInsulationItem(battenTimber(), internalDryWall);
    expect(r.meta).toEqual({});
    expect(r.warnings).toEqual([]);
  });
});

describe("runInsulationRules — orchestrates per-item review", () => {
  it("attaches updates by index + warnings carry line_item_index", () => {
    const items: QuoteLineItem[] = [
      pinkBatts(),
      battenTimber(), // not insulation — no meta
      pinkBatts(),
    ];
    const out = runInsulationRules(items, internalDryWall);
    expect(Object.keys(out.itemUpdates).sort()).toEqual(["0", "2"]);
    expect(out.warnings.every((w) => typeof w.line_item_index === "number")).toBe(true);
  });
});
