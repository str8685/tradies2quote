/**
 * Quote Review Agent — pure rule-based analyser.
 *
 * Combines `checkQuoteReadiness` (which scopes/GST/totals) with the
 * compliance flag set (risky wording, missing exclusions, etc.) into a
 * single actionable fix list. Returns suggested fixes the UI can show
 * as "Apply / Ignore" rows.
 *
 * No I/O, no Anthropic, no Supabase — safe to run inline on the quote
 * preview page. Marking a fix "addressed" is UI state (or a JSON blob
 * stored in `quotes.quote_data.review` if the caller wishes); this
 * function does not write anywhere itself.
 */
import type { QuoteData } from "@/lib/quote-types";
import {
  checkQuoteReadiness,
  type ProfileForReadiness,
  type ReadinessItem,
} from "@/lib/quote-readiness";
import { runComplianceAgent } from "./compliance";

export type ReviewSeverity = "info" | "warning" | "missing";

export interface ReviewFix {
  /** Stable id used as React key + for the "addressed" persistence map. */
  id: string;
  severity: ReviewSeverity;
  /** Short headline shown in the fix row. */
  title: string;
  /** Longer detail / why it matters. */
  detail: string;
  /** Concrete action the user can take to fix it. */
  fix: string;
  /** Where in the editor to look. */
  area: "client" | "scope" | "labour" | "materials" | "tax" | "terms" | "notes" | "settings";
}

export interface ReviewReport {
  fixes: ReviewFix[];
  /** Counts so the UI can show a one-glance health pill. */
  summary: {
    total: number;
    missing: number;
    warning: number;
    info: number;
  };
  /** Pass-through of the underlying readiness items (UI may want them). */
  readiness: ReadinessItem[];
}

function area(id: string): ReviewFix["area"] {
  if (id.startsWith("client")) return "client";
  if (id === "scope") return "scope";
  if (id === "labour") return "labour";
  if (id === "materials") return "materials";
  if (id === "gst" || id === "total") return "tax";
  if (id === "payment_terms" || id === "valid_until") return "terms";
  if (id === "exclusions" || id === "assumptions") return "notes";
  if (id === "business_contact") return "settings";
  return "scope";
}

export function runQuoteReview(
  quoteData: QuoteData | null,
  profile: ProfileForReadiness | null,
  expiresAt: string | null,
): ReviewReport {
  const readiness = checkQuoteReadiness(quoteData, profile, expiresAt);
  const compliance = runComplianceAgent(quoteData);

  const fixes: ReviewFix[] = [];

  for (const item of readiness) {
    if (item.status === "complete") continue;
    fixes.push({
      id: `readiness-${item.id}`,
      severity: item.status === "missing" ? "missing" : "warning",
      title: item.label,
      detail:
        item.detail ?? `${item.label} is ${item.status === "missing" ? "missing" : "weak"}.`,
      fix: item.detail ?? `Fix ${item.label.toLowerCase()} in the quote editor.`,
      area: area(item.id),
    });
  }

  for (const flag of compliance.flags) {
    fixes.push({
      id: `compliance-${flag.id}`,
      severity: flag.severity === "high" ? "missing" : flag.severity === "warn" ? "warning" : "info",
      title: flag.message,
      detail: flag.fixHint,
      fix: flag.fixHint,
      area:
        flag.id === "risky-wording"
          ? "scope"
          : flag.id === "no-payment-term" || flag.id === "no-variations-term"
            ? "terms"
            : "notes",
    });
  }

  const summary = {
    total: fixes.length,
    missing: fixes.filter((f) => f.severity === "missing").length,
    warning: fixes.filter((f) => f.severity === "warning").length,
    info: fixes.filter((f) => f.severity === "info").length,
  };

  return { fixes, summary, readiness };
}

/**
 * Helper for callers: read the set of fix-ids the user has marked as
 * "addressed" out of `quoteData.review.addressed` (a free-form JSON
 * blob inside the existing `quotes.quote_data` column — no schema
 * change required). Returns an empty set if nothing has been stored.
 */
export function getAddressedSet(
  quoteData: QuoteData | null,
): Set<string> {
  const raw = (quoteData as unknown as { review?: { addressed?: unknown } } | null)?.review
    ?.addressed;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((x): x is string => typeof x === "string"));
}
