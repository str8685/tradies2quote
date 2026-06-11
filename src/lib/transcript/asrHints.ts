// ─────────────────────────────────────────────────────────────────────────
// Transcript ASR hints — build the OpenAI transcription `prompt` (pure).
//
// The transcription API only "sees" roughly its last ~224 tokens of prompt,
// so a giant static list wastes the budget. We build a JOB-RELEVANT hint
// string: the canonical brand spellings that must never be misheard, then the
// tradie's OWN most-used materials + suppliers, capped to the budget.
//
// Always English NZ-trade framing; the static base is the floor so behaviour
// never regresses if a user has no vocab yet.
// ─────────────────────────────────────────────────────────────────────────

import type { VocabSet, VocabSource } from "./glossary";

/** Conservative char budget (~4 chars/token, well under the 224-token window). */
const MAX_CHARS = 850;

const LEAD =
  "A New Zealand building tradesperson dictating a job for a quote. Vocabulary used heavily: ";

/**
 * The canonical brand/format anchors that must dominate the candidate
 * distribution (the worst, highest-frequency mishears). Always included.
 */
const ALWAYS = [
  "GIB plasterboard (always spelled GIB)",
  "GIB Standard, Aqualine, Braceline",
  "Pink Batts insulation R1.8, R2.2, R3.6",
  "treated timber H1.2, H3.2, H4, H5; 90x45, 140x45 framing",
  "dwangs, nogs, studs, plates, joists, bearers, piles, decking",
  // Bias measurements toward digit forms so downstream dimension
  // extraction (which needs digits) gets them straight off the model.
  "measurements in digits: 3.6 m, 600mm centres",
];

/** The full static fallback — used when there's no user vocab to add. */
export const STATIC_TRADE_VOCAB_PROMPT =
  LEAD +
  ALWAYS.join("; ") +
  "; weatherboard, fascia, soffit, spouting, plywood bracing, macrocarpa, rimu, kwila. " +
  "Suppliers: Mitre 10, PlaceMakers, Bunnings, ITM, Carters.";

/** Source priority for user terms — their own behaviour first. */
const SOURCE_RANK: Record<VocabSource, number> = {
  user_history: 0,
  materials_library: 1,
  supplier: 2,
  global: 3,
};

/**
 * Build the transcription prompt for a user. Anchors first, then the tradie's
 * own materials/suppliers (deduped, prioritised), capped to the char budget.
 */
export function buildAsrPrompt(
  vocab: VocabSet | null | undefined,
  opts: { maxChars?: number } = {},
): string {
  const maxChars = opts.maxChars ?? MAX_CHARS;

  const userTerms = (vocab?.entries ?? [])
    .filter((e) => e.source !== "global")
    .sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])
    .map((e) => e.canonical.trim())
    .filter((c) => c.length > 0);

  // Dedupe case-insensitively, preserving priority order.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const t of userTerms) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(t);
  }

  let prompt = LEAD + ALWAYS.join("; ");
  if (ordered.length === 0) {
    // No user vocab → the full static fallback so we never regress.
    return STATIC_TRADE_VOCAB_PROMPT;
  }

  prompt += ". This tradie commonly uses: ";
  const picked: string[] = [];
  for (const term of ordered) {
    const candidate = picked.length ? `${picked.join(", ")}, ${term}` : term;
    if ((prompt + candidate + ".").length > maxChars) break;
    picked.push(term);
  }
  prompt += picked.join(", ") + ".";
  return prompt;
}
