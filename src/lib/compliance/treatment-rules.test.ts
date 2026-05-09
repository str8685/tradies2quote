import { describe, it, expect } from "vitest";
import type { QuoteLineItem } from "../quote-types";
import {
  extractTreatmentClass,
  reviewTimberItem,
  runTreatmentRules,
  sameTreatmentClass,
} from "./treatment-rules";
import type { JobContext } from "./types";

const externalContext: JobContext = {
  description: "build a 6m x 2.7m external wall",
  wall: { type: "external", isThermalEnvelope: true },
};

const internalContext: JobContext = {
  description: "build a 6m x 2.7m internal wall",
  wall: { type: "internal" },
};

const unknownContext: JobContext = {
  description: "build a 6m x 2.7m wall",
};

const timberItem = (description: string): QuoteLineItem => ({
  type: "material",
  description,
  quantity: 10,
  unit: "m",
  unit_price: 0,
  line_total: 0,
});

describe("extractTreatmentClass — preserves H-classes verbatim", () => {
  it("H1.2 framing → H1.2", () => {
    expect(extractTreatmentClass("H1.2 framing pine 90x45")).toBe("H1.2");
  });

  it("H3.2 deck joist → H3.2", () => {
    expect(extractTreatmentClass("H3.2 240x45 deck joist 5.4m")).toBe("H3.2");
  });

  it("H4 post → H4", () => {
    expect(extractTreatmentClass("H4 post 100x100 2.4m")).toBe("H4");
  });

  it("H5 pile → H5", () => {
    expect(extractTreatmentClass("H5 pile 200x200 3m")).toBe("H5");
  });

  it("returns null when the description names no class", () => {
    expect(extractTreatmentClass("framing pine 90x45")).toBeNull();
  });
});

describe("sameTreatmentClass — non-collapse invariant", () => {
  it("H1.2 vs H3.2 → false (different classes)", () => {
    expect(sameTreatmentClass("H1.2", "H3.2")).toBe(false);
  });

  it("H3.2 vs H3 → false (decimal precision matters)", () => {
    expect(sameTreatmentClass("H3.2", "H3")).toBe(false);
  });

  it("H3.2 vs H4 → false", () => {
    expect(sameTreatmentClass("H3.2", "H4")).toBe(false);
  });

  it("H3.2 vs H5 → false", () => {
    expect(sameTreatmentClass("H3.2", "H5")).toBe(false);
  });

  it("H4 vs H5 → false", () => {
    expect(sameTreatmentClass("H4", "H5")).toBe(false);
  });

  it("H4 vs H4 → true (same class)", () => {
    expect(sameTreatmentClass("H4", "H4")).toBe(true);
  });

  it("null inputs → false (can't compare unknown classes)", () => {
    expect(sameTreatmentClass(null, "H4")).toBe(false);
    expect(sameTreatmentClass("H4", null)).toBe(false);
    expect(sameTreatmentClass(null, null)).toBe(false);
  });
});

describe("reviewTimberItem — class explicitly in description", () => {
  it("H1.2 framing → flagged 'rule', high confidence, with notes about non-interchange", () => {
    const r = reviewTimberItem(timberItem("H1.2 framing pine 90x45"), internalContext);
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.meta.confidence).toBe("high");
    expect(r.meta.reason).toContain("H1.2");
    expect(r.meta.compliance_notes?.[0]).toMatch(/NOT interchangeable/i);
  });

  it("H4 post stays H4 — never collapsed (test 5)", () => {
    const r = reviewTimberItem(
      timberItem("H4 post 100x100 2.4m"),
      { description: "H4 post job" },
    );
    expect(r.meta.reason).toContain("H4");
    expect(r.meta.reason).not.toContain("H3");
    expect(r.meta.reason).not.toContain("H5");
    expect(r.meta.compliance_source_type).toBe("rule");
  });

  it("H5 pile stays H5 — never collapsed (test 6)", () => {
    const r = reviewTimberItem(
      timberItem("H5 pile 200x200 3m"),
      { description: "H5 pile job" },
    );
    expect(r.meta.reason).toContain("H5");
    expect(r.meta.reason).not.toContain("H4");
    expect(r.meta.compliance_source_type).toBe("rule");
  });
});

describe("reviewTimberItem — class missing from description", () => {
  it("external wall + no class → missing_context, requires confirmation, warning emitted (test 4 partial)", () => {
    const r = reviewTimberItem(timberItem("framing pine 90x45"), externalContext);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.meta.required_confirmations?.[0]).toMatch(/H3\.1 or H3\.2/);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].severity).toBe("warning");
  });

  it("internal wall + no class → 'rule' with H1.2 standard selection note", () => {
    const r = reviewTimberItem(timberItem("framing pine 90x45"), internalContext);
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.meta.compliance_notes?.[0]).toMatch(/H1\.2/);
  });

  it("unknown wall type + timber → missing_context, info warning", () => {
    const r = reviewTimberItem(timberItem("framing pine 90x45"), unknownContext);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.warnings[0].severity).toBe("info");
  });
});

describe("runTreatmentRules — orchestrates per-item review", () => {
  it("attaches updates per item index + emits warnings with line_item_index", () => {
    const items: QuoteLineItem[] = [
      timberItem("H3.2 deck joist 240x45 5.4m"),
      timberItem("framing pine 90x45"),
    ];
    const out = runTreatmentRules(items, externalContext);
    expect(out.ruleName).toBe("treatment-rules");
    expect(Object.keys(out.itemUpdates).sort()).toEqual(["0", "1"]);
    expect(out.warnings.every((w) => typeof w.line_item_index === "number")).toBe(true);
  });

  it("does not emit clarifications (those come from clarification engine)", () => {
    const out = runTreatmentRules([timberItem("H4 post")], unknownContext);
    expect(out.clarifications).toEqual([]);
  });
});
