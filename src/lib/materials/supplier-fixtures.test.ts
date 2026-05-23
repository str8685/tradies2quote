import { describe, expect, it } from "vitest";
import {
  assessExtraction,
  chooseBestExtraction,
  parseSupplierQuoteExtraction,
  type ExtractionAttempt,
  type ExtractionStatus,
  type RowFailure,
  type SupplierQuoteExtraction,
} from "./quoteExtraction";
import {
  filterExtractionQueue,
  toExtractionQueueRow,
  type ExtractionQuoteInput,
} from "./extractionQueue";
import type { QuoteData, SupplierSource } from "../quote-types";

import clean from "./__fixtures__/supplier-scans/clean-itm.json";
import messy from "./__fixtures__/supplier-scans/messy-ocr-itm.json";
import missingSubtotal from "./__fixtures__/supplier-scans/missing-subtotal.json";
import unreadableTotal from "./__fixtures__/supplier-scans/unreadable-total.json";
import partialTable from "./__fixtures__/supplier-scans/partial-table.json";
import retrySuccess from "./__fixtures__/supplier-scans/retry-success.json";
import retryFail from "./__fixtures__/supplier-scans/retry-fail-blocked.json";

// ─────────────────────────────────────────────────────────────────────────
// Golden supplier-scan fixtures. Each fixture is the RAW model payload (or a
// list of attempts). We run it through the SAME strict parser + assessment +
// retry chooser the production route uses, then assert the deterministic
// extraction_status / reasons / row_failures AND whether it would surface in
// the owner review queue. The strict parser/retry are NOT changed here.
// ─────────────────────────────────────────────────────────────────────────

type Assessed = {
  status: ExtractionStatus;
  reasons: string[];
  rowFailures: RowFailure[];
  attempts: number;
  value: SupplierQuoteExtraction;
};

function assessSingle(raw: unknown): Assessed {
  const p = parseSupplierQuoteExtraction(raw);
  if (!p.ok) throw new Error(`parse failed: ${p.errors.join(", ")}`);
  const a = assessExtraction(p.value, p.rowFailures);
  return { status: a.status, reasons: a.reasons, rowFailures: p.rowFailures, attempts: 1, value: p.value };
}

function assessRetry(raw: { attempts: unknown[] }): Assessed {
  const attempts: ExtractionAttempt[] = raw.attempts.map((r) => {
    const p = parseSupplierQuoteExtraction(r);
    if (!p.ok) throw new Error("parse failed in retry fixture");
    return { value: p.value, rowFailures: p.rowFailures };
  });
  const best = chooseBestExtraction(attempts);
  return {
    status: best.status,
    reasons: best.reasons,
    rowFailures: best.rowFailures,
    attempts: attempts.length,
    value: best.value,
  };
}

/** Build the review-queue row this assessment would produce once persisted. */
function queueRow(a: Assessed) {
  const supplier_source: SupplierSource = {
    supplier: a.value.supplier,
    subtotal: a.value.subtotal,
    gst: a.value.gst,
    total: a.value.total,
    extraction_status: a.status,
    extraction_reasons: a.reasons,
    row_failures: a.rowFailures,
    extraction_attempts: a.attempts,
  };
  const quote_data = {
    client: { name: "x", address: null, email: null, phone: null },
    job_summary: "",
    line_items: a.value.items.map((it) => ({
      type: "material" as const,
      description: it.name,
      quantity: it.quantity ?? 0,
      unit: it.unit,
      unit_price: it.price ?? 0,
      line_total: it.source_line_total ?? 0,
    })),
    materials_subtotal: 0,
    labour_subtotal: 0,
    markup_pct: 0,
    markup_amount: 0,
    subtotal_before_tax: 0,
    tax_amount: 0,
    total: 0,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: 15,
    terms: "",
    notes: [],
    supplier_source,
  } as QuoteData;
  const input: ExtractionQuoteInput = {
    id: "fixture",
    created_at: "2026-05-20T00:00:00.000Z",
    quote_data,
  };
  return toExtractionQueueRow(input)!;
}

function inOpenQueue(a: Assessed): boolean {
  return filterExtractionQueue([queueRow(a)]).length === 1;
}

// The contract table — the single source of truth for what each fixture
// should produce. Asserting it as a group makes a regression obvious.
const EXPECTED: Record<string, { status: ExtractionStatus; inQueue: boolean }> = {
  "clean-itm": { status: "ok", inQueue: false },
  "messy-ocr-itm": { status: "needs_review", inQueue: true },
  "missing-subtotal": { status: "ok", inQueue: false },
  "unreadable-total": { status: "needs_review", inQueue: true },
  "partial-table": { status: "blocked", inQueue: true },
  "retry-success": { status: "ok", inQueue: false },
  "retry-fail-blocked": { status: "blocked", inQueue: true },
};

const RESULTS: Record<string, Assessed> = {
  "clean-itm": assessSingle(clean),
  "messy-ocr-itm": assessSingle(messy),
  "missing-subtotal": assessSingle(missingSubtotal),
  "unreadable-total": assessSingle(unreadableTotal),
  "partial-table": assessSingle(partialTable),
  "retry-success": assessRetry(retrySuccess as { attempts: unknown[] }),
  "retry-fail-blocked": assessRetry(retryFail as { attempts: unknown[] }),
};

describe("golden supplier-scan fixtures", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    it(`${name} → ${expected.status} (queue: ${expected.inQueue})`, () => {
      const r = RESULTS[name];
      expect(r.status).toBe(expected.status);
      expect(inOpenQueue(r)).toBe(expected.inQueue);
    });
  }
});

describe("golden fixtures — specific provenance", () => {
  it("clean ITM: no rejected rows, all items kept", () => {
    const r = RESULTS["clean-itm"];
    expect(r.rowFailures).toEqual([]);
    expect(r.value.items).toHaveLength(3);
  });

  it("messy OCR: the smudged price row is rejected (visible), not silently dropped", () => {
    const r = RESULTS["messy-ocr-itm"];
    expect(r.rowFailures).toHaveLength(1);
    expect(r.rowFailures[0].reason).toMatch(/unit price/i);
    expect(r.rowFailures[0].raw_text).toBeTruthy();
    expect(r.value.items).toHaveLength(2);
  });

  it("missing subtotal alone is OK when the printed total still reconciles (no false flag)", () => {
    const r = RESULTS["missing-subtotal"];
    expect(r.status).toBe("ok");
    expect(r.value.subtotal).toBeNull();
    expect(r.value.total).toBe(2044.7);
  });

  it("unreadable total: drops to null and the read needs review (nothing to reconcile)", () => {
    const r = RESULTS["unreadable-total"];
    expect(r.value.total).toBeNull();
    expect(r.status).toBe("needs_review");
    expect(r.reasons.join(" ")).toMatch(/subtotal or total/i);
  });

  it("partial table: rejected rows + no totals → blocked (can't trust the partial)", () => {
    const r = RESULTS["partial-table"];
    expect(r.rowFailures.length).toBeGreaterThanOrEqual(2);
    expect(r.status).toBe("blocked");
  });

  it("retry success: the second pass wins and reconciles to ok", () => {
    const r = RESULTS["retry-success"];
    expect(r.attempts).toBe(2);
    expect(r.status).toBe("ok");
    expect(r.rowFailures).toEqual([]);
  });

  it("retry fail: both passes unreadable → stays blocked", () => {
    const r = RESULTS["retry-fail-blocked"];
    expect(r.attempts).toBe(2);
    expect(r.status).toBe("blocked");
  });
});
