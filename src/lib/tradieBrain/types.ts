// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — shared types.
//
// A private per-user memory layer. Every memory is a small structured fact
// the app learned from the tradie's OWN actions (saving a quote, correcting a
// material, accepting a suggested price). Memories are advisory and contextual
// only — nothing here computes a total, edits a quote, or sends anything.
//
// Storage is one row per CONSOLIDATED memory keyed by
// (user_id, memory_type, memory_key); see store.ts for the consolidation.
// ─────────────────────────────────────────────────────────────────────────

/** Kinds of fact Tradie Brain can hold. Mirrors `memory_type` in the table. */
export const MEMORY_TYPES = [
  "preferred_material",
  "preferred_brand",
  "preferred_supplier",
  "common_exclusion",
  "pricing_habit",
  "tone_preference",
  "repeated_correction",
  "job_type_preference",
  "quote_outcome",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Which real user action taught a memory. Mirrors `source` in the table. */
export const MEMORY_SOURCES = [
  "quote_edit",
  "material_correction",
  "accepted_suggested_price",
  "saved_exclusion",
  "manual_pref",
  "quote_outcome",
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

/** Confidence is DERIVED from strength on read — never stored. */
export type MemoryConfidence = "low" | "medium" | "high";

export type MemoryStatus = "active" | "archived";

/** Where the most-recent observation came from. */
export type MemoryProvenance = {
  quote_id?: string | null;
  line_index?: number | null;
  before?: string | number | null;
  after?: string | number | null;
  note?: string | null;
};

/**
 * A single thing the app observed. The pure `derive*` functions emit these;
 * `store.writeMemories` normalises + consolidates them into rows. `key` is the
 * RAW key (pre-normalisation) — normalize.ts canonicalises it.
 */
export type MemoryObservation = {
  type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  source: MemorySource;
  provenance?: MemoryProvenance;
};

/** A persisted, consolidated memory row. */
export type TradieMemory = {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  memory_key: string;
  value: Record<string, unknown>;
  strength: number;
  source: MemorySource;
  provenance: MemoryProvenance;
  status: MemoryStatus;
  first_seen_at: string;
  last_seen_at: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Which product surface is asking for memories (drives relevance weighting). */
export type RetrievalSurface =
  | "quote_generation"
  | "quote_review"
  | "material_price_suggestion"
  | "followup_drafting";

/** Context the caller passes to retrieval so ranking can be relevant. */
export type RetrievalContext = {
  /** Coarse job type, e.g. "deck", "bathroom" (see inferJobType). */
  jobType?: string | null;
  /** Line descriptions, to match preferred_material / repeated_correction. */
  materialDescriptions?: string[];
  surface?: RetrievalSurface;
  /** Max memories to return (default 8). */
  limit?: number;
};

/** A memory plus its derived confidence and the relevance score it ranked at. */
export type RankedMemory = TradieMemory & {
  confidence: MemoryConfidence;
  score: number;
};
