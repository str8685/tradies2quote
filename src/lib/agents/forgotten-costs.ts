/**
 * Forgotten-Cost Detector — pure rule-based margin-leak scanner.
 *
 * Most tradies underquote by 10–20% because they price what they SEE
 * (materials + labour) and forget the costs experience tells them will
 * land anyway — the dump run, the box of screws, the travel, the
 * weather delay. This agent scans a finished quote, works out which of
 * those commonly-missed cost categories APPLY to this job, checks
 * whether the quote already covers each one, and flags the gaps with a
 * starting dollar estimate.
 *
 * Safety / shape (mirrors the other agents):
 *   - Pure function. No I/O, no Anthropic, no Supabase, no writes.
 *   - Advisory only. It never edits the quote — the tradie reviews each
 *     flagged cost and adds the lines they agree with in the editor.
 *   - Estimates are STARTING POINTS, not quotes. They're round NZ
 *     ballpark numbers (or a % of the job) the tradie tunes — the value
 *     is the prompt ("did you forget the dump run?"), not false
 *     precision. Defaults live in FORGOTTEN_COST_DEFAULTS so they're
 *     easy to adjust.
 */
import type { QuoteData } from "@/lib/quote-types";

export type ForgottenCostId =
  | "disposal"
  | "consumables"
  | "travel"
  | "prep_materials"
  | "contingency";

export interface ForgottenCost {
  id: ForgottenCostId;
  /** Short label for the panel row. */
  label: string;
  /** Why this cost is commonly missed / why it matters. */
  why: string;
  /** Starting dollar estimate — the tradie tunes it. */
  estimated: number;
  /** How the estimate was derived, so the number isn't a black box. */
  basis: string;
}

export interface ForgottenCostReport {
  /** Commonly-missed costs that apply to this job and aren't covered. */
  costs: ForgottenCost[];
  /** Sum of the estimates — the "you might be leaving $X behind" figure. */
  totalEstimated: number;
  /** True when nothing obvious is missing (or there's no quote yet). */
  clean: boolean;
}

/**
 * Tunable defaults. Flat figures are rough NZ ballparks; the two
 * percentage figures scale with the job. Adjust freely — they're
 * starting points the tradie overrides per quote.
 */
export const FORGOTTEN_COST_DEFAULTS = {
  /** Tip fees / a trailer load to the transfer station. */
  disposalFlat: 90,
  /** Travel + vehicle running for a typical local job. */
  travelFlat: 55,
  /** Sandpaper, masking, drop sheets, filler for a prep-heavy job. */
  prepFlat: 110,
  /** Consumables (fixings, glue, sealant) as a share of materials. */
  consumablesPctOfMaterials: 0.05,
  /** Floor for the consumables estimate on a small job. */
  consumablesMin: 50,
  /** Weather / contingency buffer as a share of materials + labour. */
  contingencyPctOfJob: 0.1,
} as const;

/** Round to the nearest $5 — these are estimates, not invoices. */
function round5(n: number): number {
  return Math.max(0, Math.round(n / 5) * 5);
}

/** Everything the rules read, derived once from the quote. */
type CostContext = {
  /** job_summary + every line description + every note, lowercased. */
  jobText: string;
  /** Every line item's description, lowercased — for "already covered". */
  lineText: string;
  materialsSubtotal: number;
  labourSubtotal: number;
  hasLabour: boolean;
  hasAnyLine: boolean;
};

function buildContext(q: QuoteData): CostContext {
  const lines = Array.isArray(q.line_items) ? q.line_items : [];
  const notes = Array.isArray(q.notes) ? q.notes : [];
  const descriptions = lines.map((it) => String(it?.description ?? ""));
  const lineText = descriptions.join(" \n ").toLowerCase();
  const jobText = [
    String(q.job_summary ?? ""),
    ...descriptions,
    ...notes.map((n) => String(n ?? "")),
  ]
    .join(" \n ")
    .toLowerCase();

  let materialsSubtotal = 0;
  let labourSubtotal = 0;
  for (const it of lines) {
    const lt = Number(it?.line_total) || 0;
    if (it?.type === "labour") labourSubtotal += lt;
    else materialsSubtotal += lt;
  }
  return {
    jobText,
    lineText,
    materialsSubtotal,
    labourSubtotal,
    hasLabour: lines.some((it) => it?.type === "labour"),
    hasAnyLine: lines.length > 0,
  };
}

/** One detector rule. */
type Rule = {
  id: ForgottenCostId;
  label: string;
  why: string;
  /** Is this category relevant to THIS job? */
  appliesWhen: (c: CostContext) => boolean;
  /** Does a line item (or note) already cover it? */
  alreadyCovered: (c: CostContext) => boolean;
  /** Compute the starting estimate + how it was derived. */
  estimate: (c: CostContext) => { estimated: number; basis: string };
};

const RULES: Rule[] = [
  {
    id: "disposal",
    label: "Waste disposal (tip fees / skip bin)",
    why: "Strip-outs and replacements generate waste — the dump run or skip is real money that rarely makes it onto the quote.",
    appliesWhen: (c) =>
      /\b(rip|strip|tear|pull|demo|demolition|removal|remove|removing|old|existing|replace|replacing|reno|renovat|knock out|gut)\b/.test(
        c.jobText,
      ),
    alreadyCovered: (c) =>
      /\b(tip fee|dump|disposal|dispose|skip|rubbish|waste|transfer station|cart away|spoil)\b/.test(
        c.lineText,
      ),
    estimate: () => ({
      estimated: FORGOTTEN_COST_DEFAULTS.disposalFlat,
      basis: "Flat estimate — a trailer load to the transfer station",
    }),
  },
  {
    id: "consumables",
    label: "Consumables & fixings",
    why: "Screws, nails, glue, sealant, blades — the box of bits every job burns through but no one itemises.",
    appliesWhen: (c) => c.hasAnyLine,
    alreadyCovered: (c) =>
      /\b(fixings?|screws?|nails?|adhesive|glue|sealant|silicone|consumables?|sundr|fasteners?)\b/.test(
        c.lineText,
      ),
    estimate: (c) => {
      const pct = round5(
        c.materialsSubtotal * FORGOTTEN_COST_DEFAULTS.consumablesPctOfMaterials,
      );
      const estimated = Math.max(FORGOTTEN_COST_DEFAULTS.consumablesMin, pct);
      return {
        estimated,
        basis:
          pct >= FORGOTTEN_COST_DEFAULTS.consumablesMin
            ? "≈5% of materials"
            : `Minimum $${FORGOTTEN_COST_DEFAULTS.consumablesMin} for a small job`,
      };
    },
  },
  {
    id: "travel",
    label: "Travel & vehicle",
    why: "Site visits, mileage and vehicle running add up — especially on jobs out of town. Skip this if it's already baked into your hourly rate.",
    appliesWhen: (c) => c.hasLabour,
    alreadyCovered: (c) =>
      /\b(travel|mileage|vehicle|callout|call-out|call out|site visit|transport)\b/.test(
        c.lineText,
      ),
    estimate: () => ({
      estimated: FORGOTTEN_COST_DEFAULTS.travelFlat,
      basis: "Flat estimate — travel + vehicle for a typical local job",
    }),
  },
  {
    id: "prep_materials",
    label: "Prep materials",
    why: "Sandpaper, masking tape, drop sheets and filler — the prep gear a paint or plaster job eats before the first coat.",
    appliesWhen: (c) =>
      /\b(paint|painting|repaint|plaster|plastering|decorat|prime|primer|undercoat|sand back|prep)\b/.test(
        c.jobText,
      ),
    alreadyCovered: (c) =>
      /\b(prep|sandpaper|masking|drop sheets?|dropsheets?|filler)\b/.test(
        c.lineText,
      ),
    estimate: () => ({
      estimated: FORGOTTEN_COST_DEFAULTS.prepFlat,
      basis: "Flat estimate — sandpaper, masking, drop sheets, filler",
    }),
  },
  {
    id: "contingency",
    label: "Weather / contingency buffer",
    why: "Rain days, surprises behind the wall, a supplier running short — a buffer keeps the job profitable when it doesn't go to plan.",
    appliesWhen: (c) =>
      /\b(roof|roofing|exterior|outdoor|outside|deck|decking|fence|fencing|cladding|weatherboard|spouting|gutter|guttering|concrete|paving|excavat|landscap|drainage)\b/.test(
        c.jobText,
      ),
    // A buffer is usually NOTED rather than itemised, so this rule scans
    // the whole job text (which includes notes), not just line items.
    alreadyCovered: (c) =>
      /\b(contingency|buffer|weather allowance|allowance for weather|provisional sum)\b/.test(
        c.jobText,
      ),
    estimate: (c) => ({
      estimated: round5(
        (c.materialsSubtotal + c.labourSubtotal) *
          FORGOTTEN_COST_DEFAULTS.contingencyPctOfJob,
      ),
      basis: "≈10% of materials + labour",
    }),
  },
];

/**
 * Scan a finished quote for commonly-missed cost categories.
 *
 * Returns an empty / clean report when there's no quote yet or the
 * quote has no line items — there's nothing to scan against.
 */
export function detectForgottenCosts(
  quoteData: QuoteData | null,
): ForgottenCostReport {
  if (
    !quoteData ||
    !Array.isArray(quoteData.line_items) ||
    quoteData.line_items.length === 0
  ) {
    return { costs: [], totalEstimated: 0, clean: true };
  }

  const ctx = buildContext(quoteData);
  const costs: ForgottenCost[] = [];
  for (const rule of RULES) {
    if (!rule.appliesWhen(ctx)) continue;
    if (rule.alreadyCovered(ctx)) continue;
    const { estimated, basis } = rule.estimate(ctx);
    if (estimated <= 0) continue;
    costs.push({ id: rule.id, label: rule.label, why: rule.why, estimated, basis });
  }

  const totalEstimated = costs.reduce((s, c) => s + c.estimated, 0);
  return { costs, totalEstimated, clean: costs.length === 0 };
}
