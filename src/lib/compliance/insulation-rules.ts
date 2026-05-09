/**
 * Insulation rules (rule category C).
 *
 *   - External wall + thermal envelope    → insulation required (H1)
 *   - Internal wall (dry partition)       → no insulation by default
 *   - Internal wall + acoustic / fire     → insulation may be required
 *   - Internal wall + wet area / system   → insulation may be required
 *
 * Most importantly: NEVER add Pink Batts to an internal wall by default.
 * That's the canonical "AI guess" the user wants this layer to catch.
 */

import { normalizeMaterialQuery } from "../materialNormalizer";
import type { QuoteLineItem } from "../quote-types";
import {
  isFullyClassifiedExternalEnvelope,
  isFullyClassifiedInternalDryPartition,
} from "./classifier";
import type {
  Citation,
  ComplianceLineItemMeta,
  ComplianceWarning,
  JobContext,
  RuleOutput,
} from "./types";

const CITATIONS_FOR_INSULATION: readonly Citation[] = [
  { source_id: "nzbc-h1", reason: "Thermal envelope walls must meet H1 R-values." },
];

/** True iff this AI-generated item is an insulation product. */
export function lineItemIsInsulation(item: QuoteLineItem): boolean {
  if (item.type !== "material") return false;
  return normalizeMaterialQuery(item.description).categoryHint === "insulation";
}

/** Per-item insulation review. */
export function reviewInsulationItem(
  item: QuoteLineItem,
  context: JobContext,
): {
  meta: Partial<ComplianceLineItemMeta>;
  warnings: ComplianceWarning[];
} {
  if (!lineItemIsInsulation(item)) return { meta: {}, warnings: [] };

  // External + thermal envelope → confirmed required (subject to H1
  // climate zone — we still warn about the climate-zone unknown unless
  // the user explicitly confirmed it via context).
  if (isFullyClassifiedExternalEnvelope(context.wall)) {
    return {
      meta: {
        compliance_source_type: "rule",
        confidence: "high",
        reason:
          "External thermal-envelope wall — insulation required by H1 (specific R-value depends on climate zone).",
        compliance_notes: [
          "Confirm the H1 climate zone (1–6) and the required minimum R-value before ordering. Pink Batts R2.6 is a common ceiling/wall product but the spec depends on zone.",
        ],
        citations: CITATIONS_FOR_INSULATION.slice(),
      },
      warnings: [],
    };
  }

  // Internal dry partition with no acoustic/wet/fire requirement →
  // insulation is NOT required by default. THIS is the canonical
  // unsafe-AI case the rule layer must catch.
  if (isFullyClassifiedInternalDryPartition(context.wall)) {
    return {
      meta: {
        compliance_source_type: "missing_context",
        confidence: "low",
        reason:
          "Internal dry partition — insulation not required by NZBC. AI guessed; remove unless the customer wants acoustic separation.",
        required_confirmations: [
          "Confirm: is acoustic separation, fire rating, or thermal separation required for this internal wall? If none, remove this insulation line.",
        ],
        citations: CITATIONS_FOR_INSULATION.slice(),
      },
      warnings: [
        {
          severity: "warning",
          title: "Insulation in an internal wall — not required by default",
          message:
            "Pink Batts (or equivalent) is not required for internal dry partitions. Confirm acoustic/thermal separation requirement before keeping this line.",
          citations: CITATIONS_FOR_INSULATION.slice(),
        },
      ],
    };
  }

  // Otherwise (wall type unknown, or internal+acoustic/wet) — keep the
  // line but flag that it's only safe once context is confirmed.
  return {
    meta: {
      compliance_source_type: "missing_context",
      confidence: "low",
      reason:
        "Insulation requirement depends on wall classification — confirm internal vs external + thermal-envelope role.",
      required_confirmations: [
        "Confirm whether the wall is internal or external, and whether it forms part of the thermal envelope, before this insulation line is signed off.",
      ],
      citations: CITATIONS_FOR_INSULATION.slice(),
    },
    warnings: [
      {
        severity: "warning",
        title: "Insulation requirement depends on wall context",
        message:
          "Cannot confirm whether this insulation is required without internal/external + thermal-envelope information.",
        citations: CITATIONS_FOR_INSULATION.slice(),
      },
    ],
  };
}

export function runInsulationRules(
  items: ReadonlyArray<QuoteLineItem>,
  context: JobContext,
): RuleOutput {
  const itemUpdates: Record<number, Partial<ComplianceLineItemMeta>> = {};
  const warnings: ComplianceWarning[] = [];

  items.forEach((item, idx) => {
    const { meta, warnings: itemWarnings } = reviewInsulationItem(item, context);
    if (Object.keys(meta).length > 0) itemUpdates[idx] = meta;
    for (const w of itemWarnings) {
      warnings.push({ ...w, line_item_index: idx });
    }
  });

  return {
    ruleName: "insulation-rules",
    itemUpdates,
    warnings,
    clarifications: [],
  };
}
