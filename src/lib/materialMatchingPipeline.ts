import "server-only";
import { matchMaterial, type MaterialMatch } from "./materialMatcher";
import { round2 } from "./quote-defaults";
import type {
  PriceConfidence,
  PriceSource,
  QuoteLineItem,
} from "./quote-types";

/**
 * Stage 4.3 — Material matching pipeline.
 *
 * Runs after AI line-item parsing in `src/app/api/quotes/generate/route.ts`,
 * gated by the `MATERIAL_MATCHING_ENABLED` env var (default OFF).
 *
 * Behaviour matrix:
 *
 *   enabled = false (default, including all of production today):
 *     items pass through unchanged. Stage 3 generation flow is preserved
 *     bit-for-bit.
 *
 *   enabled = true (Supabase dev branch + worktree only):
 *     for each `material` line item:
 *       a) call materialMatcher with the description
 *       b) if matched: set material_id, library_id (mirror), price_match_key,
 *          price_source ('user_library' or 'catalogue_seed'), price_confidence
 *          (high|medium|low from match_score), is_missing_price=false,
 *          is_ai_estimated=false; override unit_price with the catalogue
 *          price; recompute line_total.
 *       c) if missing_price: keep description + AI's unit_price as a
 *          suggestion, set price_source='missing_price', is_missing_price=true,
 *          is_ai_estimated=true.
 *
 *     Non-material lines (labour, other) are passed through.
 */

type MatcherFn = (input: { description: string }) => Promise<MaterialMatch>;

export type EnrichmentOptions = {
  enabled: boolean;
  /** Test seam — replace the matcher in unit tests. */
  matcher?: MatcherFn;
};

function confidenceFromScore(score: number): PriceConfidence {
  if (score > 0.7) return "high";
  if (score > 0.4) return "medium";
  return "low";
}

function priceSourceFromMatchSource(source: string): PriceSource {
  if (source === "direct_user" || source === "alias_user") {
    return "user_library";
  }
  return "catalogue_seed";
}

export async function enrichLineItemsWithCatalogue(
  items: QuoteLineItem[],
  options: EnrichmentOptions,
): Promise<QuoteLineItem[]> {
  if (!options.enabled) return items;
  const match = options.matcher ?? matchMaterial;

  const out: QuoteLineItem[] = [];
  for (const item of items) {
    if (item.type !== "material") {
      out.push(item);
      continue;
    }

    const result = await match({ description: item.description });

    if (result.status === "matched") {
      const hit = result.hit;
      const newPrice = hit.price ?? item.unit_price;
      const qty = Number(item.quantity) || 0;
      out.push({
        ...item,
        material_id: hit.id,
        library_id: hit.id,
        price_match_key:
          result.normalized.normalized || item.description.toLowerCase(),
        price_source: priceSourceFromMatchSource(result.source),
        price_confidence: confidenceFromScore(hit.match_score),
        is_missing_price: false,
        is_ai_estimated: false,
        unit_price: newPrice,
        unit: hit.unit ?? item.unit,
        line_total: round2(qty * newPrice),
      });
    } else {
      // result.status === "missing_price" — never invent a price.
      out.push({
        ...item,
        material_id: result.partial?.id ?? null,
        // Keep library_id from any prior Stage 2.5 match if it was set —
        // otherwise null it explicitly to make the missing state obvious.
        library_id: item.library_id ?? null,
        price_match_key:
          result.normalized.normalized || item.description.toLowerCase(),
        price_source: "missing_price",
        price_confidence: "low",
        is_missing_price: true,
        is_ai_estimated: true,
      });
    }
  }
  return out;
}

/** Centralised flag read so callers and tests share one source of truth. */
export function materialMatchingEnabledFromEnv(): boolean {
  return process.env.MATERIAL_MATCHING_ENABLED === "true";
}
