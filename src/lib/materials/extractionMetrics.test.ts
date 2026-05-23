import { describe, expect, it } from "vitest";
import {
  computeExtractionMetrics,
  type ExtractionMetricRecord,
} from "./extractionMetrics";

const rec = (o: Partial<ExtractionMetricRecord> = {}): ExtractionMetricRecord => ({
  status: "ok",
  supplier: "ITM",
  attempts: 1,
  corrected: false,
  ...o,
});

describe("computeExtractionMetrics", () => {
  it("returns zeros for an empty sample", () => {
    const m = computeExtractionMetrics([]);
    expect(m.total).toBe(0);
    expect(m.byStatus).toEqual({ ok: 0, needs_review: 0, blocked: 0, unknown: 0 });
    expect(m.retryRate).toBe(0);
    expect(m.correctionRate).toBe(0);
    expect(m.bySupplier).toEqual([]);
  });

  it("counts by status, including unknown for legacy null status", () => {
    const m = computeExtractionMetrics([
      rec({ status: "ok" }),
      rec({ status: "ok" }),
      rec({ status: "needs_review" }),
      rec({ status: "blocked" }),
      rec({ status: null }),
    ]);
    expect(m.total).toBe(5);
    expect(m.byStatus).toEqual({ ok: 2, needs_review: 1, blocked: 1, unknown: 1 });
  });

  it("groups by supplier (null → Unknown), sorted by total desc", () => {
    const m = computeExtractionMetrics([
      rec({ supplier: "ITM", status: "ok" }),
      rec({ supplier: "ITM", status: "needs_review" }),
      rec({ supplier: "ITM", status: "blocked" }),
      rec({ supplier: "PlaceMakers", status: "ok" }),
      rec({ supplier: null, status: "needs_review" }),
    ]);
    expect(m.bySupplier[0]).toEqual({ supplier: "ITM", total: 3, needs_review: 1, blocked: 1 });
    expect(m.bySupplier.map((s) => s.supplier)).toContain("Unknown");
  });

  it("computes retry rate from attempts > 1", () => {
    const m = computeExtractionMetrics([
      rec({ attempts: 1 }),
      rec({ attempts: 2 }),
      rec({ attempts: 2 }),
      rec({ attempts: 1 }),
    ]);
    expect(m.retriedCount).toBe(2);
    expect(m.retryRate).toBe(0.5);
  });

  it("computes correction rate from corrected flag", () => {
    const m = computeExtractionMetrics([
      rec({ status: "needs_review", corrected: true }),
      rec({ status: "blocked", corrected: false }),
      rec({ status: "ok", corrected: false }),
      rec({ status: "ok", corrected: false }),
    ]);
    expect(m.flaggedCount).toBe(2);
    expect(m.correctedCount).toBe(1);
    expect(m.correctionRate).toBe(0.25); // 1 of 4 total
  });
});
