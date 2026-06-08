/**
 * CSI mapper — REAL-QUOTE eval (DEV/DEBUG ONLY, READ-ONLY, OWNER-SCOPED).
 *
 * This runner does NOT touch the database. It reads a local JSON file of
 * line items (extracted read-only, owner-scoped, upstream — e.g. a one-off
 * owner-only Supabase SELECT or the /app/debug/csi aggregate) and runs the
 * REAL `mapLinesToCsi` over them to MEASURE Stage-1 behaviour on actual data.
 *
 *   RUN_CSI_REAL_EVAL=1 CSI_REAL_LINES=/tmp/csi-real-lines.json \
 *     npx vitest run src/eval/csi-real-eval.test.ts
 *
 * It never mutates, never writes, never recalculates, never reprices. The
 * JSON must be an array of { description, type?, takeoff_status?,
 * quantity_source?, is_calculated_takeoff?, is_ai_estimated? }.
 *
 * Skipped entirely unless RUN_CSI_REAL_EVAL=1 (so `npm test` never needs a
 * file or real data).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatCsiLineReport,
  summariseCsiLines,
} from "@/lib/takeoff/csi/eval";
import type { CsiSourceLine } from "@/lib/takeoff/csi/contracts";

const ENABLED = process.env.RUN_CSI_REAL_EVAL === "1";
const PATH = process.env.CSI_REAL_LINES ?? "";

describe.runIf(ENABLED)("CSI mapper — real saved quotes", () => {
  it("measures the Stage-1 mapping over real line items (read-only)", () => {
    expect(PATH, "set CSI_REAL_LINES=/path/to/lines.json").not.toBe("");
    expect(existsSync(PATH), `file not found: ${PATH}`).toBe(true);

    const raw = JSON.parse(readFileSync(PATH, "utf8")) as CsiSourceLine[];
    expect(Array.isArray(raw)).toBe(true);

    const summary = summariseCsiLines(raw, { topN: 25 });
    process.stdout.write("\n" + formatCsiLineReport(summary) + "\n\n");

    // Invariants only — this is a measurement, not a pass/fail gate.
    expect(summary.total).toBe(raw.length);
    expect(summary.mapped + summary.uncategorized).toBe(summary.total);
    expect(summary.manualReview).toBe(summary.uncategorized - summary.nonMaterial);
  });
});
