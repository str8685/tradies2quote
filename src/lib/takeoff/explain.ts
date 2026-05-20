// ─────────────────────────────────────────────────────────────────────────
// Explainability layer.
//
// Builds a short human-readable "working" string from a TakeoffLine.
// Comes from CODE not the LLM — the formula string already encodes the
// math, this layer just makes it readable. Used by:
//   - the UI's "show working" toggle (QuoteEditor.ShowWorking)
//   - the per-scope explanation summary on ScopeResult
//   - the public quote audit trail
// ─────────────────────────────────────────────────────────────────────────

import type { ScopeResult, TakeoffLine } from "./schemas";

/**
 * One-line description of how a line was derived. Falls back to the
 * raw formula if no friendlier template exists.
 */
export function explainLine(line: TakeoffLine): string {
  if (line.explanation && line.explanation.trim() !== "") {
    return line.explanation;
  }
  const inputs = Object.entries(line.basis.inputs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const tail = inputs ? ` (${inputs})` : "";
  return `${line.quantity} ${line.unit} — ${line.basis.formula}${tail}`;
}

/**
 * Multi-paragraph narrative for the whole scope. Listed:
 *   1. Primary metric (deck area, wall area, roof area, …)
 *   2. Assumptions applied (defaults the calculator used)
 *   3. Waste % applied
 *   4. Validation warnings
 */
export function explainScope(result: ScopeResult): string {
  const lines: string[] = [];
  const { primary_metric, primary_value, unit } = result.summary;
  if (Number.isFinite(primary_value) && primary_value > 0) {
    lines.push(`${primary_metric}: ${primary_value} ${unit}.`);
  }
  if (result.assumptions.length > 0) {
    lines.push(`Assumptions: ${result.assumptions.join("; ")}.`);
  }
  if (result.warnings.length > 0) {
    lines.push(`Warnings: ${result.warnings.join("; ")}.`);
  }
  return lines.join(" ");
}
