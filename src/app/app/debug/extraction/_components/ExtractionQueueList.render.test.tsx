import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// next/link needs a router context that renderToStaticMarkup doesn't supply,
// so stub it to a plain anchor for the snapshot.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));

import { ExtractionQueueList } from "./ExtractionQueueList";
import { ExtractionMetricsPanel } from "../../_components/ExtractionMetricsPanel";
import {
  assessExtraction,
  parseSupplierQuoteExtraction,
} from "@/lib/materials/quoteExtraction";
import { toExtractionQueueRow, type ExtractionQueueRow } from "@/lib/materials/extractionQueue";
import { computeExtractionMetrics } from "@/lib/materials/extractionMetrics";
import type { QuoteData, SupplierSource } from "@/lib/quote-types";

import messy from "@/lib/materials/__fixtures__/supplier-scans/messy-ocr-itm.json";
import partialTable from "@/lib/materials/__fixtures__/supplier-scans/partial-table.json";

function rowFromFixture(id: string, raw: unknown): ExtractionQueueRow {
  const p = parseSupplierQuoteExtraction(raw);
  if (!p.ok) throw new Error("parse failed");
  const a = assessExtraction(p.value, p.rowFailures);
  const supplier_source: SupplierSource = {
    supplier: p.value.supplier,
    subtotal: p.value.subtotal,
    gst: p.value.gst,
    total: p.value.total,
    extraction_status: a.status,
    extraction_reasons: a.reasons,
    row_failures: p.rowFailures,
    extraction_attempts: 1,
    reconciliation_status: "needs_review",
    reconciliation_reasons: [],
  };
  const quote_data = {
    client: { name: "x", address: null, email: null, phone: null },
    job_summary: "",
    line_items: p.value.items.map((it) => ({
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
  return toExtractionQueueRow({ id, created_at: "2026-05-20T00:00:00.000Z", quote_data })!;
}

const ROWS = [
  rowFromFixture("messy", messy),
  rowFromFixture("partial", partialTable),
];

const stubAction = (id: string) =>
  createElement("button", { "data-testid": "extraction-mark-handled", "data-id": id }, "mark handled");

describe("ExtractionQueueList — empty state", () => {
  const html = renderToStaticMarkup(
    createElement(ExtractionQueueList, { rows: [], status: "open" }),
  );

  it("renders a clear empty state explaining only flagged scans appear", () => {
    expect(html).toContain("No scans need review");
    expect(html).toMatch(/needs_review or blocked/i);
  });

  it("offers a next action (scan a supplier quote)", () => {
    expect(html).toContain("Scan a supplier quote");
    expect(html).toContain("/app/materials/import-quote");
    expect(html).toContain('data-testid="extraction-empty-cta"');
  });
});

describe("ExtractionQueueList — populated state", () => {
  const html = renderToStaticMarkup(
    createElement(ExtractionQueueList, {
      rows: ROWS,
      status: "open",
      renderAction: stubAction,
    }),
  );

  it("shows supplier, status + reconciliation badges", () => {
    expect(html).toContain("ITM");
    expect(html).toContain("PlaceMakers");
    expect(html).toMatch(/extraction · needs_review/);
    expect(html).toMatch(/extraction · blocked/);
    expect(html).toMatch(/recon · needs_review/);
  });

  it("surfaces reasons and raw_text provenance for rejected rows", () => {
    expect(html).toContain("rejected rows");
    expect(html).toMatch(/unit price couldn&#x27;t be read|unit price couldn't be read/);
    // raw_text captured from the fixture is shown.
    expect(html).toContain("GIB 13mm 24 sht");
    expect(html).toContain("building wrap 3 roll");
  });

  it("shows the open-in-review link and the mark-handled action", () => {
    expect(html).toContain("open in quote review");
    expect(html).toContain("/app/quotes/preview/messy");
    expect(html).toContain('data-testid="extraction-mark-handled"');
  });
});

describe("ExtractionMetricsPanel — compact render", () => {
  const metrics = computeExtractionMetrics(
    ROWS.map((r) => ({ status: r.status, supplier: r.supplier, attempts: r.attempts, corrected: r.corrected })),
  );
  const html = renderToStaticMarkup(
    createElement(ExtractionMetricsPanel, { metrics, href: "/app/debug/extraction", compact: true }),
  );

  it("renders the stat labels + review-queue link, not a wall of text", () => {
    expect(html).toContain("extraction quality");
    expect(html).toContain("review queue");
    expect(html).toContain("scans");
    expect(html).toContain("blocked");
    expect(html).toContain("retry");
  });
});
