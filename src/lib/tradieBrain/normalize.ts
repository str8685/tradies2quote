// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — pure normalisation + consolidation helpers (no I/O).
//
// These decide the dedup KEY for a memory (so the same fact, phrased two
// ways, lands on one row), derive confidence from strength, validate an
// observation before it can be stored, and compute the consolidation update
// when an existing memory is re-observed.
// ─────────────────────────────────────────────────────────────────────────

import {
  MEMORY_SOURCES,
  MEMORY_TYPES,
  type MemoryConfidence,
  type MemoryObservation,
  type MemoryType,
  type TradieMemory,
} from "./types";

/** Short, common words that add noise to a material/brand key. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "for",
  "with",
  "per",
  "each",
  "to",
]);

/**
 * Lowercase, strip punctuation, drop stopwords. Used both for key building
 * and (in rank.ts) for relevance overlap. Numbers and dimension tokens like
 * "90x45" survive because we only split on non-alphanumeric runs.
 */
export function tokenize(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * Canonical dedup key for a memory, within (user_id, memory_type).
 *
 * Free-text types (material / brand / supplier / exclusion / correction) get
 * a tokenised, stopword-stripped, single-spaced form so trivially-different
 * phrasings collapse onto one row. Controlled types (pricing_habit,
 * job_type_preference) get a light trim/lowercase — their keys are already
 * short controlled tokens. Returns "" when nothing usable remains; callers
 * treat an empty key as "skip this observation".
 */
export function normalizeMemoryKey(_type: MemoryType, raw: string): string {
  const tokens = tokenize(raw);
  return tokens.join(" ");
}

/** strength → confidence. Deterministic; never stored, always derived. */
export function deriveConfidence(strength: number): MemoryConfidence {
  const s = Number(strength) || 0;
  if (s >= 4) return "high";
  if (s >= 2) return "medium";
  return "low";
}

/** A validated observation with its canonical key resolved. */
export type NormalizedObservation = MemoryObservation & { key: string };

/**
 * Validate + canonicalise one observation. Returns null for anything unsafe
 * to store: unknown type/source, empty key after normalisation, or a
 * non-object value. This is the gate that keeps junk out of the table.
 */
export function normalizeObservation(
  obs: MemoryObservation,
): NormalizedObservation | null {
  if (!obs || !MEMORY_TYPES.includes(obs.type)) return null;
  if (!MEMORY_SOURCES.includes(obs.source)) return null;
  if (!obs.value || typeof obs.value !== "object" || Array.isArray(obs.value)) {
    return null;
  }
  const key = normalizeMemoryKey(obs.type, obs.key);
  if (!key) return null;
  return { ...obs, key };
}

/**
 * The fields to write when an EXISTING memory is re-observed. Strength goes
 * up by one, the value is shallow-merged (latest wins per key), provenance
 * and source reflect the newest observation, and an archived memory is
 * reactivated. Pure — store.ts maps this onto a DB update.
 */
export function consolidate(
  existing: Pick<TradieMemory, "strength" | "value">,
  obs: NormalizedObservation,
  nowIso: string,
): {
  strength: number;
  value: Record<string, unknown>;
  source: MemoryObservation["source"];
  provenance: MemoryObservation["provenance"];
  last_seen_at: string;
  updated_at: string;
  status: "active";
} {
  return {
    strength: (Number(existing.strength) || 0) + 1,
    value: { ...(existing.value ?? {}), ...obs.value },
    source: obs.source,
    provenance: obs.provenance ?? {},
    last_seen_at: nowIso,
    updated_at: nowIso,
    status: "active",
  };
}
