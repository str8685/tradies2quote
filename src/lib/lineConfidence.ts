/**
 * Wave 41 Stage 2 — visual confidence tier for a quote line item.
 *
 * Reduces the existing per-line metadata (price_source, library hit,
 * is_ai_estimated, is_missing_price) into a single coloured stripe
 * the tradie can scan-check before sending: green = trust it, amber
 * = AI guessed, red = you need to fix this.
 *
 * Why not just rely on the existing badges?
 *   The badges describe provenance ("from your library", "T2Q
 *   estimate", "missing price"). A coloured stripe summarises
 *   *confidence*. Two different mental models — the badge tells you
 *   WHY a line looks this way, the stripe tells you HOW MUCH you
 *   should worry about it. Glancing down a long quote, the stripe
 *   is what surfaces the rows that need attention.
 */

import type { QuoteLineItem } from "@/lib/quote-types";

export type LineConfidence = "high" | "medium" | "low" | "none";

interface MinimalLibraryMaterial {
  default_unit_price?: number | null;
  is_ai_estimated?: boolean | null;
}

/**
 * Map a line item to a confidence tier.
 *
 * Rules in priority order:
 *   1. Missing price (or zero price on a non-labour line)  → LOW
 *   2. AI-estimated price                                  → MEDIUM
 *   3. Library match with a real (non-estimated) price     → HIGH
 *   4. Catalogue seed / supplier import / csv import       → HIGH
 *   5. Labour / other with a price                         → NONE (no stripe)
 *   6. Anything else                                       → NONE
 *
 * Returns "none" rather than "low" for labour lines so we don't
 * scare the tradie about hours/rate values they explicitly set.
 */
export function lineConfidence(
  it: QuoteLineItem,
  libMaterial?: MinimalLibraryMaterial | null,
): LineConfidence {
  if (it.is_missing_price) return "low";
  if (it.type === "material" && (Number(it.unit_price) || 0) <= 0) {
    return "low";
  }

  if (it.is_ai_estimated) return "medium";
  if (it.price_source === "ai_estimate") return "medium";
  if (libMaterial?.is_ai_estimated) return "medium";

  if (
    it.price_source === "user_library" ||
    it.price_source === "csv_import" ||
    it.price_source === "supplier_import"
  ) {
    return "high";
  }
  if (libMaterial && (Number(libMaterial.default_unit_price) || 0) > 0) {
    return "high";
  }
  if (it.price_source === "catalogue_seed") return "high";

  return "none";
}

/** Tally an array of items into counts for the summary chip. */
export function confidenceTally(
  items: Array<{ it: QuoteLineItem; lib?: MinimalLibraryMaterial | null }>,
): { high: number; medium: number; low: number } {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const { it, lib } of items) {
    const c = lineConfidence(it, lib);
    if (c === "high") high++;
    else if (c === "medium") medium++;
    else if (c === "low") low++;
  }
  return { high, medium, low };
}
