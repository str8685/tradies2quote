/**
 * Safe wrapper around `reviewQuote`.
 *
 * Mirrors the materialMatchingPipeline's `safelyEnrichLineItemsWithCatalogue`:
 *
 *   - feature flag OFF → identity passthrough, status="disabled".
 *   - feature flag ON, pipeline succeeds → returns the review.
 *   - feature flag ON, pipeline throws → original items returned
 *     unchanged, status="error", server-side warn logged.
 *
 * Quote generation MUST NEVER fail because the compliance review fails.
 * This is the route-handler-level guarantee.
 */

import type { QuoteLineItem } from "../quote-types";
import { reviewQuote } from "./pipeline";
import type { ComplianceReview, JobContext } from "./types";

export type SafeReviewOptions = {
  enabled: boolean;
  /** Test seam — replace the pipeline. */
  pipelineFn?: typeof reviewQuote;
};

/**
 * The safe wrapper. Always returns a ComplianceReview, never throws.
 *
 * When the engine returns `needs_clarification`, the route handler should
 * surface the clarifications to the UI; when it returns `warnings_only`,
 * the UI shows the review panel with warnings; when it returns `ok` or
 * `disabled`, the quote can ship as-is.
 */
export async function safelyReviewQuote(
  items: ReadonlyArray<QuoteLineItem>,
  context: JobContext,
  options: SafeReviewOptions,
): Promise<ComplianceReview> {
  if (!options.enabled) {
    return {
      status: "disabled",
      // Cast: passthrough keeps the original items as ComplianceLineItem
      // (the optional compliance fields are simply absent).
      items: items.slice() as ComplianceReview["items"],
      clarifications: [],
      warnings: [],
      citations: [],
      diagnostics: {
        enabled: false,
        fallback: "disabled",
        rulesRun: [],
      },
    };
  }

  const fn = options.pipelineFn ?? reviewQuote;

  try {
    return fn(items, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[compliance] pipeline threw — falling back to passthrough.", {
      message,
      itemCount: items.length,
    });
    return {
      status: "error",
      items: items.slice() as ComplianceReview["items"],
      clarifications: [],
      warnings: [],
      citations: [],
      diagnostics: {
        enabled: true,
        fallback: "error",
        fallbackReason: message,
        rulesRun: [],
      },
    };
  }
}
