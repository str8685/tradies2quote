// ─────────────────────────────────────────────────────────────────────────
// Suggest-a-Price agent — shared types.
//
// ADVISORY ONLY. Nothing in this agent ever sets a price, edits a material,
// or changes a quote total. It returns a SUGGESTION the tradie confirms
// (use once / save to library / ignore). The "advisory_only: true" flag is
// part of the contract and the result type makes it impossible to encode a
// "set" action — only suggestions + recommended UI actions.
// ─────────────────────────────────────────────────────────────────────────

export type SuggestStatus =
  | "suggested"
  | "needs_manual_pricing"
  | "no_safe_match";

export type SuggestConfidence = "high" | "medium" | "low" | "none";

export type RecommendedAction =
  | "use_once"
  | "save_to_library"
  | "ask_user"
  | "manual_price";

export type EvidenceSourceType =
  | "library"
  | "corrected_history"
  | "quote_history"
  | "supplier_import"
  | "generic";

/** The line the tradie wants priced. */
export type SuggestPriceTargetLine = {
  description: string;
  quantity: number;
  unit: string | null;
  trade_scope?: string | null;
  job_type?: string | null;
  supplier_hint?: string | null;
};

/** One internal price data-point the assembler found (no LLM involved). */
export type EvidenceCandidate = {
  source: EvidenceSourceType;
  material_id: string | null;
  name: string;
  unit: string | null;
  unit_price: number | null;
  supplier: string | null;
  /** Token-overlap similarity to the target, 0..1. */
  score: number;
  /** True when the candidate unit matches (or the target has no unit). */
  unitCompatible: boolean;
  note: string;
};

export type PricingEvidence = {
  /** All candidates above the relevance floor, ranked by score desc. */
  candidates: EvidenceCandidate[];
  /**
   * A deterministic, confident library match (matchToLibrary picked it AND it
   * has a price AND the unit is compatible). When present the agent can
   * short-circuit and skip the LLM entirely.
   */
  strongLibraryMatch: EvidenceCandidate | null;
};

export type EvidenceRankItem = {
  source_type: EvidenceSourceType;
  source_label: string;
  strength: "strong" | "medium" | "weak";
  note: string;
};

export type SuggestAlternative = {
  name: string;
  material_id: string | null;
  suggested_unit_price: number | null;
  confidence: "high" | "medium" | "low";
  why_not_top_choice: string;
};

export type SuggestPriceResult = {
  agent: "suggest_a_price";
  version: "1.0";
  advisory_only: true;
  target_line: {
    description: string;
    quantity: number;
    unit: string | null;
    trade_scope: string | null;
    job_type: string | null;
  };
  recommendation: {
    status: SuggestStatus;
    best_match_name: string | null;
    best_match_material_id: string | null;
    suggested_unit_price: number | null;
    suggested_price_range_low: number | null;
    suggested_price_range_high: number | null;
    currency: "NZD";
    confidence: SuggestConfidence;
    should_save_mapping_if_accepted: boolean;
    recommended_action: RecommendedAction;
  };
  reasoning: {
    summary: string;
    evidence_ranked: EvidenceRankItem[];
    risk_flags: string[];
    missing_information: string[];
  };
  alternatives: SuggestAlternative[];
  ui_actions: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
};

export const UI_ACTIONS = {
  primary: "Use suggested price",
  secondary: "Save to library",
  tertiary: "Price manually",
} as const;
