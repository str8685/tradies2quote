// ─────────────────────────────────────────────────────────────────────────
// Suggest-a-Price agent — orchestrator.
//
//   assemble evidence (deterministic)
//     → strong library match?  → suggest it directly, NO LLM (cheapest/safest)
//     → no internal evidence?  → manual pricing, NO LLM (conservative)
//     → otherwise              → ask Claude, then STRICT-validate the output
//
// Advisory only end-to-end: the most this returns is a suggestion the tradie
// confirms. Any error falls back to a safe manual-pricing result — it never
// throws into the caller and never sets a price.
// ─────────────────────────────────────────────────────────────────────────

import type { LibraryMaterial } from "../../quote-types";
import { runStructuredAgent } from "../runtime";
import { assembleEvidence, type HistoryLine } from "./evidence";
import { parseSuggestion, safeManualFallback } from "./parse";
import { SUGGEST_PRICE_SYSTEM_PROMPT, buildSuggestPriceUserMessage } from "./prompt";
import {
  UI_ACTIONS,
  type EvidenceCandidate,
  type SuggestPriceResult,
  type SuggestPriceTargetLine,
} from "./types";

export { assembleEvidence } from "./evidence";
export type { HistoryLine } from "./evidence";
export { parseSuggestion, safeManualFallback } from "./parse";
export type {
  SuggestPriceResult,
  SuggestPriceTargetLine,
} from "./types";

/** Feature flag — OFF unless explicitly enabled. */
export function suggestPriceAgentEnabledFromEnv(): boolean {
  return process.env.SUGGEST_PRICE_AGENT_ENABLED === "true";
}

const MAX_TOKENS = 1024;

/**
 * The tool the model is forced to call. parseSuggestion() is fully tolerant of
 * partial/odd input (it always returns a valid result or a safe manual
 * fallback), so the schema guides the model without needing to be exhaustive.
 */
const SUGGEST_PRICE_TOOL = {
  name: "emit_price_suggestion",
  description: "Return the price suggestion (or a manual-pricing fallback).",
  schema: {
    type: "object",
    required: ["recommendation", "reasoning"],
    properties: {
      recommendation: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["suggested", "needs_manual_pricing", "no_safe_match"],
          },
          best_match_name: { type: ["string", "null"] },
          best_match_material_id: { type: ["string", "null"] },
          suggested_unit_price: { type: ["number", "null"] },
          suggested_price_range_low: { type: ["number", "null"] },
          suggested_price_range_high: { type: ["number", "null"] },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low", "none"],
          },
          should_save_mapping_if_accepted: { type: "boolean" },
          recommended_action: {
            type: "string",
            enum: ["use_once", "save_to_library", "ask_user", "manual_price"],
          },
        },
      },
      reasoning: {
        type: "object",
        properties: {
          summary: { type: "string" },
          evidence_ranked: { type: "array", items: { type: "object" } },
          risk_flags: { type: "array", items: { type: "string" } },
          missing_information: { type: "array", items: { type: "string" } },
        },
      },
      alternatives: { type: "array", items: { type: "object" } },
    },
  },
};

export type SuggestPriceArgs = {
  target: SuggestPriceTargetLine;
  library: LibraryMaterial[];
  history?: HistoryLine[];
  apiKey: string;
  /**
   * Tradie Brain (optional) — advisory context block from the tradie's own
   * past patterns. Used ONLY in the fuzzy LLM branch; it never changes the
   * deterministic short-circuits (a strong library match still wins, and zero
   * internal evidence still routes to manual — memory never conjures a
   * suggestion from nothing in v1).
   */
  memoryContext?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
};

function strongMatchResult(
  target: SuggestPriceTargetLine,
  m: EvidenceCandidate,
): SuggestPriceResult {
  const base = safeManualFallback(target);
  return {
    ...base,
    recommendation: {
      status: "suggested",
      best_match_name: m.name,
      best_match_material_id: m.material_id,
      suggested_unit_price: m.unit_price,
      suggested_price_range_low: null,
      suggested_price_range_high: null,
      currency: "NZD",
      confidence: "high",
      should_save_mapping_if_accepted: false, // already in the library
      recommended_action: "use_once",
    },
    reasoning: {
      summary: `Exact match in your library: "${m.name}"${m.unit_price != null ? ` at NZD ${m.unit_price}` : ""}.`,
      evidence_ranked: [
        {
          source_type: "library",
          source_label: "Your materials library",
          strength: "strong",
          note: "exact name + compatible unit",
        },
      ],
      risk_flags: [],
      missing_information: [],
    },
    ui_actions: { ...UI_ACTIONS },
  };
}

export async function suggestPrice(
  args: SuggestPriceArgs,
): Promise<SuggestPriceResult> {
  const { target, library, history, apiKey } = args;
  const evidence = assembleEvidence(target, { library, history });

  // 1. Deterministic short-circuit — strong, priced, unit-compatible library
  //    match. No LLM call.
  if (evidence.strongLibraryMatch) {
    return strongMatchResult(target, evidence.strongLibraryMatch);
  }

  // 2. No internal evidence at all — don't pay an LLM to guess. Route to
  //    manual; once the tradie prices it, it's remembered for next time.
  if (evidence.candidates.length === 0) {
    return safeManualFallback(
      target,
      "No match in your library or recent quotes for this line — price it manually and it'll be remembered.",
    );
  }

  // 3. Fuzzy middle ground — ask the model via the shared runtime (structured
  //    tool output + prompt caching + monitor logging), then strictly validate.
  //    parseSuggestion is tolerant, so the runtime never needs to retry; any
  //    transport/shape error falls back to safe manual pricing — never throws.
  try {
    const result = await runStructuredAgent<SuggestPriceResult>({
      agentName: "Suggest Price",
      system: SUGGEST_PRICE_SYSTEM_PROMPT,
      user: buildSuggestPriceUserMessage(target, evidence, args.memoryContext),
      tool: SUGGEST_PRICE_TOOL,
      parse: (input) => ({ ok: true, value: parseSuggestion(input, target) }),
      maxTokens: MAX_TOKENS,
      apiKey,
      fetchImpl: args.fetchImpl,
    });
    return result.value;
  } catch {
    return safeManualFallback(
      target,
      "The pricing helper had a hiccup — price this line manually.",
    );
  }
}
