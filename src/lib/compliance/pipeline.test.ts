import { describe, it, expect } from "vitest";
import type { QuoteLineItem } from "../quote-types";
import { reviewQuote } from "./pipeline";
import { safelyReviewQuote } from "./safe-wrapper";
import type { JobContext } from "./types";

const pinkBatts = (): QuoteLineItem => ({
  type: "material",
  description: "Pink Batts R2.6 ceiling",
  quantity: 12,
  unit: "pack",
  unit_price: 89,
  line_total: 1068,
});

const framingTimber = (description: string): QuoteLineItem => ({
  type: "material",
  description,
  quantity: 10,
  unit: "m",
  unit_price: 11.2,
  line_total: 112,
});

const brightNails = (): QuoteLineItem => ({
  type: "material",
  description: "bright nails 90x3.15",
  quantity: 1,
  unit: "pack",
  unit_price: 25,
  line_total: 25,
});

describe("reviewQuote — internal wall (test 1)", () => {
  it("internal wall + Pink Batts → flagged with warning, NOT auto-added", () => {
    const items: QuoteLineItem[] = [
      framingTimber("H1.2 framing pine 90x45"),
      pinkBatts(),
    ];
    const ctx: JobContext = {
      description: "build a 6m x 2.7m internal wall",
      wall: {
        type: "internal",
        isLoadbearing: false,
        isBracing: false,
        isWetArea: false,
        isThermalEnvelope: false,
        lining: "gib_standard",
        studSpacingMm: 600,
        acousticOrFireRequired: false,
      },
    };
    const review = reviewQuote(items, ctx);

    expect(review.status).toBe("warnings_only");
    const insulationItem = review.items[1];
    expect(insulationItem.compliance_source_type).toBe("missing_context");
    expect(insulationItem.required_confirmations?.[0]).toMatch(/acoustic|fire|thermal/i);

    // Warning is attached to the insulation line specifically. The
    // rule's title is generic ("Insulation in an internal wall — not
    // required by default") because the rule applies to any insulation
    // product, not just Pink Batts. The product name surfaces in the
    // message, not the title.
    const insulationWarning = review.warnings.find(
      (w) =>
        w.line_item_index === 1 &&
        /insulation.*not required.*default/i.test(w.title),
    );
    expect(insulationWarning).toBeDefined();
  });
});

describe("reviewQuote — external wall (test 2)", () => {
  it("'build a 6m x 2.7m external wall' (no thermal envelope answer) → asks H1/thermal-envelope question", () => {
    const items: QuoteLineItem[] = [framingTimber("framing pine 90x45")];
    const ctx: JobContext = {
      description: "build a 6m x 2.7m external wall",
      wall: { type: "external" },
    };
    const review = reviewQuote(items, ctx);

    expect(review.status).toBe("needs_clarification");
    const thermalQ = review.clarifications.find(
      (c) => c.id === "wall.isThermalEnvelope",
    );
    expect(thermalQ).toBeDefined();
    expect(thermalQ?.why).toMatch(/H1|thermal envelope/i);
  });
});

describe("reviewQuote — bare wall context (test 10)", () => {
  it("missing wall.type → status=needs_clarification + wall.type question included", () => {
    const items: QuoteLineItem[] = [framingTimber("framing pine 90x45")];
    const ctx: JobContext = { description: "build a 6m x 2.7m wall" };
    const review = reviewQuote(items, ctx);

    expect(review.status).toBe("needs_clarification");
    expect(
      review.clarifications.some((c) => c.id === "wall.type"),
    ).toBe(true);
  });
});

describe("reviewQuote — fully-confirmed quote → 'ok'", () => {
  it("internal dry partition + bright nails + H1.2 framing (no insulation) → status=ok", () => {
    const items: QuoteLineItem[] = [
      framingTimber("H1.2 framing pine 90x45"),
      brightNails(),
    ];
    const ctx: JobContext = {
      description: "build a 6m x 2.7m internal partition with H1.2 framing",
      wall: {
        type: "internal",
        isLoadbearing: false,
        isBracing: false,
        isWetArea: false,
        isThermalEnvelope: false,
        lining: "gib_standard",
        studSpacingMm: 600,
        acousticOrFireRequired: false,
      },
    };
    const review = reviewQuote(items, ctx);
    expect(review.status).toBe("ok");
    expect(review.warnings).toEqual([]);
    // First line picks up high-confidence rule meta from treatment-rules.
    expect(review.items[0].compliance_source_type).toBe("rule");
    // Bright nails OK in confirmed dry internal context.
    expect(review.items[1].compliance_source_type).toBe("rule");
  });
});

describe("reviewQuote — citations roll up", () => {
  it("collects per-item citations and dedupes them at the top level", () => {
    const items: QuoteLineItem[] = [
      framingTimber("H3.2 deck joist 240x45"),
      framingTimber("H3.2 deck board 90x32"),
    ];
    const ctx: JobContext = {
      description: "H3.2 decking",
      wall: { type: "external" },
    };
    const review = reviewQuote(items, ctx);
    const sourceIds = review.citations.map((c) => c.source_id);
    expect(sourceIds).toContain("nzs-3640");
    expect(sourceIds).toContain("nzs-3602");
    // Each (source_id, reason) appears at most once.
    const keys = review.citations.map((c) => `${c.source_id}:${c.reason}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("reviewQuote — diagnostics record rules that ran", () => {
  it("records all rule names, including the clarification engine", () => {
    const review = reviewQuote([], { description: "wall job" });
    expect(review.diagnostics.rulesRun).toEqual([
      "treatment-rules",
      "insulation-rules",
      "fastener-rules",
      "clarification-rules",
    ]);
  });
});

describe("safelyReviewQuote — failsafe behaviour", () => {
  const items: QuoteLineItem[] = [pinkBatts()];
  const ctx: JobContext = { description: "build a wall" };

  it("disabled flag → passthrough with status='disabled'", async () => {
    const out = await safelyReviewQuote(items, ctx, { enabled: false });
    expect(out.status).toBe("disabled");
    expect(out.items).toHaveLength(1);
    expect(out.diagnostics.fallback).toBe("disabled");
  });

  it("enabled + pipeline throws → fallback with status='error', items unchanged", async () => {
    const out = await safelyReviewQuote(items, ctx, {
      enabled: true,
      pipelineFn: () => {
        throw new Error("simulated rules engine failure");
      },
    });
    expect(out.status).toBe("error");
    expect(out.items).toHaveLength(1);
    expect(out.items[0].description).toBe("Pink Batts R2.6 ceiling");
    expect(out.diagnostics.fallback).toBe("error");
    expect(out.diagnostics.fallbackReason).toMatch(/simulated/i);
  });

  it("enabled + pipeline succeeds → returns the review verbatim", async () => {
    const out = await safelyReviewQuote(items, ctx, {
      enabled: true,
    });
    expect(out.status).toBe("needs_clarification");
    expect(out.diagnostics.fallback).toBeUndefined();
  });
});
