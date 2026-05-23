// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — derive memories from real user actions (pure, NO I/O, NO AI).
//
// This is the "what events teach it" layer. Every memory v1 stores is a
// DETERMINISTIC reading of the tradie's own actions — never an LLM guess. The
// write path has no model in it, which is the strongest possible reading of
// the safety rule ("AI proposes; deterministic code stores"): here we don't
// even let AI propose. Consumption (later) is where memory meets a model.
//
// Inputs are already-computed structures the save flow has on hand: the saved
// QuoteData and the diff vs the frozen AI snapshot. We never recompute money.
// ─────────────────────────────────────────────────────────────────────────

import type { QuoteData, QuoteLineItem } from "../quote-types";
import type { QuoteEditDiff } from "../quoteEditDiff";
import type { MemoryObservation } from "./types";

/** Keywords that mark a note as an exclusion ("what's NOT in the price"). */
const EXCLUSION_HINTS = [
  "exclude",
  "excludes",
  "excluding",
  "excl",
  "not included",
  "not incl",
  "by others",
  "by client",
  "n/a",
];

/**
 * Coarse job-type buckets inferred from a job summary. Deliberately small and
 * deterministic — first match wins. Returns null when nothing matches (we'd
 * rather store no job-type than a wrong one).
 */
const JOB_TYPE_KEYWORDS: Array<[string, RegExp]> = [
  ["deck", /\bdeck(ing)?\b/i],
  ["fence", /\bfenc(e|ing)\b/i],
  ["retaining_wall", /\bretaining\b/i],
  ["pergola", /\bpergola\b/i],
  ["carport", /\bcarport\b/i],
  ["bathroom", /\b(bathroom|ensuite|wet\s?room)\b/i],
  ["kitchen", /\bkitchen\b/i],
  ["roof", /\broof(ing)?\b/i],
  ["cladding", /\bcladd?ing\b/i],
  ["subfloor", /\bsub\s?floor\b/i],
  ["framing", /\bfram(e|ing)\b/i],
  ["gib_stopping", /\b(gib|plasterboard|stopping|gib\s?fix)\b/i],
  ["renovation", /\b(reno|renovat)/i],
];

export function inferJobType(summary: string | null | undefined): string | null {
  const s = (summary ?? "").trim();
  if (!s) return null;
  for (const [type, re] of JOB_TYPE_KEYWORDS) {
    if (re.test(s)) return type;
  }
  return null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Input the quote-save ingestion hook hands to derivation. */
export type QuoteSaveIngest = {
  quote: QuoteData;
  /** Diff vs the frozen AI snapshot, if a human edit happened. */
  diff?: QuoteEditDiff | null;
  quoteId?: string | null;
};

/**
 * Turn a saved quote (+ its edit diff) into the memories it should teach.
 * Returns RAW observations; normalisation/consolidation happens in store.ts.
 * Pure: same input → same output, no clock, no randomness.
 */
export function deriveMemoriesFromQuoteSave(
  input: QuoteSaveIngest,
): MemoryObservation[] {
  const { quote, diff, quoteId = null } = input;
  const out: MemoryObservation[] = [];
  const items = quote?.line_items ?? [];

  // Which line indices were price/description corrections vs the AI snapshot.
  // Used to tag preferred_material observations as "material_correction" and
  // to emit repeated_correction memories.
  const correctedUserIndices = new Map<number, Set<string>>();
  for (const m of diff?.modified ?? []) {
    const fields = new Set(m.fields.map((f) => f.name));
    correctedUserIndices.set(m.user_index, fields);
  }

  // 1. Pricing habit — the markup the tradie actually quotes at.
  const markup = num(quote?.markup_pct);
  if (markup > 0) {
    out.push({
      type: "pricing_habit",
      key: "markup",
      value: { markup_pct: markup },
      source: "manual_pref",
      provenance: { quote_id: quoteId, note: `markup ${markup}%` },
    });
  }

  // 2. Preferred materials — every priced material line on the saved quote.
  //    A line that was corrected vs the AI snapshot is tagged as a correction.
  items.forEach((it: QuoteLineItem, i: number) => {
    if (it.type !== "material") return;
    const name = (it.description ?? "").trim();
    if (!name) return;
    const price = num(it.unit_price);
    if (price <= 0) return;

    const correctedFields = correctedUserIndices.get(i);
    const wasCorrected =
      !!correctedFields &&
      (correctedFields.has("unit_price") || correctedFields.has("description"));

    out.push({
      type: "preferred_material",
      key: name,
      value: { name, unit: it.unit || "each", unit_price: price },
      source: wasCorrected ? "material_correction" : "manual_pref",
      provenance: { quote_id: quoteId, line_index: i },
    });
  });

  // 3. Preferred supplier — from a scanned supplier import.
  const supplier = (quote?.supplier_source?.supplier ?? "").trim();
  if (supplier) {
    out.push({
      type: "preferred_supplier",
      key: supplier,
      value: { supplier },
      source: "manual_pref",
      provenance: { quote_id: quoteId },
    });
  }

  // 4. Common exclusions — notes that read like "what's NOT included".
  for (const rawNote of quote?.notes ?? []) {
    const note = (rawNote ?? "").trim();
    if (!note) continue;
    const lower = note.toLowerCase();
    if (!EXCLUSION_HINTS.some((h) => lower.includes(h))) continue;
    out.push({
      type: "common_exclusion",
      key: note,
      value: { text: note },
      source: "saved_exclusion",
      provenance: { quote_id: quoteId },
    });
  }

  // 5. Job-type preference — from the takeoff type if present, else the summary.
  const jobType =
    quote?.dimension_confirmation?.takeoff_type ??
    inferJobType(quote?.job_summary);
  if (jobType) {
    out.push({
      type: "job_type_preference",
      key: jobType,
      value: { job_type: jobType },
      source: "manual_pref",
      provenance: { quote_id: quoteId },
    });
  }

  // 6. Repeated corrections — description / unit_price the tradie changed away
  //    from what the AI produced. Keyed by field + the corrected line's name so
  //    the SAME recurring fix strengthens over time.
  for (const m of diff?.modified ?? []) {
    const userItem = items[m.user_index];
    const desc = (userItem?.description ?? "").trim();
    for (const f of m.fields) {
      if (f.name !== "unit_price" && f.name !== "description") continue;
      const keyDesc = f.name === "description" ? String(f.to ?? desc) : desc;
      if (!keyDesc.trim()) continue;
      out.push({
        type: "repeated_correction",
        key: `${f.name} ${keyDesc}`,
        value: { field: f.name, from: f.from, to: f.to, description: keyDesc },
        source: "quote_edit",
        provenance: {
          quote_id: quoteId,
          line_index: m.user_index,
          before: f.from,
          after: f.to,
        },
      });
    }
  }

  return out;
}

/** Input for teaching from an accepted Suggest-a-Price result. */
export type AcceptedPriceIngest = {
  name: string;
  unit: string | null;
  price: number;
  quoteId?: string | null;
};

/**
 * Accepting a suggested price is a strong "this is my price for X" signal.
 * Emits a single preferred_material observation tagged accordingly.
 */
export function deriveMemoryFromAcceptedPrice(
  input: AcceptedPriceIngest,
): MemoryObservation[] {
  const name = (input?.name ?? "").trim();
  const price = num(input?.price);
  if (!name || price <= 0) return [];
  return [
    {
      type: "preferred_material",
      key: name,
      value: { name, unit: (input.unit ?? "each") || "each", unit_price: price },
      source: "accepted_suggested_price",
      provenance: { quote_id: input.quoteId ?? null },
    },
  ];
}
