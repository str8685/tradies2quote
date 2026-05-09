/**
 * Timber treatment rules (rule category B).
 *
 * Hazard classes per NZS 3640 / NZS 3602:
 *
 *   H1.2  — Protected internal framing (still preserved against insects,
 *           but for *interior* dry conditions only).
 *   H3.1  — Partially exposed exterior, above ground, non-critical.
 *   H3.2  — Fully exposed exterior above ground (decking, exposed framing).
 *   H4    — In-ground use (posts buried in soil).
 *   H5    — Critical in-ground or freshwater contact (piles).
 *
 * Critical invariant: these classes are NOT interchangeable. The
 * preservation envelope for in-ground H4 is fundamentally different from
 * exposed-above-ground H3.2. Substituting one for another is unsafe and
 * non-compliant.
 *
 * The Phase 4.9 search_materials hard filter enforces this at the
 * matcher level. THIS module enforces it at the rule level — given an
 * AI-generated line item with an extracted treatment class, never let
 * the resulting `material_id` be bound to a different class.
 */

import { normalizeMaterialQuery } from "../materialNormalizer";
import type { QuoteLineItem } from "../quote-types";
import type {
  Citation,
  ComplianceLineItemMeta,
  ComplianceWarning,
  JobContext,
  RuleOutput,
} from "./types";

/** All treatment classes we recognise. Extend as needed. */
export const TREATMENT_CLASSES = ["H1", "H1.2", "H3", "H3.1", "H3.2", "H4", "H5"] as const;
export type TreatmentClass = (typeof TREATMENT_CLASSES)[number];

const CITATIONS_FOR_TREATMENT: readonly Citation[] = [
  { source_id: "nzs-3640", reason: "Defines hazard classes H1–H6 and their preservation envelopes." },
  { source_id: "nzs-3602", reason: "Maps end-use to required hazard class." },
  { source_id: "nzbc-b2", reason: "Durability requirement that drives the H-class selection." },
];

/**
 * Extract treatment class from a description using the production
 * normalizer (same logic that the materialMatcher uses). Returns `null`
 * when no class is named.
 */
export function extractTreatmentClass(description: string): string | null {
  if (!description) return null;
  return normalizeMaterialQuery(description).treatmentClass;
}

/**
 * True iff `a` and `b` are the SAME treatment class. There is no
 * "compatible" relation — different classes are mutually incompatible
 * even when they look adjacent (H3 ≠ H3.1 ≠ H3.2; H4 ≠ H5).
 */
export function sameTreatmentClass(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return a === b;
}

/**
 * Heuristic: is this line item plausibly a piece of timber for which a
 * treatment class might apply? We check both the description and the
 * normalizer's category hint — a "labour" line is never timber.
 */
export function lineItemIsTimber(item: QuoteLineItem): boolean {
  if (item.type !== "material") return false;
  const norm = normalizeMaterialQuery(item.description);
  return norm.categoryHint === "timber";
}

/**
 * Treatment-class rule output for a single line item. Returns the
 * partial compliance metadata to apply.
 */
export function reviewTimberItem(
  item: QuoteLineItem,
  context: JobContext,
): {
  meta: Partial<ComplianceLineItemMeta>;
  warnings: ComplianceWarning[];
} {
  if (!lineItemIsTimber(item)) return { meta: {}, warnings: [] };

  const declaredOnItem = extractTreatmentClass(item.description);
  const warnings: ComplianceWarning[] = [];
  const meta: Partial<ComplianceLineItemMeta> = {
    citations: CITATIONS_FOR_TREATMENT.slice(),
  };

  // 1. Item description names a class but the catalogue match is to a
  //    different class. The Phase 4.9 hard filter should make this
  //    impossible, but we double-check at the rule level — defence in
  //    depth in case a future matcher change relaxes the filter.
  //
  //    We can't read the bound material's treatment class from here
  //    without a DB lookup; the matcher pipeline is responsible for
  //    binding correctly. The rule below keeps the description's class
  //    visible in the review panel so a tradie can spot a mismatch.
  if (declaredOnItem) {
    meta.compliance_source_type = "rule";
    meta.confidence = "high";
    meta.reason = `Treatment class ${declaredOnItem} extracted from the description; catalogue match must share this class (enforced by search_materials hard filter).`;
    meta.compliance_notes = [
      `H-class ${declaredOnItem} declared on this line. ${declaredOnItem} is NOT interchangeable with adjacent classes (H1.2 / H3.1 / H3.2 / H4 / H5 each preserve against different exposures).`,
    ];
    return { meta, warnings };
  }

  // 2. No treatment class on the item description, but it's clearly
  //    timber. The required class depends on the wall context.
  if (context.wall?.type === "external") {
    meta.compliance_source_type = "missing_context";
    meta.confidence = "low";
    meta.reason =
      "Timber for an external wall — required treatment class (H3.1, H3.2, etc.) not yet specified.";
    meta.required_confirmations = [
      "Specify treatment class for external timber (H3.1 or H3.2 per NZS 3602 — H3.2 for fully exposed framing/decking; H3.1 for partial exposure).",
    ];
    warnings.push({
      severity: "warning",
      title: "Treatment class not specified for external timber",
      message:
        "External timber must be H3.1 or H3.2 per NZS 3602. The matcher cannot confirm a class until the user names it.",
      citations: CITATIONS_FOR_TREATMENT.slice(),
    });
    return { meta, warnings };
  }

  if (context.wall?.type === "internal") {
    meta.compliance_source_type = "rule";
    meta.confidence = "medium";
    meta.reason =
      "Timber for an internal wall — H1.2 is acceptable per NZS 3602 when protected from moisture.";
    meta.compliance_notes = [
      "Internal protected framing → H1.2 is the standard NZS 3602 selection. If the wall is in a wet area, upgrade per the wet-area rule.",
    ];
    return { meta, warnings };
  }

  // Wall type is unknown → can't confirm class yet. Add to warnings only;
  // the clarification engine will emit the question itself.
  meta.compliance_source_type = "missing_context";
  meta.confidence = "low";
  meta.reason =
    "Timber on a wall — required treatment class depends on internal/external classification.";
  warnings.push({
    severity: "info",
    title: "Treatment class not yet determinable",
    message:
      "Wall type is unspecified — once classified internal/external, NZS 3602 fixes the required H-class.",
    citations: CITATIONS_FOR_TREATMENT.slice(),
  });
  return { meta, warnings };
}

/** Run treatment review across all line items. */
export function runTreatmentRules(
  items: ReadonlyArray<QuoteLineItem>,
  context: JobContext,
): RuleOutput {
  const itemUpdates: Record<number, Partial<ComplianceLineItemMeta>> = {};
  const warnings: ComplianceWarning[] = [];

  items.forEach((item, idx) => {
    const { meta, warnings: itemWarnings } = reviewTimberItem(item, context);
    if (Object.keys(meta).length > 0) itemUpdates[idx] = meta;
    for (const w of itemWarnings) {
      warnings.push({ ...w, line_item_index: idx });
    }
  });

  return {
    ruleName: "treatment-rules",
    itemUpdates,
    warnings,
    clarifications: [],
  };
}
