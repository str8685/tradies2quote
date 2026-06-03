// ─────────────────────────────────────────────────────────────────────────
// Corrections → runnable eval cases.
//
// The flywheel captures every price the tradie corrects the AI on
// (repeated_correction memories). This turns those into structured regression
// cases: "when the job mentions <material>, the quote should price it at the
// CORRECTED figure, not the AI's old guess". The corrections-eval consumes
// these live from the DB, so the eval set GROWS itself — no manual curation.
//
// Pure + deterministic so it's unit-testable.
// ─────────────────────────────────────────────────────────────────────────

import type { CorrectionItem } from "./weekly";

export type PriceEvalCase = {
  id: string;
  /** The material/line the tradie corrected. */
  material: string;
  /** The corrected unit price (what the quote SHOULD now use). */
  expected: number;
  /** The AI's original guess, if numeric — what it should no longer use. */
  was: number | null;
  /** A synthesized job description that should surface this material. */
  transcript: string;
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

/**
 * Convert captured corrections into price regression cases. Only `unit_price`
 * corrections with a sensible positive target become cases — a rename isn't a
 * price assertion.
 */
export function correctionsToEvalCases(
  corrections: CorrectionItem[],
): PriceEvalCase[] {
  const cases: PriceEvalCase[] = [];
  const seen = new Set<string>();
  for (const c of corrections) {
    if (c.field !== "unit_price") continue;
    const expected = Number(c.to);
    if (!Number.isFinite(expected) || expected <= 0) continue;
    const material = (c.description ?? "").trim();
    if (!material) continue;
    const id = slug(material);
    if (seen.has(id)) continue;
    seen.add(id);
    const was = Number(c.from);
    cases.push({
      id,
      material,
      expected,
      was: Number.isFinite(was) && was > 0 ? was : null,
      transcript: `Quote for supplying and installing ${material}. Roughly a day's work.`,
    });
  }
  return cases;
}
