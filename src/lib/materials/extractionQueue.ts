// ─────────────────────────────────────────────────────────────────────────
// Supplier-extraction review queue — pure shaping + filtering.
//
// Operational layer for the owner extraction-review page. Reads the
// provenance the scan flow already froze onto `quote_data.supplier_source`
// (extraction_status / reasons / row_failures / reconciliation_*) and turns
// a quote row into a flat `ExtractionQueueRow`. No I/O, no parsing — the
// strict parser and retry behaviour are untouched; this only READS what they
// recorded. Owner page does the DB read + auth; this is the testable core.
// ─────────────────────────────────────────────────────────────────────────

import { quoteNumber } from "../quote-defaults";
import type { QuoteData } from "../quote-types";

export type ExtractionStatus = "ok" | "needs_review" | "blocked";
export type ReconciliationStatus = "ok" | "needs_review" | "blocked";

/** Minimal quote shape the page reads from Supabase. */
export type ExtractionQuoteInput = {
  id: string;
  created_at: string;
  quote_data: QuoteData | null;
};

export type ExtractionQueueRow = {
  quoteId: string;
  /** Our internal quote number (the supplier's printed number isn't stored). */
  quoteNumber: string;
  createdAt: string;
  supplier: string | null;
  status: ExtractionStatus | null;
  reasons: string[];
  rowFailures: Array<{ index: number; reason: string; raw_text: string | null }>;
  reconciliationStatus: ReconciliationStatus | null;
  reconciliationReasons: string[];
  attempts: number;
  corrected: boolean;
  correctedBy: string | null;
  correctedAt: string | null;
  reviewedAt: string | null;
  itemCount: number;
  /** Printed source totals (read-only) for the at-a-glance summary. */
  source: { subtotal: number | null; gst: number | null; total: number | null };
};

/**
 * Build a queue row for a supplier-import quote. Returns null for quotes
 * that didn't come from a supplier scan (no `supplier_source`) — they're not
 * part of the extraction queue.
 */
export function toExtractionQueueRow(
  q: ExtractionQuoteInput,
): ExtractionQueueRow | null {
  const ss = q.quote_data?.supplier_source ?? null;
  if (!ss) return null;

  const status = (ss.extraction_status ?? null) as ExtractionStatus | null;
  const lineItems = Array.isArray(q.quote_data?.line_items)
    ? q.quote_data!.line_items
    : [];

  return {
    quoteId: q.id,
    quoteNumber: quoteNumber(q.id, q.created_at),
    createdAt: q.created_at,
    supplier: ss.supplier ?? null,
    status,
    reasons: ss.extraction_reasons ?? [],
    rowFailures: ss.row_failures ?? [],
    reconciliationStatus:
      (ss.reconciliation_status ?? null) as ReconciliationStatus | null,
    reconciliationReasons: ss.reconciliation_reasons ?? [],
    attempts: typeof ss.extraction_attempts === "number" ? ss.extraction_attempts : 1,
    corrected: ss.extraction_corrected === true,
    correctedBy: ss.corrected_by ?? null,
    correctedAt: ss.corrected_at ?? null,
    reviewedAt: ss.extraction_reviewed_at ?? null,
    itemCount: lineItems.length,
    source: {
      subtotal: ss.source_subtotal ?? ss.subtotal ?? null,
      gst: ss.source_gst ?? ss.gst ?? null,
      total: ss.source_total ?? ss.total ?? null,
    },
  };
}

/** Map a list of quote rows to queue rows, dropping non-supplier quotes. */
export function toExtractionQueueRows(
  quotes: ExtractionQuoteInput[],
): ExtractionQueueRow[] {
  return quotes
    .map(toExtractionQueueRow)
    .filter((r): r is ExtractionQueueRow => r !== null);
}

export type QueueFilter = {
  /**
   *  - "open"        (default) needs_review + blocked, not yet handled
   *  - "needs_review" / "blocked" — that status, not yet handled
   *  - "handled"     — anything the owner marked reviewed
   */
  status?: "open" | "needs_review" | "blocked" | "handled";
  /** Exact supplier name match (case-insensitive). Omit for all suppliers. */
  supplier?: string | null;
};

const FLAGGED: ReadonlySet<ExtractionStatus> = new Set([
  "needs_review",
  "blocked",
]);

/**
 * Narrow the queue to what needs a human. Default ("open") shows unhandled
 * needs_review/blocked entries; clean `ok` scans never appear, so the
 * happy path stays uncluttered.
 */
export function filterExtractionQueue(
  rows: ExtractionQueueRow[],
  filter: QueueFilter = {},
): ExtractionQueueRow[] {
  const status = filter.status ?? "open";
  const supplier = filter.supplier?.trim().toLowerCase() || null;

  return rows.filter((r) => {
    if (supplier && (r.supplier ?? "").trim().toLowerCase() !== supplier) {
      return false;
    }
    if (status === "handled") return r.reviewedAt != null;
    // All non-handled views exclude already-handled entries.
    if (r.reviewedAt != null) return false;
    if (status === "open") return r.status != null && FLAGGED.has(r.status);
    return r.status === status;
  });
}

/** Distinct supplier names present in the rows, sorted, for the filter chips. */
export function suppliersInQueue(rows: ExtractionQueueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.supplier && r.supplier.trim()) set.add(r.supplier.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
