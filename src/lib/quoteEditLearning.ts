import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveMaterialCorrection } from "./materialLearning";
import type { QuoteLineItem } from "./quote-types";

/**
 * Stage 4.6 — wire user corrections from the QuoteEditor save flow into
 * the user-scoped material library.
 *
 * Called from `saveQuoteChanges` (server action) right after the quote +
 * line items are persisted. NEVER throws — failures are logged and
 * counted, but propagate to the caller as a soft `failed` count rather
 * than an exception. This preserves the Stage 3 invariant: a successful
 * quote save must never be undone by a learning failure.
 *
 * Per-line decision matrix:
 *
 *   - skip non-material lines (labour / other never become catalogue rows)
 *   - skip empty descriptions
 *   - skip prices that are not finite or are <= 0
 *   - skip lines whose (description, unit, unit_price) match the prior
 *     line at the same index OR the prior line with the same library_id —
 *     that's a no-op edit, no correction needed
 *   - otherwise:
 *       canonicalName = trimmed description
 *       originalText  = prior description IFF it differs (case-insensitive)
 *       unit          = item.unit (default 'each')
 *       unitPrice     = item.unit_price
 *
 *   The correction goes through `saveMaterialCorrection`, which guarantees
 *   the new row is user-scoped and never touches global catalogue rows.
 */

export type ApplyCorrectionsResult = {
  /** Number of corrections that successfully ran through saveMaterialCorrection. */
  materialsLearned: number;
  /** Number of corrections that threw — never propagated to the caller. */
  failed: number;
};

export async function applyMaterialCorrections(
  supabase: SupabaseClient,
  userId: string,
  newItems: QuoteLineItem[],
  priorItems: QuoteLineItem[],
): Promise<ApplyCorrectionsResult> {
  if (!userId) return { materialsLearned: 0, failed: 0 };

  // Prefer matching prior↔new by library_id when both have it. Falls back
  // to positional index match (which works because the QuoteEditor doesn't
  // support reorder).
  const priorByLibraryId = new Map<string, QuoteLineItem>();
  for (const p of priorItems) {
    if (p.library_id) priorByLibraryId.set(p.library_id, p);
  }

  let learned = 0;
  let failed = 0;

  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    if (item.type !== "material") continue;

    const description = (item.description ?? "").trim();
    if (!description) continue;
    const unitPrice = Number(item.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;

    const priorByLib = item.library_id
      ? priorByLibraryId.get(item.library_id)
      : undefined;
    const prior: QuoteLineItem | null =
      priorByLib ?? priorItems[i] ?? null;

    if (prior && lineItemMaterialFieldsEquivalent(prior, item)) continue;

    const priorDesc = (prior?.description ?? "").trim();
    const originalText =
      priorDesc && priorDesc.toLowerCase() !== description.toLowerCase()
        ? priorDesc
        : undefined;

    try {
      await saveMaterialCorrection(supabase, userId, {
        canonicalName: description,
        originalText,
        unit: item.unit || "each",
        unitPrice,
      });
      learned++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[material-learning] correction failed", {
        userId,
        line: i,
        description,
        message,
      });
      failed++;
    }
  }

  return { materialsLearned: learned, failed };
}

/**
 * Two material lines are "equivalent for learning" when their description
 * (trimmed, case-insensitive), unit, and unit_price all match. Other
 * fields like quantity and line_total are not relevant for whether the
 * material itself changed.
 */
function lineItemMaterialFieldsEquivalent(
  a: QuoteLineItem,
  b: QuoteLineItem,
): boolean {
  return (
    (a.description ?? "").trim().toLowerCase() ===
      (b.description ?? "").trim().toLowerCase() &&
    (a.unit ?? "") === (b.unit ?? "") &&
    Number(a.unit_price) === Number(b.unit_price)
  );
}
