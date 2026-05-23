// ─────────────────────────────────────────────────────────────────────────
// Supplier-extraction metrics — pure counts, no external services.
//
// Aggregates the provenance frozen on each supplier import into the few
// numbers the owner cares about: how many scans by status, the supplier
// spread, how often a retry fired, and how often a human had to correct a
// flagged read. Drives the tiny metrics panel on the review queue + debug
// page. Input is the same `ExtractionQueueRow` shape (or any structural
// subset), so the page builds it once and reuses it.
// ─────────────────────────────────────────────────────────────────────────

import type { ExtractionStatus } from "./extractionQueue";

/** The minimal per-extraction facts the metrics need. */
export type ExtractionMetricRecord = {
  status: ExtractionStatus | null;
  supplier: string | null;
  attempts: number;
  corrected: boolean;
};

export type ExtractionMetrics = {
  total: number;
  byStatus: {
    ok: number;
    needs_review: number;
    blocked: number;
    /** Supplier imports with no recorded status (legacy rows). */
    unknown: number;
  };
  bySupplier: Array<{
    supplier: string;
    total: number;
    needs_review: number;
    blocked: number;
  }>;
  /** Extractions that needed at least one retry (attempts > 1). */
  retriedCount: number;
  /** retriedCount / total, 0 when total is 0. */
  retryRate: number;
  /** Flagged (needs_review|blocked) extractions a human corrected. */
  correctedCount: number;
  /** Total flagged extractions (the correction denominator of interest). */
  flaggedCount: number;
  /** correctedCount / total, 0 when total is 0. */
  correctionRate: number;
};

const UNKNOWN_SUPPLIER = "Unknown";

function isFlagged(status: ExtractionStatus | null): boolean {
  return status === "needs_review" || status === "blocked";
}

/**
 * Roll a list of supplier-extraction records into the metrics summary.
 * Pure and deterministic — safe to call on the page or in tests/fixtures.
 */
export function computeExtractionMetrics(
  records: ExtractionMetricRecord[],
): ExtractionMetrics {
  const total = records.length;
  const byStatus = { ok: 0, needs_review: 0, blocked: 0, unknown: 0 };
  const supplierMap = new Map<
    string,
    { supplier: string; total: number; needs_review: number; blocked: number }
  >();

  let retriedCount = 0;
  let correctedCount = 0;
  let flaggedCount = 0;

  for (const r of records) {
    // Status tally.
    if (r.status === "ok") byStatus.ok += 1;
    else if (r.status === "needs_review") byStatus.needs_review += 1;
    else if (r.status === "blocked") byStatus.blocked += 1;
    else byStatus.unknown += 1;

    // Supplier spread.
    const key = r.supplier?.trim() || UNKNOWN_SUPPLIER;
    const bucket =
      supplierMap.get(key) ??
      { supplier: key, total: 0, needs_review: 0, blocked: 0 };
    bucket.total += 1;
    if (r.status === "needs_review") bucket.needs_review += 1;
    if (r.status === "blocked") bucket.blocked += 1;
    supplierMap.set(key, bucket);

    // Retry + correction.
    if ((Number(r.attempts) || 1) > 1) retriedCount += 1;
    if (isFlagged(r.status)) {
      flaggedCount += 1;
      if (r.corrected) correctedCount += 1;
    } else if (r.corrected) {
      // A corrected ok-row still counts toward the correction tally.
      correctedCount += 1;
    }
  }

  const bySupplier = Array.from(supplierMap.values()).sort(
    (a, b) => b.total - a.total || a.supplier.localeCompare(b.supplier),
  );

  const rate = (n: number) => (total > 0 ? Math.round((n / total) * 100) / 100 : 0);

  return {
    total,
    byStatus,
    bySupplier,
    retriedCount,
    retryRate: rate(retriedCount),
    correctedCount,
    flaggedCount,
    correctionRate: rate(correctedCount),
  };
}
