import { describe, expect, it } from "vitest";
import {
  assessQuoteTakeoffSafety,
  normalizePhone,
  validateQuoteForSending,
  validateQuoteForSmsSending,
} from "./quote-validation";
import type { QuoteData, QuoteLineItem } from "./quote-types";

describe("normalizePhone", () => {
  it("returns empty string for empty input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });

  it("strips whitespace, dashes, parens, dots", () => {
    expect(normalizePhone("+64 22 504 4457")).toBe("+64225044457");
    expect(normalizePhone("(022) 504-4457")).toBe("+64225044457");
    expect(normalizePhone("022.504.4457")).toBe("+64225044457");
  });

  it("converts NZ national format to E.164", () => {
    expect(normalizePhone("0225044457")).toBe("+64225044457");
    expect(normalizePhone("027 555 1234")).toBe("+64275551234");
  });

  it("passes through correctly formatted E.164", () => {
    expect(normalizePhone("+6422504457")).toBe("+6422504457");
    expect(normalizePhone("+447700900123")).toBe("+447700900123");
    expect(normalizePhone("+15125551234")).toBe("+15125551234");
  });

  it("fixes the country-code-plus-leading-zero data-entry bug", () => {
    // The common NZ tradie data-entry mistake: typing +64 AND keeping
    // the leading 0. Twilio rejects this — the leading 0 is a national
    // prefix, not part of the subscriber number. Live bug caught in
    // production on 2026-05-17.
    expect(normalizePhone("+640225044457")).toBe("+64225044457");
    expect(normalizePhone("+64 022 504 4457")).toBe("+64225044457");
    expect(normalizePhone("+64-022-504-4457")).toBe("+64225044457");
  });

  it("leaves non-NZ international numbers untouched", () => {
    // +44 (UK) → 0 after the country code is NOT a leading-zero bug,
    // it's just an unlikely combination. We only special-case +64.
    expect(normalizePhone("+447700900123")).toBe("+447700900123");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Wave 45 — takeoff safety gate.
// ─────────────────────────────────────────────────────────────────────────

const li = (o: Partial<QuoteLineItem> = {}): QuoteLineItem => ({
  type: "material",
  description: "Item",
  quantity: 1,
  unit: "each",
  unit_price: 10,
  line_total: 10,
  ...o,
});

const qd = (o: Partial<QuoteData> = {}): QuoteData => ({
  client: {
    name: "Jane Tradie",
    address: null,
    email: "jane@example.com",
    phone: "+6421234567",
  },
  job_summary: "job",
  line_items: [li()],
  materials_subtotal: 10,
  labour_subtotal: 0,
  markup_pct: 0,
  markup_amount: 0,
  subtotal_before_tax: 10,
  tax_amount: 1.5,
  total: 11.5,
  currency: "NZD",
  tax_label: "GST",
  tax_rate: 15,
  terms: "",
  notes: [],
  ...o,
});

describe("assessQuoteTakeoffSafety", () => {
  it("allows a clean quote (all ok lines, no evaluator)", () => {
    const a = assessQuoteTakeoffSafety(
      qd({ line_items: [li({ takeoff_status: "ok" })] }),
    );
    expect(a.can_send).toBe(true);
    expect(a.requires_acknowledgement).toBe(false);
  });

  it("allows a legacy quote with no takeoff signals at all", () => {
    const a = assessQuoteTakeoffSafety(qd({ line_items: [li()] }));
    expect(a.can_send).toBe(true);
    expect(a.requires_acknowledgement).toBe(false);
  });

  it("hard-blocks when any line is blocked", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ takeoff_status: "ok" }),
          li({ takeoff_status: "blocked", description: "Roof sheets" }),
        ],
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.block_reasons.length).toBeGreaterThan(0);
  });

  it("hard-blocks when the evaluator verdict is fail", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [li({ takeoff_status: "ok" })],
        takeoff_evaluation: {
          status: "fail",
          reasons: ["roof area looks wrong"],
          confidence: 0.2,
        },
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.block_reasons).toContain("roof area looks wrong");
  });

  it("requires acknowledgement for needs_review lines", () => {
    const a = assessQuoteTakeoffSafety(
      qd({ line_items: [li({ takeoff_status: "needs_review" })] }),
    );
    expect(a.can_send).toBe(true);
    expect(a.requires_acknowledgement).toBe(true);
  });

  it("requires acknowledgement for assumed lines", () => {
    const a = assessQuoteTakeoffSafety(
      qd({ line_items: [li({ takeoff_status: "assumed" })] }),
    );
    expect(a.requires_acknowledgement).toBe(true);
  });

  it("requires acknowledgement for an evaluator caution", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [li({ takeoff_status: "ok" })],
        takeoff_evaluation: {
          status: "caution",
          reasons: ["decking lm high"],
          confidence: 0.7,
        },
      }),
    );
    expect(a.requires_acknowledgement).toBe(true);
    expect(a.warning_reasons).toContain("decking lm high");
  });

  it("hard block supersedes a warning (blocked + needs_review)", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ takeoff_status: "needs_review" }),
          li({ takeoff_status: "blocked" }),
        ],
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.requires_acknowledgement).toBe(false);
  });
});

describe("assessQuoteTakeoffSafety — supplier source fidelity (phase 4)", () => {
  it("allows a clean supplier import (lines + subtotal tie out)", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ quantity: 10, unit_price: 20, line_total: 200, source_line_total: 200 }),
        ],
        supplier_source: { supplier: "ITM", subtotal: 200, gst: 30, total: 230 },
      }),
    );
    expect(a.can_send).toBe(true);
  });

  it("HARD-blocks when a sourced line no longer matches the supplier value", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        // price edited 20 → 25, line is now 250 but source is 200
        line_items: [
          li({ quantity: 10, unit_price: 25, line_total: 250, source_line_total: 200 }),
        ],
        supplier_source: { supplier: "ITM", subtotal: 200, gst: 30, total: 230 },
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.requires_acknowledgement).toBe(false); // no override
    expect(a.block_reasons.join(" ")).toMatch(/supplier quote/i);
  });

  it("HARD-blocks when the supplier subtotal doesn't match the imported lines", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ quantity: 10, unit_price: 20, line_total: 200, source_line_total: 200 }),
        ],
        // subtotal claims 350 but only 200 of sourced lines present
        supplier_source: { supplier: "ITM", subtotal: 350, gst: 52.5, total: 402.5 },
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.block_reasons.join(" ")).toMatch(/missing|duplicated|supplier subtotal/i);
  });

  it("does NOT false-block a tradie-added line (no source_line_total)", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ quantity: 10, unit_price: 20, line_total: 200, source_line_total: 200 }),
          li({ type: "labour", description: "Install", quantity: 1, unit_price: 400, line_total: 400 }),
        ],
        supplier_source: { supplier: "ITM", subtotal: 200, gst: 30, total: 230 },
      }),
    );
    expect(a.can_send).toBe(true);
  });

  it("ignores supplier checks entirely for non-supplier quotes", () => {
    const a = assessQuoteTakeoffSafety(qd({ line_items: [li()] }));
    expect(a.can_send).toBe(true);
  });
});

describe("assessQuoteTakeoffSafety — AI-supplied quantity (phase 7)", () => {
  it("HARD-blocks an unconfirmed AI-supplied material quantity", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({ quantity_source: "ai", quantity_confirmed: false }),
        ],
      }),
    );
    expect(a.can_send).toBe(false);
    expect(a.requires_acknowledgement).toBe(false); // no override
    expect(a.block_reasons.join(" ")).toMatch(/AI-estimated quantity/i);
  });

  it("allows an AI quantity once confirmed", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [li({ quantity_source: "ai", quantity_confirmed: true })],
      }),
    );
    expect(a.can_send).toBe(true);
  });

  it("allows calculator / supplier / user quantities without confirmation", () => {
    for (const src of ["calculator", "supplier", "user"] as const) {
      const a = assessQuoteTakeoffSafety(
        qd({ line_items: [li({ quantity_source: src })] }),
      );
      expect(a.can_send).toBe(true);
    }
  });

  it("ignores AI quantity_source on non-material lines (labour)", () => {
    const a = assessQuoteTakeoffSafety(
      qd({
        line_items: [
          li({
            type: "labour",
            quantity_source: "ai",
            quantity_confirmed: false,
          }),
        ],
      }),
    );
    expect(a.can_send).toBe(true);
  });

  it("treats legacy lines (no quantity_source) as not AI", () => {
    const a = assessQuoteTakeoffSafety(qd({ line_items: [li()] }));
    expect(a.can_send).toBe(true);
  });
});

describe("validateQuoteForSending — takeoff gate", () => {
  const args = (o: Partial<QuoteData>, acknowledged?: boolean) => ({
    status: "draft",
    total_amount: 11.5,
    quote_data: qd(o),
    acknowledged,
  });

  it("blocks sending a quote with a blocked line", () => {
    const r = validateQuoteForSending(
      args({ line_items: [li({ takeoff_status: "blocked" })] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("takeoff_blocked");
      expect(r.reasons?.length).toBeGreaterThan(0);
    }
  });

  it("requires acknowledgement for a needs_review line", () => {
    const r = validateQuoteForSending(
      args({ line_items: [li({ takeoff_status: "needs_review" })] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_unconfirmed");
  });

  it("sends a needs_review quote once acknowledged", () => {
    const r = validateQuoteForSending(
      args({ line_items: [li({ takeoff_status: "needs_review" })] }, true),
    );
    expect(r.ok).toBe(true);
  });

  it("acknowledgement can NOT override a hard block", () => {
    const r = validateQuoteForSending(
      args({ line_items: [li({ takeoff_status: "blocked" })] }, true),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_blocked");
  });

  it("REGRESSION: ok-calculated lines are still blocked when the evaluator failed", () => {
    const r = validateQuoteForSending(
      args({
        line_items: [li({ takeoff_status: "ok" })],
        takeoff_evaluation: {
          status: "fail",
          reasons: ["implausible"],
          confidence: 0.1,
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_blocked");
  });

  it("still enforces the pre-existing checks before the takeoff gate", () => {
    const r = validateQuoteForSending(
      args({
        client: { name: "Jane", address: null, email: null, phone: null },
        line_items: [li({ takeoff_status: "blocked" })],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("client_email_missing");
  });

  it("passes a clean quote", () => {
    const r = validateQuoteForSending(
      args({ line_items: [li({ takeoff_status: "ok" })] }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("validateQuoteForSmsSending — takeoff gate", () => {
  const args = (o: Partial<QuoteData>, acknowledged?: boolean) => ({
    status: "draft",
    total_amount: 11.5,
    quote_data: qd(o),
    acknowledged,
  });

  it("blocks a blocked line over SMS too", () => {
    const r = validateQuoteForSmsSending(
      args({ line_items: [li({ takeoff_status: "blocked" })] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("takeoff_blocked");
  });

  it("sends an assumed quote once acknowledged", () => {
    const r = validateQuoteForSmsSending(
      args({ line_items: [li({ takeoff_status: "assumed" })] }, true),
    );
    expect(r.ok).toBe(true);
  });
});
