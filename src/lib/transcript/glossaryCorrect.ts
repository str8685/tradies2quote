// ─────────────────────────────────────────────────────────────────────────
// Transcript glossary corrector — deterministic, NO LLM, NO I/O.
//
// Two safe phases, both vocabulary-driven:
//   A. EXACT alias / canonical → auto-apply (high confidence). Only ever
//      rewrites a heard term TO a known canonical spelling. Curated aliases
//      are mishears of the same word form, so meaning is preserved.
//   B. FUZZY near-match → FLAG only (clarification). Never rewrites — surfaces
//      "did you mean X?" for novel mishears the user can confirm.
//
// Numbers are never altered: phase B skips any token containing a digit, and
// phase A only applies curated alias mappings (e.g. "mitre ten" → "Mitre 10")
// where the canonical is the explicit, intended form.
// ─────────────────────────────────────────────────────────────────────────

import type {
  VocabEntry,
  VocabSet,
  VocabSource,
  VocabTermType,
} from "./glossary";

export type GlossaryCorrection = {
  before: string;
  after: string;
  index: number;
  type: VocabTermType;
  source: VocabSource;
  reason: string;
  /** 0..1 — how sure we are. Auto-applied corrections are always high. */
  confidence: number;
};

export type GlossaryClarification = {
  id: string;
  question: string;
  why: string;
  phrase: string;
};

export type GlossaryResult = {
  cleanedText: string;
  corrections: GlossaryCorrection[];
  clarifications: GlossaryClarification[];
};

const STOPWORDS = new Set([
  "about", "above", "after", "again", "their", "there", "these", "those",
  "which", "while", "would", "could", "should", "around", "between", "before",
  "where", "there's", "going", "gonna", "right", "metres", "meters",
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary regex for a (possibly multi-word) phrase, whitespace-flexible. */
function phraseRegex(phrase: string): RegExp {
  const parts = phrase.trim().split(/\s+/).map(escapeRe);
  return new RegExp(`\\b${parts.join("\\s+")}\\b`, "gi");
}

/** Levenshtein distance (iterative, two-row). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

const hasDigit = (s: string) => /\d/.test(s);
/** A name worth normalising the casing of: a proper noun (has a cap or digit). */
const isProperNoun = (s: string) => /[A-Z0-9]/.test(s);

/**
 * True when `lower` is just a regular plural of a term we already know exactly
 * (canonical or alias). "weatherboards" → "weatherboard", "joists" → "joist",
 * "fascias" → "fascia", "gantries" → "gantry". These are valid plurals of
 * valid terms — there's nothing to correct, so we suppress the noisy fuzzy
 * "did you mean…" flag rather than nag the tradie about their own correct word.
 * We never AUTO-CORRECT a plural here; only the explicit alias/canonical pass
 * (phase A) ever rewrites, and plurals aren't aliases.
 */
function isRegularPluralOfKnown(lower: string, knownExact: Set<string>): boolean {
  if (lower.length > 4 && lower.endsWith("ies") && knownExact.has(lower.slice(0, -3) + "y")) {
    return true;
  }
  if (lower.length > 3 && lower.endsWith("es") && knownExact.has(lower.slice(0, -2))) {
    return true;
  }
  if (lower.length > 2 && lower.endsWith("s") && knownExact.has(lower.slice(0, -1))) {
    return true;
  }
  return false;
}

// Fuzzy thresholds — auto-apply NEVER uses these (phase A is exact only).
const FUZZY_MIN_LEN = 5;
const FUZZY_MAX_DIST = 2;
const FUZZY_MIN_RATIO = 0.84;
const MAX_CLARIFICATIONS = 6;

/**
 * Apply vocabulary corrections to `text`. Pure and deterministic.
 *
 * Returns the corrected text, the audit log of auto-applied corrections, and
 * clarifications for fuzzy matches that were flagged (not changed).
 */
export function applyGlossaryCorrections(
  rawText: string,
  vocab: VocabSet,
): GlossaryResult {
  const corrections: GlossaryCorrection[] = [];
  const clarifications: GlossaryClarification[] = [];
  if (!rawText || !vocab?.entries?.length) {
    return { cleanedText: rawText ?? "", corrections, clarifications };
  }

  let text = rawText;

  // ── Phase A — exact alias / canonical-casing auto-apply ──────────────────
  // Longest match phrases first so multi-word names win over a sub-word.
  type MatchSpec = { phrase: string; entry: VocabEntry; isCanonical: boolean };
  const specs: MatchSpec[] = [];
  for (const entry of vocab.entries) {
    for (const alias of entry.aliases) {
      if (alias.trim()) specs.push({ phrase: alias, entry, isCanonical: false });
    }
    // Canonical-casing normalisation: only for proper-noun names (suppliers,
    // brands, materials with a capital/digit). Never for lowercase trade words.
    if (entry.type !== "trade_term" && isProperNoun(entry.canonical)) {
      specs.push({ phrase: entry.canonical, entry, isCanonical: true });
    }
  }
  specs.sort(
    (a, b) =>
      b.phrase.split(/\s+/).length - a.phrase.split(/\s+/).length ||
      b.phrase.length - a.phrase.length,
  );

  for (const spec of specs) {
    const re = phraseRegex(spec.phrase);
    text = text.replace(re, (m: string, offset: number) => {
      // No-op if it's already exactly the canonical spelling.
      if (m === spec.entry.canonical) return m;
      corrections.push({
        before: m,
        after: spec.entry.canonical,
        index: offset,
        type: spec.entry.type,
        source: spec.entry.source,
        reason: spec.isCanonical
          ? `normalised casing to ${spec.entry.canonical}`
          : `known variant of ${spec.entry.canonical}`,
        confidence: spec.isCanonical ? 0.9 : 0.95,
      });
      return spec.entry.canonical;
    });
  }

  // ── Phase B — fuzzy near-match flagging (never rewrites) ─────────────────
  // Candidate single-word terms (no digits) → canonical, for "did you mean".
  const candidates: Array<{ term: string; canonical: string; entry: VocabEntry }> = [];
  const knownExact = new Set<string>();
  for (const entry of vocab.entries) {
    const all = [entry.canonical, ...entry.aliases];
    for (const t of all) {
      const lower = t.toLowerCase();
      knownExact.add(lower);
      if (!t.includes(" ") && !hasDigit(t) && t.length >= FUZZY_MIN_LEN) {
        candidates.push({ term: lower, canonical: entry.canonical, entry });
      }
    }
  }

  const flagged = new Set<string>();
  const tokenRe = /[A-Za-z][A-Za-z'-]+/g;
  let mt: RegExpExecArray | null;
  while ((mt = tokenRe.exec(text)) !== null) {
    if (clarifications.length >= MAX_CLARIFICATIONS) break;
    const tok = mt[0];
    const lower = tok.toLowerCase();
    if (tok.length < FUZZY_MIN_LEN || hasDigit(tok)) continue;
    if (STOPWORDS.has(lower) || knownExact.has(lower) || flagged.has(lower)) continue;
    // Don't nag about a correct plural of a known term (weatherboards, joists…).
    if (isRegularPluralOfKnown(lower, knownExact)) continue;

    let best: { canonical: string; entry: VocabEntry; r: number } | null = null;
    for (const c of candidates) {
      if (c.term === lower) {
        best = null;
        break;
      }
      const d = levenshtein(lower, c.term);
      if (d === 0 || d > FUZZY_MAX_DIST) continue;
      const r = ratio(lower, c.term);
      if (r >= FUZZY_MIN_RATIO && (!best || r > best.r)) {
        best = { canonical: c.canonical, entry: c.entry, r };
      }
    }
    if (best && best.canonical.toLowerCase() !== lower) {
      flagged.add(lower);
      clarifications.push({
        id: `transcript.vocab.${mt.index}`,
        question: `Did you mean "${best.canonical}" instead of "${tok}"?`,
        why: `"${best.canonical}" is a known ${best.entry.type.replace("_", " ")} in your vocabulary; "${tok}" is close but not an exact match, so it wasn't changed automatically.`,
        phrase: tok,
      });
    }
  }

  corrections.sort((a, b) => a.index - b.index);
  return { cleanedText: text, corrections, clarifications };
}
