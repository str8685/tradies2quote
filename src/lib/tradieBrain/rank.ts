// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — relevance ranking (pure, NO I/O).
//
// Given all of a user's active memories + a retrieval context, pick the few
// that are actually relevant and order them so RECENT, OFTEN-CONFIRMED
// behaviour outranks stale or generic history. This is the "deterministic
// code ranks" half of the safety contract — the model never decides what it
// gets to see; this function does.
//
//   score = surfaceRelevance × materialOverlap × jobTypeMatch
//             × strength × recency
//
// Anything that scores 0 (wrong surface, zero material overlap when a
// material context was given) is dropped entirely.
// ─────────────────────────────────────────────────────────────────────────

import { deriveConfidence, tokenize } from "./normalize";
import type {
  MemoryType,
  RankedMemory,
  RetrievalContext,
  RetrievalSurface,
  TradieMemory,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 8;

/**
 * Which memory types each surface cares about. A type absent from a surface's
 * list scores 0 there and is dropped — e.g. tone preferences don't belong in
 * a price suggestion. With no surface given, everything is eligible.
 */
const SURFACE_RELEVANCE: Record<RetrievalSurface, Partial<Record<MemoryType, number>>> = {
  quote_generation: {
    job_type_preference: 1.4,
    preferred_material: 1.2,
    preferred_brand: 1.2,
    preferred_supplier: 1.0,
    common_exclusion: 1.2,
    pricing_habit: 1.1,
    tone_preference: 0.9,
    repeated_correction: 1.0,
  },
  quote_review: {
    repeated_correction: 1.4,
    common_exclusion: 1.2,
    preferred_material: 1.0,
    pricing_habit: 1.0,
    job_type_preference: 0.8,
  },
  material_price_suggestion: {
    preferred_material: 1.5,
    preferred_brand: 1.2,
    preferred_supplier: 1.1,
    pricing_habit: 0.9,
    repeated_correction: 0.8,
  },
  followup_drafting: {
    tone_preference: 1.5,
    common_exclusion: 0.9,
    job_type_preference: 0.8,
  },
};

/** Jaccard token overlap between two strings (0..1). */
function tokenOverlap(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Recency multiplier — ~monthly half-decay, never below a small floor. */
function recencyWeight(lastSeenIso: string, now: number): number {
  const t = Date.parse(lastSeenIso);
  if (!Number.isFinite(t)) return 0.5;
  const days = Math.max(0, (now - t) / DAY_MS);
  return 1 / (1 + days / 30);
}

/** Material-ish memories whose key should be matched against line descriptions. */
const MATERIALY: ReadonlySet<MemoryType> = new Set<MemoryType>([
  "preferred_material",
  "preferred_brand",
  "repeated_correction",
]);

/**
 * Rank a user's memories for a given context. Pure and deterministic given
 * `now` (defaults to the wall clock; tests pass a fixed value). Only `active`
 * memories should be passed in — callers filter on read.
 */
export function selectRelevant(
  memories: TradieMemory[],
  context: RetrievalContext = {},
  now: number = Date.now(),
): RankedMemory[] {
  const surface = context.surface;
  const jobType = context.jobType ? tokenize(context.jobType).join(" ") : null;
  const descriptions = context.materialDescriptions ?? [];
  const limit = context.limit ?? DEFAULT_LIMIT;

  const ranked: RankedMemory[] = [];

  for (const m of memories) {
    if (m.status !== "active") continue;

    // 1. Surface relevance (drops wrong-surface types).
    const surfaceWeight = surface
      ? SURFACE_RELEVANCE[surface][m.memory_type] ?? 0
      : 1;
    if (surfaceWeight <= 0) continue;

    // 2. Material overlap — only constrains material-ish types when the caller
    //    actually passed line descriptions. Otherwise neutral (1).
    let overlapWeight = 1;
    if (MATERIALY.has(m.memory_type) && descriptions.length > 0) {
      let best = 0;
      for (const d of descriptions) best = Math.max(best, tokenOverlap(m.memory_key, d));
      if (best <= 0) continue; // material context given but this one is irrelevant
      overlapWeight = 0.4 + best; // 0.4 floor so any hit still ranks
    }

    // 3. Job-type match — boost the matching job_type_preference, gently
    //    demote the others when a job type was supplied.
    let jobWeight = 1;
    if (jobType && m.memory_type === "job_type_preference") {
      jobWeight = m.memory_key === jobType ? 1.6 : 0.3;
    }

    const strength = Math.max(1, Number(m.strength) || 1);
    const recency = recencyWeight(m.last_seen_at, now);
    const score = surfaceWeight * overlapWeight * jobWeight * strength * recency;
    if (score <= 0) continue;

    ranked.push({ ...m, confidence: deriveConfidence(strength), score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
