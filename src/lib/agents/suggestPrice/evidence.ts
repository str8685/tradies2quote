// ─────────────────────────────────────────────────────────────────────────
// Suggest-a-Price agent — deterministic evidence assembler.
//
// Pure: given the target line + the tradie's own data (library + recent
// history), it ranks internal price evidence. No LLM, no I/O. The route
// fetches the data; this just scores it. The agent then either short-circuits
// on a strong library match (no LLM) or hands the ranked evidence to the
// model for the fuzzy cases.
// ─────────────────────────────────────────────────────────────────────────

import { matchToLibrary } from "../../materials";
import type { LibraryMaterial } from "../../quote-types";
import type {
  EvidenceCandidate,
  EvidenceSourceType,
  PricingEvidence,
  SuggestPriceTargetLine,
} from "./types";

/** A recent priced line from the tradie's history (assembled by the route). */
export type HistoryLine = {
  source: "corrected_history" | "quote_history" | "supplier_import";
  material_id?: string | null;
  name: string;
  unit: string | null;
  unit_price: number | null;
  supplier?: string | null;
};

/** Below this token-overlap a candidate is too unrelated to surface. */
export const RELEVANCE_FLOOR = 0.34;
/** At/above this, a library match is treated as a confident exact-ish hit. */
export const STRONG_SCORE = 0.6;
export const MAX_CANDIDATES = 6;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "per", "each", "of", "to", "from", "by", "a",
]);

function tokens(s: string): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );
}

/** Jaccard overlap of two token sets, 0..1. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normUnit(u: string | null | undefined): string {
  return (u ?? "").trim().toLowerCase();
}

function unitCompatible(targetUnit: string | null, candUnit: string | null): boolean {
  const t = normUnit(targetUnit);
  if (!t) return true; // no target unit stated → don't penalise
  return t === normUnit(candUnit);
}

function buildCandidate(
  source: EvidenceSourceType,
  o: {
    material_id: string | null;
    name: string;
    unit: string | null;
    unit_price: number | null;
    supplier: string | null;
  },
  descTokens: Set<string>,
  targetUnit: string | null,
): EvidenceCandidate {
  const score = similarity(descTokens, tokens(o.name));
  return {
    source,
    material_id: o.material_id,
    name: o.name,
    unit: o.unit,
    unit_price: o.unit_price,
    supplier: o.supplier,
    score: Math.round(score * 100) / 100,
    unitCompatible: unitCompatible(targetUnit, o.unit),
    note:
      o.unit_price == null
        ? "matched by name; no price stored"
        : `matched by name @ ${o.unit_price}`,
  };
}

/**
 * Rank the tradie's internal price evidence for a target line. Returns the
 * relevant candidates (desc by score, priced preferred at a tie) plus a
 * deterministic strong library match when one exists.
 */
export function assembleEvidence(
  target: SuggestPriceTargetLine,
  data: { library: LibraryMaterial[]; history?: HistoryLine[] },
): PricingEvidence {
  const descTokens = tokens(target.description);
  const library = data.library ?? [];
  const history = data.history ?? [];

  const all: EvidenceCandidate[] = [];

  for (const m of library) {
    all.push(
      buildCandidate(
        "library",
        {
          material_id: m.id,
          name: m.name,
          unit: m.unit,
          unit_price:
            m.default_unit_price != null ? Number(m.default_unit_price) : null,
          supplier: m.supplier ?? null,
        },
        descTokens,
        target.unit,
      ),
    );
  }
  for (const h of history) {
    all.push(
      buildCandidate(
        h.source,
        {
          material_id: h.material_id ?? null,
          name: h.name,
          unit: h.unit,
          unit_price: h.unit_price,
          supplier: h.supplier ?? null,
        },
        descTokens,
        target.unit,
      ),
    );
  }

  const candidates = all
    .filter((c) => c.score >= RELEVANCE_FLOOR)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie → prefer a priced candidate, then unit-compatible.
      const ap = a.unit_price != null ? 1 : 0;
      const bp = b.unit_price != null ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return Number(b.unitCompatible) - Number(a.unitCompatible);
    })
    .slice(0, MAX_CANDIDATES);

  // Deterministic strong match: the proven token matcher picks it AND it has
  // a price AND the unit is compatible. This is the only no-LLM short-circuit.
  let strongLibraryMatch: EvidenceCandidate | null = null;
  const picked = matchToLibrary(target.description, library);
  if (picked && picked.default_unit_price != null) {
    const cand = buildCandidate(
      "library",
      {
        material_id: picked.id,
        name: picked.name,
        unit: picked.unit,
        unit_price: Number(picked.default_unit_price),
        supplier: picked.supplier ?? null,
      },
      descTokens,
      target.unit,
    );
    if (cand.unitCompatible && cand.score >= STRONG_SCORE) {
      strongLibraryMatch = { ...cand, note: "exact library match" };
    }
  }

  return { candidates, strongLibraryMatch };
}
