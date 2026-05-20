// ─────────────────────────────────────────────────────────────────────────
// Takeoff orchestrator — main entry point.
//
// Pipeline:
//
//   text/image/form  →  routeScope()       (which scopes apply)
//                    →  extractFromText()  (per scope; LLM hooks via
//                                           extractFromLLM)
//                    →  validate()         (block / flag / pass)
//                    →  buildClarifications()  (when blocked)
//                    →  runCalculator()    (per scope; pure)
//                    →  explainScope()     (render working narrative)
//                    →  TakeoffResult
//
// The orchestrator is pure code — no LLM calls. When a caller wants to
// feed LLM-supplied structured extraction (instead of regex), it can
// call extractFromLLM and then `runTakeoffWithExtraction` directly.
// ─────────────────────────────────────────────────────────────────────────

import { runCalculator } from "./calculators";
import { buildClarifications } from "./clarify";
import { explainScope } from "./explain";
import { extractFromLLM, extractFromText } from "./extraction";
import { routeScope } from "./scope-router";
import type {
  ClarificationQuestion,
  ExtractedExtraction,
  ScopeResult,
  ScopeType,
  TakeoffResult,
} from "./schemas";
import { worstStatus } from "./schemas";
import { validateExtractionForScope } from "./validate";

export type OrchestratorOptions = {
  /**
   * Provide a pre-built extraction (from the LLM) for one or more
   * scopes. If a scope is in this map the orchestrator skips the
   * regex extraction for that scope and uses the supplied one.
   */
  llmExtractions?: Partial<Record<ScopeType, ExtractedExtraction>>;
  /**
   * If true, fall through to the generic calculator when a more
   * specific scope is blocked. Defaults to false — we prefer to
   * surface a clarification rather than emit shaky numbers.
   */
  allowGenericFallback?: boolean;
};

/**
 * One-shot entry — feed a raw description, get a structured
 * TakeoffResult back.
 */
export function runTakeoff(
  description: string,
  options: OrchestratorOptions = {},
): TakeoffResult {
  const route = routeScope(description);
  const scopes: ScopeResult[] = [];
  const allClarifications: ClarificationQuestion[] = [];
  const warnings: string[] = [];

  for (const scope of route.scopes) {
    // 1. Get the extraction — LLM if supplied, else regex.
    const ext: ExtractedExtraction =
      options.llmExtractions?.[scope] ?? extractFromText(description, scope);

    // 2. Validate.
    const validation = validateExtractionForScope(ext, scope);

    // 3. If blocked, build clarifications and skip the calculator.
    if (validation.status === "blocked") {
      const { questions, blocking } = buildClarifications(scope, ext);
      allClarifications.push(...questions);
      warnings.push(...validation.reasons.map((r) => `${scope}: ${r}`));
      const blockedScope: ScopeResult = {
        scope,
        status: "blocked",
        summary: {
          primary_metric: "n/a",
          primary_value: 0,
          unit: "",
          inputs: {},
        },
        lines: [],
        warnings: validation.reasons,
        assumptions: [],
        clarifications: questions,
        explanation: "Calculation blocked — clarification required.",
      };
      scopes.push(blockedScope);
      // If a critical scope is blocked AND the caller opted in to
      // generic fallback, run the generic calculator on the same
      // extraction so the tradie still has *something*.
      if (blocking && options.allowGenericFallback) {
        const generic = runCalculator("generic", { ...ext, scope_type: "generic" });
        generic.assumptions.unshift(
          `Falling back to generic calculator after ${scope} scope was blocked.`,
        );
        generic.explanation = explainScope(generic);
        scopes.push(generic);
      }
      continue;
    }

    // 4. Run the calculator.
    const result = runCalculator(scope, ext);
    // Flags from validation roll up into the scope result.
    if (validation.flags.length > 0) {
      result.warnings.push(...validation.flags);
      // Promote status to needs_review if validate flagged something
      // but the calculator was happy.
      if (result.status === "ok" || result.status === "assumed") {
        result.status = "needs_review";
        for (const l of result.lines) {
          if (l.status === "ok") l.status = "needs_review";
          l.validation_flags.push(...validation.flags);
        }
      }
    }
    result.explanation = explainScope(result);
    scopes.push(result);
    allClarifications.push(...result.clarifications);
  }

  const status = worstStatus(scopes.map((s) => s.status));
  return {
    status,
    primary_scope: route.primary,
    scopes,
    clarifications: allClarifications,
    warnings,
  };
}

/**
 * Alternative entry — caller already has a validated extraction (from
 * the LLM extraction agent or from a manual form). Skips the routing
 * step and runs the calculator directly.
 */
export function runTakeoffWithExtraction(
  ext: ExtractedExtraction,
): TakeoffResult {
  const validation = validateExtractionForScope(ext, ext.scope_type);
  if (validation.status === "blocked") {
    const { questions } = buildClarifications(ext.scope_type, ext);
    return {
      status: "blocked",
      primary_scope: ext.scope_type,
      scopes: [
        {
          scope: ext.scope_type,
          status: "blocked",
          summary: {
            primary_metric: "n/a",
            primary_value: 0,
            unit: "",
            inputs: {},
          },
          lines: [],
          warnings: validation.reasons,
          assumptions: [],
          clarifications: questions,
          explanation: "Calculation blocked — clarification required.",
        },
      ],
      clarifications: questions,
      warnings: validation.reasons,
    };
  }
  const result = runCalculator(ext.scope_type, ext);
  if (validation.flags.length > 0) {
    result.warnings.push(...validation.flags);
    if (result.status === "ok" || result.status === "assumed") {
      result.status = "needs_review";
    }
  }
  result.explanation = explainScope(result);
  return {
    status: result.status,
    primary_scope: ext.scope_type,
    scopes: [result],
    clarifications: result.clarifications,
    warnings: [...result.warnings],
  };
}

// Re-export the most-used symbols so callers can do a single import.
import { CALCULATORS } from "./calculators";
const CALCULATORS_KEYS = Object.keys(CALCULATORS) as ScopeType[];
export {
  buildClarifications,
  CALCULATORS_KEYS,
  extractFromLLM,
  extractFromText,
  routeScope,
  validateExtractionForScope,
};
