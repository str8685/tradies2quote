// ─────────────────────────────────────────────────────────────────────────
// CSI grouped-view presentation helpers (pure, no React).
//
// Kept out of the .tsx component so the only real logic in the read-only
// grouped view — the per-section quantity subtotal — is unit-testable in the
// node test environment.
// ─────────────────────────────────────────────────────────────────────────

import type { CsiDivision } from "./contracts";

export const CSI_DIVISION_LABEL: Record<
  Exclude<CsiDivision, "uncategorized">,
  string
> = {
  "03_concrete": "Division 03 — Concrete",
  "05_metals": "Division 05 — Metals",
  "06_wood_plastics": "Division 06 — Wood & Plastics",
  "07_thermal_moisture": "Division 07 — Thermal & Moisture",
  "09_finishes": "Division 09 — Finishes",
};

/**
 * Per-section quantity subtotal — sums quantities WITHIN each unit, never
 * across units (mixing m² + ea + lengths would be meaningless). Lines with no
 * unit or a zero/blocked quantity contribute nothing. Returns a compact
 * "12 ea · 340 m" string, or "" when nothing is safely summable.
 *
 * This is the ONLY "subtotal" the grouped view shows — it is exact arithmetic
 * within a single unit, never an invented rollup. No pricing is summed
 * (pricing stays manual).
 */
export function unitSummary(
  lines: ReadonlyArray<{ unit?: string | null; quantity?: number | null }>,
): string {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const unit = (l.unit ?? "").trim();
    if (unit && typeof l.quantity === "number" && l.quantity !== 0) {
      totals.set(unit, (totals.get(unit) ?? 0) + l.quantity);
    }
  }
  return [...totals.entries()]
    .map(([unit, qty]) => `${Number.isInteger(qty) ? qty : qty.toFixed(2)} ${unit}`)
    .join(" · ");
}
