import { describe, expect, it } from "vitest";
import {
  parseCritic,
  verifyQuote,
  verifyQuoteDeterministic,
} from "../quoteVerify";
import type { GeneratedQuote } from "../../quote-generation";

function quote(over: Partial<GeneratedQuote> = {}): GeneratedQuote {
  const base: GeneratedQuote = {
    jobName: "Deck build",
    clientName: "Dave",
    lineItems: [
      { description: "Decking", quantity: 24, unit: "m2", unitPrice: 80, lineTotal: 1920, category: "materials" },
      { description: "Labour", quantity: 8, unit: "hr", unitPrice: 85, lineTotal: 680, category: "labour" },
    ],
    subtotal: 2600,
    gstRate: 0.15,
    gstAmount: 390,
    total: 2990,
    notes: [],
    terms: "Net 7.",
  };
  return { ...base, ...over };
}

/** A Claude tool_use response for the critic. */
function criticResponse(input: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({
      content: [{ type: "tool_use", name: "report_quote_issues", input }],
      usage: {},
    }),
  } as unknown as Response;
}

describe("verifyQuoteDeterministic", () => {
  it("passes a clean quote with no issues", () => {
    expect(verifyQuoteDeterministic(quote())).toEqual([]);
  });

  it("flags no line items as an error", () => {
    const issues = verifyQuoteDeterministic(quote({ lineItems: [] }));
    expect(issues.some((i) => i.code === "no_line_items" && i.severity === "error")).toBe(true);
  });

  it("catches a subtotal that doesn't match the line totals", () => {
    const issues = verifyQuoteDeterministic(quote({ subtotal: 9999 }));
    expect(issues.some((i) => i.code === "subtotal_mismatch" && i.severity === "error")).toBe(true);
  });

  it("catches a wrong GST", () => {
    const issues = verifyQuoteDeterministic(quote({ gstAmount: 10 }));
    expect(issues.some((i) => i.code === "gst_mismatch")).toBe(true);
  });

  it("warns on a zero-priced line", () => {
    const issues = verifyQuoteDeterministic(
      quote({
        lineItems: [
          { description: "Mystery", quantity: 1, unit: "each", unitPrice: 0, lineTotal: 0, category: "materials" },
        ],
        subtotal: 0,
        gstAmount: 0,
        total: 0,
      }),
    );
    expect(issues.some((i) => i.code === "zero_price")).toBe(true);
    expect(issues.some((i) => i.code === "zero_total" && i.severity === "error")).toBe(true);
  });

  it("warns on duplicate lines", () => {
    const dup = { description: "Decking", quantity: 1, unit: "m2", unitPrice: 80, lineTotal: 80, category: "materials" as const };
    const issues = verifyQuoteDeterministic(
      quote({ lineItems: [dup, dup], subtotal: 160, gstAmount: 24, total: 184 }),
    );
    expect(issues.some((i) => i.code === "duplicate_line")).toBe(true);
  });

  it("warns on an implausibly large total", () => {
    const big = { description: "X", quantity: 1, unit: "each", unitPrice: 2_000_000, lineTotal: 2_000_000, category: "materials" as const };
    const issues = verifyQuoteDeterministic(
      quote({ lineItems: [big], subtotal: 2_000_000, gstAmount: 300_000, total: 2_300_000 }),
    );
    expect(issues.some((i) => i.code === "implausible_total")).toBe(true);
  });
});

describe("parseCritic", () => {
  it("maps issues and defaults severity to warning", () => {
    const res = parseCritic({
      scope_covered: false,
      issues: [
        { severity: "error", message: "Missing the handrail" },
        { message: "Decking price looks low" },
        { severity: "warning", message: "  " }, // blank → dropped
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.scopeCovered).toBe(false);
    expect(res.value.issues).toHaveLength(2);
    expect(res.value.issues[0]).toMatchObject({ code: "critic", severity: "error" });
    expect(res.value.issues[1].severity).toBe("warning");
  });

  it("treats scope_covered as true unless explicitly false", () => {
    expect((parseCritic({ issues: [] }) as { value: { scopeCovered: boolean } }).value.scopeCovered).toBe(true);
  });
});

describe("verifyQuote (orchestrator)", () => {
  it("runs deterministic only when the critic is off", async () => {
    const report = await verifyQuote({ quote: quote(), runCritic: false });
    expect(report.ok).toBe(true);
    expect(report.checkedBy).toEqual(["deterministic"]);
  });

  it("merges critic issues when enabled", async () => {
    const fetchImpl = (async () =>
      criticResponse({
        scope_covered: false,
        issues: [{ severity: "warning", message: "No handrail quoted" }],
      })) as unknown as typeof fetch;
    const report = await verifyQuote({
      quote: quote(),
      transcript: "Build a deck with a handrail",
      runCritic: true,
      apiKey: "key",
      fetchImpl,
    });
    expect(report.checkedBy).toContain("critic");
    expect(report.issues.some((i) => i.message.includes("handrail"))).toBe(true);
    expect(report.issues.some((i) => i.code === "scope_not_covered")).toBe(true);
    expect(report.ok).toBe(true); // warnings only
  });

  it("degrades gracefully when the critic call fails", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const report = await verifyQuote({
      quote: quote(),
      transcript: "Build a deck",
      runCritic: true,
      apiKey: "key",
      fetchImpl,
    });
    // Falls back to deterministic-only, still ok.
    expect(report.checkedBy).toEqual(["deterministic"]);
    expect(report.ok).toBe(true);
  });

  it("reports not-ok when there's an error-severity issue", async () => {
    const report = await verifyQuote({ quote: quote({ lineItems: [] }), runCritic: false });
    expect(report.ok).toBe(false);
  });
});
