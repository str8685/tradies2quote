// ─────────────────────────────────────────────────────────────────────────
// CSI / MasterFormat trade-mapping — CONTRACTS (Stage 1).
//
// This is an ADDITIVE, NON-INVASIVE view layer over already-calculated
// takeoff / review line items. It organises existing lines into standard
// trade buckets. It does NOT calculate, price, re-scope, or rewrite history.
// See docs/takeoff-architecture/SYSTEM_ARCHITECTURE.md §5.
//
// HARD RULES this layer obeys (same product policy as the calculators):
//   - Pure lookup. NEVER changes a quantity, NEVER sets a price.
//   - NEVER mutates the input line items.
//   - No confident division → "uncategorized" (explicit), surfaced in
//     review. Never a silent default bucket, never a guess.
//   - takeoff_status + provenance are carried through, so blocked /
//     missing-info / AI-estimated state survives the mapping.
//   - It organises lines; it does NOT remap a deck line into wall framing
//     to make CSI look clean, and it does NOT "fix" wrong-scope legacy
//     quotes (that is scopeFamily / routing's job, upstream).
// ─────────────────────────────────────────────────────────────────────────

import type { QuoteItemType } from "@/lib/quote-types";
import type { TakeoffStatus } from "../schemas";

/**
 * MasterFormat-aligned divisions we actually touch as a small-tradie
 * product. Deliberately a small adapted subset — not the full 49-division
 * spec — but the codes line up so output stays standardisable/exportable.
 */
export type CsiDivision =
  | "03_concrete" //          slabs, piles, footings, foundations, rebar
  | "05_metals" //            structural steel framing
  | "06_wood_plastics" //     carpentry: framing timber, decking, blocking
  | "07_thermal_moisture" //  insulation, building wrap, cladding/weatherboard
  | "09_finishes" //          GIB / plasterboard, stopping, linings
  | "uncategorized"; //       EXPLICIT — never silently bucketed

/** Plain-language trade bucket a tradie recognises, alongside the division. */
export type TradeBucket =
  | "concrete"
  | "framing"
  | "decking"
  | "cladding"
  | "insulation"
  | "lining"
  | "fixings"
  | "other";

/**
 * Provenance of a line's QUANTITY, derived ONLY from fields already on the
 * line — never inferred or guessed. Mirrors the distinctions the product
 * already tracks (quantity_source / is_calculated_takeoff / takeoff_status).
 *
 *   calculated   — deterministic takeoff/calculator output.
 *   supplier     — imported from a supplier document.
 *   user         — entered or edited by the tradie.
 *   ai_estimated — AI-suggested; stays flagged, never silently trusted.
 *   blocked      — takeoff_status === "blocked"; quantity could not be
 *                  computed (missing required input).
 *   unknown      — none of the above could be determined from the line.
 */
export type CsiProvenance =
  | "calculated"
  | "supplier"
  | "user"
  | "ai_estimated"
  | "blocked"
  | "unknown";

/**
 * The minimal shape this layer reads off an existing review/takeoff line.
 * `QuoteLineItem` (src/lib/quote-types.ts) is structurally assignable to
 * this, so callers pass `quote_data.line_items` straight in.
 */
export interface CsiSourceLine {
  type?: QuoteItemType;
  description: string;
  quantity?: number;
  unit?: string;
  unit_price?: number | null;
  takeoff_status?: TakeoffStatus;
  quantity_source?: "ai" | "calculator" | "supplier" | "user";
  is_calculated_takeoff?: boolean;
  is_ai_estimated?: boolean;
}

/**
 * One source line, mapped to its CSI division + trade bucket. Quantities,
 * prices, status and provenance are CARRIED THROUGH — never computed here.
 */
export interface CsiLineItem {
  /** The source line's description, unchanged (stable identity key). */
  source_description: string;

  division: CsiDivision;
  trade: TradeBucket;

  /**
   * Why it landed in this division — auditable, mirrors the basis[] style
   * used by SheetClassification and LineBasis. e.g.
   * ["name:decking boards"] or ["unmapped:no-rule-matched"].
   */
  mapping_basis: string[];

  /** Carried straight through; mapping NEVER alters quantities. */
  quantity: number | null;
  unit: string | null;
  /** Carried straight through; pricing stays manual (PRICES_OFF). */
  unit_price: number | null;

  /** Carried straight through so blocked/missing state survives the mapping. */
  takeoff_status: TakeoffStatus | null;
  /** Derived ONLY from existing line fields — never guessed. */
  provenance: CsiProvenance;
}

/**
 * A CSI-grouped view of a whole quote — what a Division-grouped Review tab
 * or an export would render. `divisions` only ever contains divisions that
 * have at least one line, in a stable canonical order.
 */
export interface CsiGroupedQuote {
  divisions: Array<{
    division: Exclude<CsiDivision, "uncategorized">;
    lines: CsiLineItem[];
  }>;
  /** Lines that could not be confidently mapped — surfaced for review. */
  uncategorized: CsiLineItem[];
  /** Counts for a quick header, computed from the lines above. */
  totals: {
    mapped: number;
    uncategorized: number;
    blocked: number;
  };
}

/**
 * The mapping function signature map.ts implements. Pure: same input →
 * same output, fully unit-testable, no IO, no model call, no mutation.
 */
export type CsiMapFn = (lines: readonly CsiSourceLine[]) => CsiGroupedQuote;
