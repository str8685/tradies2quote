/**
 * NZ Building Compliance Knowledge Layer — public type contract.
 *
 * This module defines the data shapes used by the rules engine, the
 * pipeline, and the safe wrapper. Nothing here imports from `react`,
 * `next`, or Supabase — the engine is pure TS and is unit-tested in
 * plain Node.
 *
 * Design principles:
 *
 *   1. **Deterministic**. All rules are pure functions over a typed
 *      `JobContext` + `QuoteLineItem[]`. Same inputs → same outputs.
 *
 *   2. **Never silently choose code-critical materials**. When context is
 *      missing, the engine emits `ClarificationQuestion`s rather than
 *      guessing. Items that depend on missing context are marked with
 *      `source_type: "missing_context"`.
 *
 *   3. **Failsafe**. The safe wrapper turns any unexpected error into a
 *      passthrough fallback so quote generation never breaks (mirrors
 *      `materialMatchingPipeline.safelyEnrichLineItemsWithCatalogue`).
 *
 *   4. **Public-quote safety**. None of these types touch
 *      `PublicLineItem`/`PublicQuotePayload`; the existing 6-field public
 *      contract is preserved by construction (see
 *      `compliance/public-quote-stripping.test.ts`).
 */

import type { QuoteLineItem } from "../quote-types";

// ============================================================================
// Job context — the "what kind of job is this?" payload.
//
// Populated from a combination of:
//   - the AI's parsed transcript (raw description)
//   - explicit user answers to clarification questions
//   - per-item hints (treatment class extracted from the description)
// ============================================================================

/**
 * Wall classification. NZ Building Code clauses B1 (Structure), B2
 * (Durability), E2 (External Moisture), and H1 (Energy Efficiency) all
 * pivot on these distinctions; conflating them produces unsafe quotes.
 */
export type WallType = "internal" | "external" | "unknown";

/** Lining types we can reason about today. Extend as needed. */
export type WallLining =
  | "gib_standard"
  | "gib_aqualine" // wet-area
  | "gib_braceline"
  | "gib_noiseline"
  | "plywood"
  | "tongue_groove"
  | "other"
  | "unknown";

/** Cladding types we can reason about today. */
export type WallCladding =
  | "weatherboard"
  | "fibre_cement"
  | "brick_veneer"
  | "metal"
  | "plaster"
  | "other"
  | "unknown";

/**
 * Wall context — every field optional so the engine can detect what's
 * missing and emit a clarification question for it (rule category E).
 */
export type WallContext = {
  /** internal vs external — drives B2/E2/H1 logic. */
  type?: WallType;
  /** Loadbearing? → B1. */
  isLoadbearing?: boolean;
  /** Bracing wall? → B1 / NZS 3604 bracing. */
  isBracing?: boolean;
  /** Wet area (bathroom/laundry/kitchen splashback)? → E2 / GIB Aqualine. */
  isWetArea?: boolean;
  /** Part of the thermal envelope? → H1 insulation requirement. */
  isThermalEnvelope?: boolean;
  /** Cladding system (external) — drives B2 + E2 cavity decisions. */
  cladding?: WallCladding;
  /** Lining system (internal) — drives lining + fastener choice. */
  lining?: WallLining;
  /** Stud spacing in mm — NZS 3604 framing tables key off this. */
  studSpacingMm?: number;
  /** Required acoustic/fire rating? → driving GIB Noiseline / fire systems. */
  acousticOrFireRequired?: boolean;
};

/**
 * The job context an AI quote should be reviewed against. The engine
 * inspects this to decide whether enough is known to safely sign off
 * code-critical material decisions.
 *
 * `wall` is optional — not every quote is a wall job. When absent and the
 * description names a wall, the engine emits clarification questions.
 */
export type JobContext = {
  /** The original user description (transcript or typed). */
  description: string;
  /** Wall-related context. Extend with `roof`, `floor`, `deck`, etc. later. */
  wall?: WallContext;
};

// ============================================================================
// Knowledge base — approved sources cited by rules.
//
// We do NOT scrape the web at quote time. Instead we maintain a typed,
// versioned list of authoritative chunks. Each rule that depends on an
// authoritative source attaches the matching `Citation`s to its output.
// ============================================================================

/** Top-level taxonomy of knowledge sources we accept. */
export type KnowledgeSourceType =
  | "nz_building_code" // B1, B2, E2, H1
  | "nz_standard" // NZS 3604, NZS 3602, NZS 3640
  | "branz_guidance"
  | "manufacturer_install" // GIB, MiTek
  | "supplier_catalogue"; // Mitre 10 — material names only, NOT code authority

/** Confidence in the chunk relative to the rule it supports. */
export type ChunkConfidence = "high" | "medium" | "low";

/**
 * One approved source chunk. The engine references chunks by id from
 * within rule outputs (see `Citation`).
 */
export type KnowledgeSource = {
  /** Stable id (e.g. "nzs-3604-7-1-2"). */
  id: string;
  /** Source family (B1/B2/E2/H1, NZS 3604, GIB, etc.). */
  source_type: KnowledgeSourceType;
  /** Human-readable name (e.g. "NZS 3604:2011"). */
  name: string;
  /** Document version / edition (e.g. "2011 (Amend 2 2022)"). */
  version: string;
  /** Clause / page / section reference within the doc. */
  reference: string;
  /** Plain-English summary of what this chunk says. */
  summary: string;
  /** Confidence in the chunk relative to the rule applying it. */
  confidence: ChunkConfidence;
  /**
   * Notes for compliance officers. NOT shown on the public quote
   * (stripped by construction — see ComplianceLineItem).
   */
  internal_notes?: string;
};

/** A reference from a rule output back to a knowledge source. */
export type Citation = {
  /** Reference to KnowledgeSource.id. */
  source_id: string;
  /** Why this source applies to the rule output. */
  reason: string;
};

// ============================================================================
// Rule outputs — what each rule returns for the pipeline to fold together.
// ============================================================================

/** Severity scale for warnings. */
export type Severity = "info" | "warning" | "blocker";

export type ComplianceWarning = {
  severity: Severity;
  /** Short title e.g. "Treatment class unspecified". */
  title: string;
  /** Longer message for the review panel. */
  message: string;
  /** Which line item this warning attaches to, if any. */
  line_item_index?: number;
  /** Citations supporting the warning. */
  citations: Citation[];
};

/**
 * A clarification question the user must answer before the engine can
 * confidently sign off the quote. The UI renders these in the compliance
 * review panel; the user's answers are folded back into `JobContext`
 * when the quote is regenerated.
 */
export type ClarificationQuestion = {
  /** Stable id (e.g. "wall.type"). Used by the UI to round-trip answers. */
  id: string;
  /** Question text shown to the user. */
  question: string;
  /** What the engine will do with the answer (`why does this matter?`). */
  why: string;
  /**
   * Optional shortlist of allowed answers — when present, the UI can
   * render a select/radio rather than a free-text field.
   */
  options?: { value: string; label: string }[];
};

// ============================================================================
// Per-item compliance metadata — folded onto QuoteLineItem.
//
// CRITICAL: these fields are widened onto `QuoteLineItem` (engine-side)
// but NOT onto `PublicLineItem` (customer-side). The public 6-field
// contract is enforced by `materialMatchingPipeline.test.ts`'s type-level
// test and by the Supabase RPC `get_quote_by_token`'s explicit projection.
// ============================================================================

/**
 * Where a material decision came from. `source_type` lives on each
 * compliance-reviewed line item.
 *
 *   - "rule"            → engine confirmed this against a deterministic rule
 *   - "catalogue"       → matched a global catalogue row (catalogue_seed/Mitre 10)
 *   - "user_library"    → matched the tradie's own materials library
 *   - "ai_estimate"     → AI generated, no rule applies one way or the other
 *   - "missing_context" → AI guessed, but a rule says context is required
 *                         before this can be confirmed
 */
export type ComplianceSourceType =
  | "rule"
  | "catalogue"
  | "user_library"
  | "ai_estimate"
  | "missing_context";

/**
 * Compliance metadata layered on top of a QuoteLineItem. The engine
 * never replaces fields on the underlying item; it only enriches them.
 */
export type ComplianceLineItemMeta = {
  /** Human-readable reason this item is on the quote. */
  reason: string;
  /** Confidence: matches `ChunkConfidence` so we can roll up. */
  confidence: ChunkConfidence;
  /** Provenance — see `ComplianceSourceType`. */
  compliance_source_type: ComplianceSourceType;
  /** Plain-English notes for the review panel (not the public quote). */
  compliance_notes?: string[];
  /** Concrete confirmations the user must give before this is safe. */
  required_confirmations?: string[];
  /** Citations to knowledge-base chunks. */
  citations?: Citation[];
};

/** A QuoteLineItem with optional compliance metadata folded onto it. */
export type ComplianceLineItem = QuoteLineItem & ComplianceLineItemMeta;

// ============================================================================
// Pipeline result — what the engine returns to the route handler.
// ============================================================================

export type ComplianceStatus =
  | "ok" // engine has nothing to flag
  | "needs_clarification" // engine has questions before signing off
  | "warnings_only" // signed off but with non-blocking warnings
  | "disabled" // feature flag is off — passthrough
  | "error"; // safe-wrapper fallback

export type ComplianceReview = {
  status: ComplianceStatus;
  /** Items as enriched by the engine (with optional compliance meta). */
  items: ComplianceLineItem[];
  /** Questions the user must answer (empty when status !== "needs_clarification"). */
  clarifications: ClarificationQuestion[];
  /** Warnings (any severity) emitted by rules. */
  warnings: ComplianceWarning[];
  /** Distinct citations rolled up across all rules. */
  citations: Citation[];
  /**
   * Diagnostics for server logs only. NOT serialised to the customer or
   * the public quote.
   */
  diagnostics: {
    enabled: boolean;
    fallback?: "disabled" | "error";
    fallbackReason?: string;
    rulesRun: string[];
  };
};

/** Used by individual rule modules; the pipeline merges these. */
export type RuleOutput = {
  /** Rule-name diagnostic for `ComplianceReview.diagnostics.rulesRun`. */
  ruleName: string;
  /** Per-item enrichments keyed by index in the input array. */
  itemUpdates: Record<number, Partial<ComplianceLineItemMeta>>;
  warnings: ComplianceWarning[];
  clarifications: ClarificationQuestion[];
};
