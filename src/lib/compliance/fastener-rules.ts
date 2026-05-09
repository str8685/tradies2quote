/**
 * Fastener rules (rule category D).
 *
 *   - Bright nails           → only suitable for protected DRY internal
 *                              framing. Anywhere else they corrode or
 *                              react with treatment chemistry.
 *   - Galvanised / stainless → required for treated timber, exterior
 *                              exposure, or corrosion zones.
 *
 * If the exposure zone, treatment class, or cladding/lining system is
 * unknown, the rule MUST flag the fastener as `missing_context` rather
 * than silently approving a bright-steel choice.
 */

import { normalizeMaterialQuery } from "../materialNormalizer";
import type { QuoteLineItem } from "../quote-types";
import { extractTreatmentClass } from "./treatment-rules";
import { isFullyClassifiedInternalDryPartition } from "./classifier";
import type {
  Citation,
  ComplianceLineItemMeta,
  ComplianceWarning,
  JobContext,
  RuleOutput,
} from "./types";

const CITATIONS_FOR_FASTENERS: readonly Citation[] = [
  {
    source_id: "branz-fastener-corrosion",
    reason:
      "BRANZ guidance: bright steel only for protected dry interiors; treated/exterior require galv. or stainless.",
  },
  {
    source_id: "mitek-fixings",
    reason: "Connector schedules require specified fastener class — substitution voids design loads.",
  },
];

const BRIGHT_RE = /\bbright\b/i;
const GALV_RE = /\bgalvani[sz]ed\b|\bhot[\s-]*dip\b|\bgalv\b/i;
const STAINLESS_RE = /\bstainless\b|\bSS\b/;

/**
 * Direct fastener keyword regex. Used in addition to the normalizer's
 * `categoryHint === "fixing"` because phrases like "galvanised joist
 * hanger" can have the timber keyword ("joist") win over the fastener
 * keyword ("hanger") inside the upstream classifier.
 */
const FASTENER_KEYWORD_RE =
  /\b(nails?|screws?|bolts?|washers?|hangers?|brackets?|clips?|rivets?|coach\s*screws?|threaded\s*rods?|joist\s*hangers?|hold\s*?downs?|saddles?)\b/i;

export type FastenerFinish = "bright" | "galvanised" | "stainless" | "unspecified";

/** True iff the line item is a fastener (nail/screw/bolt/bracket). */
export function lineItemIsFastener(item: QuoteLineItem): boolean {
  if (item.type !== "material") return false;
  if (FASTENER_KEYWORD_RE.test(item.description)) return true;
  return normalizeMaterialQuery(item.description).categoryHint === "fixing";
}

/** Read the fastener finish from the description, if any. */
export function detectFastenerFinish(description: string): FastenerFinish {
  if (STAINLESS_RE.test(description)) return "stainless";
  if (GALV_RE.test(description)) return "galvanised";
  if (BRIGHT_RE.test(description)) return "bright";
  return "unspecified";
}

/**
 * Cross-check the description for an exterior/in-ground treatment class
 * (H3 / H3.1 / H3.2 / H4 / H5). H1 / H1.2 treatments use boron-based
 * preservatives which are compatible with bright steel — only H3+ uses
 * the copper-based chemistry (CCA, MCA, ACQ) that corrodes bright nails
 * and requires galv./stainless fasteners per BRANZ guidance.
 */
function jobMentionsTreatedTimber(description: string): boolean {
  const cls = extractTreatmentClass(description);
  if (!cls) return false;
  // Only H3+ classes mandate galv./stainless. H1 and H1.2 don't.
  return /^H(3|4|5)/i.test(cls);
}

export function reviewFastenerItem(
  item: QuoteLineItem,
  context: JobContext,
): {
  meta: Partial<ComplianceLineItemMeta>;
  warnings: ComplianceWarning[];
} {
  if (!lineItemIsFastener(item)) return { meta: {}, warnings: [] };

  const finish = detectFastenerFinish(item.description);
  const internalDry = isFullyClassifiedInternalDryPartition(context.wall);
  const isExternal = context.wall?.type === "external";
  const treatedJob = jobMentionsTreatedTimber(context.description);

  // CASE A: bright nails for confirmed dry internal framing → OK.
  if (finish === "bright" && internalDry && !treatedJob) {
    return {
      meta: {
        compliance_source_type: "rule",
        confidence: "high",
        reason:
          "Bright steel nails are appropriate for protected dry internal framing per BRANZ guidance.",
        citations: CITATIONS_FOR_FASTENERS.slice(),
      },
      warnings: [],
    };
  }

  // CASE B: bright nails for treated timber or external/exposure → BLOCK.
  if (finish === "bright" && (isExternal || treatedJob)) {
    return {
      meta: {
        compliance_source_type: "missing_context",
        confidence: "low",
        reason:
          "Bright nails specified but the job involves treated timber or external exposure — galvanised or stainless is required.",
        required_confirmations: [
          "Replace bright steel with hot-dip galvanised (minimum) or stainless steel for treated/external use.",
        ],
        citations: CITATIONS_FOR_FASTENERS.slice(),
      },
      warnings: [
        {
          severity: "blocker",
          title: "Bright nails are unsafe for this exposure",
          message:
            "Bright steel reacts with CCA/MCA-treated timber and corrodes in external exposure. Use galvanised or stainless.",
          citations: CITATIONS_FOR_FASTENERS.slice(),
        },
      ],
    };
  }

  // CASE C: galvanised/stainless explicitly chosen → OK regardless of context.
  if (finish === "galvanised" || finish === "stainless") {
    return {
      meta: {
        compliance_source_type: "rule",
        confidence: "high",
        reason: `Fastener finish (${finish}) appropriate for treated/exterior use.`,
        citations: CITATIONS_FOR_FASTENERS.slice(),
      },
      warnings: [],
    };
  }

  // CASE D: bright nails but the wall context is unknown — flag for review.
  if (finish === "bright") {
    return {
      meta: {
        compliance_source_type: "missing_context",
        confidence: "low",
        reason:
          "Bright nails specified but exposure zone is unknown — could be unsafe if this wall is treated/external.",
        required_confirmations: [
          "Confirm the wall is internal AND the framing is untreated. Otherwise upgrade to galvanised or stainless.",
        ],
        citations: CITATIONS_FOR_FASTENERS.slice(),
      },
      warnings: [
        {
          severity: "warning",
          title: "Bright nails — context unknown",
          message:
            "Cannot confirm bright steel is safe without knowing internal/external + treatment class.",
          citations: CITATIONS_FOR_FASTENERS.slice(),
        },
      ],
    };
  }

  // CASE E: finish unspecified.
  return {
    meta: {
      compliance_source_type: "missing_context",
      confidence: "low",
      reason: "Fastener finish not specified — context determines whether bright is safe.",
      required_confirmations: [
        "Specify finish (bright / galvanised / stainless) — required by NZS 3604 and connector manufacturers (e.g. MiTek).",
      ],
      citations: CITATIONS_FOR_FASTENERS.slice(),
    },
    warnings: [
      {
        severity: "warning",
        title: "Fastener finish unspecified",
        message:
          "Use BRANZ guidance: bright only for protected dry interior, galv. or stainless for treated/exterior.",
        citations: CITATIONS_FOR_FASTENERS.slice(),
      },
    ],
  };
}

export function runFastenerRules(
  items: ReadonlyArray<QuoteLineItem>,
  context: JobContext,
): RuleOutput {
  const itemUpdates: Record<number, Partial<ComplianceLineItemMeta>> = {};
  const warnings: ComplianceWarning[] = [];

  items.forEach((item, idx) => {
    const { meta, warnings: itemWarnings } = reviewFastenerItem(item, context);
    if (Object.keys(meta).length > 0) itemUpdates[idx] = meta;
    for (const w of itemWarnings) {
      warnings.push({ ...w, line_item_index: idx });
    }
  });

  return {
    ruleName: "fastener-rules",
    itemUpdates,
    warnings,
    clarifications: [],
  };
}
