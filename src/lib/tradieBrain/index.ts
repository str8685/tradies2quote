// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — public barrel + feature flag.
//
// v1 is OBSERVE-ONLY. Ingestion + the owner debug view are gated on owner
// email (the dark gate); they run as soon as deployed so real memories
// accumulate. This flag is RESERVED for the next step — turning on AI
// CONSUMPTION (injecting the memory context block into a prompt) and, later,
// widening ingestion beyond the owner. While it's off, no memory ever reaches
// a model.
// ─────────────────────────────────────────────────────────────────────────

/** OFF unless explicitly enabled. Gates future AI consumption of memory. */
export function tradieBrainEnabledFromEnv(): boolean {
  return process.env.TRADIE_BRAIN_ENABLED === "true";
}

export * from "./types";
export {
  consolidate,
  deriveConfidence,
  normalizeMemoryKey,
  normalizeObservation,
  tokenize,
  type NormalizedObservation,
} from "./normalize";
export {
  deriveMemoriesFromQuoteSave,
  deriveMemoryFromAcceptedPrice,
  inferJobType,
  type QuoteSaveIngest,
  type AcceptedPriceIngest,
} from "./derive";
export { selectRelevant } from "./rank";
export { formatMemoriesForPrompt } from "./format";
