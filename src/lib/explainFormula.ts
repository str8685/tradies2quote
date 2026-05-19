/**
 * Wave 41 Stage 3 — turn a calculator formula into something a tradie
 * can read at a glance.
 *
 * Raw formulas emitted by `materialCalculator.ts` look like:
 *   "ceil(joistCount=12 × widthM=4 × (1+10/100) / 5.4m) = 10"
 *
 * A builder *can* parse that, but they shouldn't have to. This module
 * does a small set of regex substitutions to swap variable=value
 * tokens for natural phrases — "12 joists", "4m wide", "10% waste" —
 * so the result reads like a working-out instead of source code:
 *   "round up (12 joists × 4m wide × 10% waste ÷ 5.4m stock) = 10"
 *
 * Substitutions only. We deliberately don't *parse* and re-format
 * the expression because that's a rabbit hole (operator precedence,
 * nested ceils, mixed units) and the regex pass is good enough for
 * every formula the calculator currently emits.
 *
 * If a formula contains a token we don't know about (e.g. a new
 * calculator), the original text is preserved verbatim — never
 * blanks, never throws.
 */

const SUBSTITUTIONS: Array<[RegExp, string]> = [
  // Variable=value tokens — order matters, longer matches first so
  // e.g. "widthMm=" wins over "widthM=".
  [/\bjoistCount\s*=\s*(\d+(?:\.\d+)?)/g, "$1 joists"],
  [/\bbearerRows\s*=\s*(\d+(?:\.\d+)?)/g, "$1 bearer rows"],
  [/\bpilesPerRow\s*=\s*(\d+(?:\.\d+)?)/g, "$1 piles/row"],
  [/\bboardRows\s*=\s*/g, ""],
  [/\bwidthMm\s*=\s*(\d+(?:\.\d+)?)/g, "$1mm wide"],
  [/\bwidthM\s*=\s*(\d+(?:\.\d+)?)/g, "$1m wide"],
  [/\blengthM\s*=\s*(\d+(?:\.\d+)?)/g, "$1m long"],
  [/\bdeckAreaM2\s*=\s*(\d+(?:\.\d+)?)/g, "$1m² deck area"],
  [/\bcoverage\s*=\s*(\d+(?:\.\d+)?)/g, "$1mm board coverage"],
  [/\btimberStockLengthM\s*=\s*(\d+(?:\.\d+)?)/g, "$1m stock"],
  [/\bwastePercent\s*=\s*(\d+(?:\.\d+)?)/g, "$1% waste"],
  [/\bgibSheets\s*=\s*(\d+(?:\.\d+)?)/g, "$1 GIB sheets"],

  // Common idioms — handle the waste multiplier as one chunk so we
  // don't end up with "× + 10% waste". Two variants because the
  // calculator emits both "* (1+10/100)" and "× (1+10/100)".
  [/\s*[×*]\s*\(1\s*\+\s*(\d+)\s*\/\s*100\)/g, " + $1% waste"],
  [/\(1\s*\+\s*(\d+)\s*\/\s*100\)/g, "+ $1% waste"],
  [/\bceil\(/g, "round up of ("],

  // Pretty operators.
  [/\s*\*\s*/g, " × "],
  [/\s*\/\s*/g, " ÷ "],
];

export function explainFormula(formula: string | null | undefined): string {
  if (!formula) return "";
  let out = String(formula);
  for (const [re, replacement] of SUBSTITUTIONS) {
    out = out.replace(re, replacement);
  }
  // Collapse the double-space wrinkles the substitutions sometimes leave.
  out = out.replace(/\s+/g, " ").trim();
  return out;
}
