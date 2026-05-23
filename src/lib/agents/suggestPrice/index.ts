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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

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

  // 3. Fuzzy middle ground — ask the model, then strictly validate.
  try {
    const fetchImpl = args.fetchImpl ?? fetch;
    const res = await fetchImpl(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: SUGGEST_PRICE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildSuggestPriceUserMessage(
              target,
              evidence,
              args.memoryContext,
            ),
          },
          { role: "assistant", content: "{" },
        ],
      }),
    });
    if (!res.ok) {
      return safeManualFallback(
        target,
        "Couldn't reach the pricing helper — price this line manually.",
      );
    }
    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    const json = JSON.parse("{" + text);
    return parseSuggestion(json, target);
  } catch {
    return safeManualFallback(
      target,
      "The pricing helper had a hiccup — price this line manually.",
    );
  }
}
