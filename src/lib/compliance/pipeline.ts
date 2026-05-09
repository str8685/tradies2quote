/**
 * Compliance pipeline — orchestrates all rule categories and folds the
 * results into a single `ComplianceReview`.
 *
 * Design:
 *
 *   1. Each rule module returns a `RuleOutput` (per-item enrichments,
 *      warnings, clarifications). The pipeline runs them in a fixed
 *      order over the SAME input — they don't see each other's output,
 *      which makes them composable and reorderable.
 *
 *   2. Item enrichments are merged onto a `ComplianceLineItem[]` shadow
 *      of the input. Existing fields on the line item are NEVER
 *      overwritten — the engine only adds compliance metadata.
 *
 *   3. Clarifications and warnings are concatenated. The pipeline
 *      computes a top-level `status` from the merged outputs:
 *        - "needs_clarification" if any rule produced clarifications
 *        - "warnings_only" if no clarifications but ≥1 warning
 *        - "ok" otherwise
 *
 *   4. Citations are deduplicated by `source_id + reason`.
 *
 * Failure handling: this function NEVER throws. Errors inside rule
 * modules are caught and folded into a "fallback" diagnostic. The safe
 * wrapper around this pipeline (see `safe-wrapper.ts`) provides a
 * second layer of protection at the route-handler boundary.
 */

import type { QuoteLineItem } from "../quote-types";
import { runClarificationRules } from "./clarification";
import { runFastenerRules } from "./fastener-rules";
import { runInsulationRules } from "./insulation-rules";
import { runTreatmentRules } from "./treatment-rules";
import type {
  Citation,
  ClarificationQuestion,
  ComplianceLineItem,
  ComplianceLineItemMeta,
  ComplianceReview,
  ComplianceWarning,
  JobContext,
  RuleOutput,
} from "./types";

/** Fixed order in which rules run. */
const RULES_IN_ORDER = [
  runTreatmentRules,
  runInsulationRules,
  runFastenerRules,
];

/**
 * Merge a partial compliance meta onto an existing partial. Newer fields
 * win (later rules win), but `compliance_notes` and `required_confirmations`
 * concatenate, and `citations` deduplicate.
 */
function mergeMeta(
  prev: Partial<ComplianceLineItemMeta>,
  next: Partial<ComplianceLineItemMeta>,
): Partial<ComplianceLineItemMeta> {
  const merged: Partial<ComplianceLineItemMeta> = { ...prev, ...next };

  // Notes concat
  const notes = [
    ...(prev.compliance_notes ?? []),
    ...(next.compliance_notes ?? []),
  ];
  if (notes.length > 0) merged.compliance_notes = notes;

  // Required confirmations concat
  const confirmations = [
    ...(prev.required_confirmations ?? []),
    ...(next.required_confirmations ?? []),
  ];
  if (confirmations.length > 0) merged.required_confirmations = confirmations;

  // Citations dedupe by source_id + reason
  const citations = [
    ...(prev.citations ?? []),
    ...(next.citations ?? []),
  ];
  if (citations.length > 0) {
    const seen = new Set<string>();
    merged.citations = citations.filter((c) => {
      const key = `${c.source_id}:${c.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return merged;
}

/** Deduplicate a citation list by `source_id + reason`. */
function dedupeCitations(input: ReadonlyArray<Citation>): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of input) {
    const key = `${c.source_id}:${c.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Run the full compliance pipeline. Returns a `ComplianceReview`.
 *
 * NEVER throws — internal errors are caught and surfaced via the
 * `diagnostics.fallback` field with the original items left untouched.
 */
export function reviewQuote(
  items: ReadonlyArray<QuoteLineItem>,
  context: JobContext,
): ComplianceReview {
  const itemMetaByIdx: Map<number, Partial<ComplianceLineItemMeta>> = new Map();
  const warnings: ComplianceWarning[] = [];
  const clarifications: ClarificationQuestion[] = [];
  const citations: Citation[] = [];
  const rulesRun: string[] = [];

  // Per-item rule modules.
  for (const ruleFn of RULES_IN_ORDER) {
    let out: RuleOutput;
    try {
      out = ruleFn(items, context);
    } catch (err) {
      console.warn(
        `[compliance] rule '${ruleFn.name}' threw — skipping. error:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    rulesRun.push(out.ruleName);
    for (const [idxStr, meta] of Object.entries(out.itemUpdates)) {
      const idx = Number(idxStr);
      const merged = mergeMeta(itemMetaByIdx.get(idx) ?? {}, meta);
      itemMetaByIdx.set(idx, merged);
    }
    warnings.push(...out.warnings);
    for (const c of meta_citations(out.itemUpdates)) citations.push(c);
  }

  // Clarification engine — runs once over context (not per-item).
  try {
    const clarOut = runClarificationRules(context);
    rulesRun.push(clarOut.ruleName);
    clarifications.push(...clarOut.clarifications);
  } catch (err) {
    console.warn(
      "[compliance] clarification rules threw — skipping. error:",
      err instanceof Error ? err.message : err,
    );
  }

  // Build the enriched item array.
  const enrichedItems: ComplianceLineItem[] = items.map((item, idx) => {
    const meta = itemMetaByIdx.get(idx);
    if (!meta) return item as ComplianceLineItem;
    return { ...item, ...meta } as ComplianceLineItem;
  });

  // Roll up status.
  let status: ComplianceReview["status"];
  if (clarifications.length > 0) status = "needs_clarification";
  else if (warnings.length > 0) status = "warnings_only";
  else status = "ok";

  return {
    status,
    items: enrichedItems,
    clarifications,
    warnings,
    citations: dedupeCitations(citations),
    diagnostics: {
      enabled: true,
      rulesRun,
    },
  };
}

/**
 * Pull all citations attached to per-item rule outputs. Helper for the
 * citation roll-up.
 */
function meta_citations(
  itemUpdates: Record<number, Partial<ComplianceLineItemMeta>>,
): Citation[] {
  const out: Citation[] = [];
  for (const meta of Object.values(itemUpdates)) {
    if (meta.citations) out.push(...meta.citations);
  }
  return out;
}
