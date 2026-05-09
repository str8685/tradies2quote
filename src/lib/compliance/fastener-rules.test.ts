import { describe, it, expect } from "vitest";
import type { QuoteLineItem } from "../quote-types";
import {
  detectFastenerFinish,
  lineItemIsFastener,
  reviewFastenerItem,
} from "./fastener-rules";
import type { JobContext } from "./types";

const fastener = (description: string): QuoteLineItem => ({
  type: "material",
  description,
  quantity: 1,
  unit: "pack",
  unit_price: 0,
  line_total: 0,
});

const internalDry: JobContext = {
  description: "build a 6m x 2.7m internal wall, 90x45 framing",
  wall: {
    type: "internal",
    isWetArea: false,
    acousticOrFireRequired: false,
    isThermalEnvelope: false,
  },
};

const treatedExternal: JobContext = {
  description: "H3.2 framing pine for external wall, 90x45",
  wall: { type: "external", cladding: "weatherboard" },
};

const treatedInternal: JobContext = {
  description: "H3.2 framing pine 90x45",
  wall: {
    type: "internal",
    isWetArea: false,
    acousticOrFireRequired: false,
    isThermalEnvelope: false,
  },
};

const unknownWall: JobContext = {
  description: "build a wall",
};

describe("detectFastenerFinish — keyword detection", () => {
  it("'bright nails' → bright", () => {
    expect(detectFastenerFinish("bright nails 90x3.15")).toBe("bright");
  });

  it("'galvanised joist hanger' → galvanised", () => {
    expect(detectFastenerFinish("galvanised joist hanger")).toBe("galvanised");
  });

  it("'stainless decking screws' → stainless", () => {
    expect(detectFastenerFinish("stainless decking screws")).toBe("stainless");
  });

  it("'framing nails 75mm' (no finish) → unspecified", () => {
    expect(detectFastenerFinish("framing nails 75mm")).toBe("unspecified");
  });
});

describe("lineItemIsFastener", () => {
  it("'galvanised joist hanger' → fastener", () => {
    expect(lineItemIsFastener(fastener("galvanised joist hanger"))).toBe(true);
  });

  it("'90x45 framing pine' → not a fastener", () => {
    const it: QuoteLineItem = {
      ...fastener("90x45 framing pine"),
    };
    expect(lineItemIsFastener(it)).toBe(false);
  });
});

describe("reviewFastenerItem — bright nails", () => {
  it("bright nails for confirmed dry internal framing → 'rule', no warnings (test 7)", () => {
    const r = reviewFastenerItem(fastener("bright nails 90x3.15"), internalDry);
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.meta.confidence).toBe("high");
    expect(r.warnings).toEqual([]);
  });

  it("bright nails for treated timber (treatedInternal) → blocker (test 8 partial)", () => {
    const r = reviewFastenerItem(fastener("bright nails 90x3.15"), treatedInternal);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].severity).toBe("blocker");
    expect(r.meta.required_confirmations?.[0]).toMatch(/galvanised|stainless/i);
  });

  it("bright nails for external wall → blocker", () => {
    const r = reviewFastenerItem(
      fastener("bright nails"),
      { description: "external wall", wall: { type: "external" } },
    );
    expect(r.warnings[0].severity).toBe("blocker");
  });

  it("bright nails with unknown wall → warning (not blocker), missing_context", () => {
    const r = reviewFastenerItem(fastener("bright nails"), unknownWall);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.warnings[0].severity).toBe("warning");
  });
});

describe("reviewFastenerItem — galv / stainless", () => {
  it("galvanised joist hanger → 'rule', no warnings (test 8 partial)", () => {
    const r = reviewFastenerItem(
      fastener("galvanised joist hanger"),
      treatedExternal,
    );
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.warnings).toEqual([]);
  });

  it("stainless decking screws → 'rule', no warnings", () => {
    const r = reviewFastenerItem(
      fastener("stainless decking screws"),
      treatedExternal,
    );
    expect(r.meta.compliance_source_type).toBe("rule");
    expect(r.warnings).toEqual([]);
  });
});

describe("reviewFastenerItem — unspecified finish", () => {
  it("'framing nails 75mm' → missing_context with warning to specify finish", () => {
    const r = reviewFastenerItem(fastener("framing nails 75mm"), internalDry);
    expect(r.meta.compliance_source_type).toBe("missing_context");
    expect(r.warnings).toHaveLength(1);
    expect(r.meta.required_confirmations?.[0]).toMatch(/finish/i);
  });
});
