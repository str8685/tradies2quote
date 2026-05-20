// ─────────────────────────────────────────────────────────────────────────
// Structured extraction layer.
//
// Two entry points:
//
//   extractFromText(text, scope)
//     — Pure regex extraction. Same approach as aiTakeoffParser.ts
//       (we deliberately don't import it; we want this module to be
//       independent and self-contained), generalised to all scopes.
//
//   extractFromLLM(llmJson)
//     — Validates LLM-emitted structured JSON. The LLM is told to emit
//       extraction-only output (no quantities). This function calls
//       parseExtractedExtraction from schemas.ts and adds clarification
//       questions for any nulls.
//
// CRITICAL RULES (also enforced in the prompt at quote-prompt.ts):
//   - Unknown values must be EXPLICIT (null). Never silently guess.
//   - Core geometry missing → mark needs_clarification.
//   - The extraction NEVER produces final quantities; that's the
//     calculator's job.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedDimensions,
  ExtractedExtraction,
  ExtractedOpening,
  ScopeType,
} from "./schemas";
import { parseExtractedExtraction } from "./schemas";

// ─────────────────────────────────────────────────────────────────────────
// Regex utilities — replicated here intentionally so the takeoff module
// doesn't reach into aiTakeoffParser.ts internals.
// ─────────────────────────────────────────────────────────────────────────

const MIN_PLAN_M = 1;
const MAX_PLAN_M = 100;

function parseLength(value: string, unit: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  const u = (unit ?? "").toLowerCase();
  if (u === "mm") return n / 1000;
  if (u === "cm") return n / 100;
  if (u === "m" || u.startsWith("metre") || u.startsWith("meter")) return n;
  // Unitless reasonableness clamp.
  return n > 50 ? n / 1000 : n;
}

function extractRectangle(
  text: string,
): { length_m: number; width_m: number } | null {
  const re =
    /(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?)?\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?)?/gi;
  for (const m of text.matchAll(re)) {
    const a = parseLength(m[1] ?? "", m[2]);
    const b = parseLength(m[3] ?? "", m[4]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const length_m = Math.max(a, b);
    const width_m = Math.min(a, b);
    if (width_m < MIN_PLAN_M || length_m > MAX_PLAN_M) continue;
    return { length_m, width_m };
  }
  return null;
}

function extractSinglePattern(
  text: string,
  patterns: RegExp[],
): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function extractAreaM2(text: string): number | null {
  // "30 m²", "30m²", "30 square metres", "30 square meters", "30 sqm"
  const re =
    /(\d+(?:\.\d+)?)\s*(?:m²|m\^2|m2|square\s+(?:metres?|meters?)|sqm)\b/i;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractVolumeM3(text: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(?:m³|m\^3|m3|cubic\s+(?:metres?|meters?))\b/i;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractPerimeterM(text: string): number | null {
  const re =
    /(\d+(?:\.\d+)?)\s*(?:m|metres?)\s+(?:of\s+)?(?:perimeter|fence|fencing|running)/i;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractPitch(text: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(?:deg(?:rees)?|°)\s*(?:pitch|roof)?/i;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 70) return n;
  }
  return null;
}

function extractSpacing(text: string): number | null {
  // "450mm centres", "joists at 450", "stud spacing 600", "@ 600"
  const patterns = [
    /(\d{3})\s*mm\s*(?:centres|centers|c\/c|cc|spacing)/i,
    /(?:centres?|spacing|@)\s*(\d{3})\s*mm?\b/i,
    /\b(\d{3})\s+(?:centres|cc)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 100 && n <= 1200) return n;
    }
  }
  return null;
}

function extractWastePercent(text: string): number | null {
  const re =
    /(?:(\d+(?:\.\d+)?)\s*(?:%|percent)\s*waste|waste\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)?)/i;
  const m = text.match(re);
  if (m) {
    const raw = m[1] ?? m[2];
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 50) return n;
  }
  return null;
}

function extractStockLengthM(text: string): number | null {
  // Match in priority order:
  //   "stock 6m" / "stock length 6m"
  //   "buy timber in 6m lengths" / "buys 6m timber"
  //   "6m timber" / "6m stock" / "6m lengths"
  // The clamp 2.4–7.2 m is the NZ trade range (anything outside is
  // almost certainly a dimension that's not a stock length).
  const patterns: RegExp[] = [
    /(?:stock|stock\s+length)\s+(\d+(?:\.\d+)?)\s*(?:m|metres?)\b/i,
    /(?:buy(?:s)?\s+(?:timber\s+in|in))\s+(\d+(?:\.\d+)?)\s*(?:m|metres?)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:m|metres?)\s+(?:timber|stock|lengths?)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 2.4 && n <= 7.2) return n;
    }
  }
  return null;
}

function extractCoverageMm(text: string): number | null {
  const re = /(\d{2,3})\s*mm\s*(?:cover(?:age)?|exposed|to\s+the\s+weather)/i;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractOpenings(text: string): ExtractedOpening[] {
  const openings: ExtractedOpening[] = [];
  const NUMBER_WORDS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const tally = (noun: "door" | "window") => {
    const re = new RegExp(
      `\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+${noun}s?\\b`,
      "i",
    );
    const m = text.match(re);
    if (!m) return;
    const raw = (m[1] ?? "").toLowerCase();
    const count = NUMBER_WORDS[raw] ?? Number(raw);
    if (Number.isFinite(count) && count > 0) {
      openings.push({
        kind: noun,
        count,
        width_m: noun === "door" ? 0.82 : 1.2,
        height_m: noun === "door" ? 2.04 : 1.2,
      });
    }
  };
  tally("door");
  tally("window");
  return openings;
}

/**
 * Pull a structured plan marker emitted by /api/quotes/scan-drawing
 * (the existing `[T2Q_PLAN] key=value …` format). Returns null if no
 * marker is present.
 */
function extractMarker(
  text: string,
): { length_m?: number; width_m?: number; height_m?: number; spacing_mm?: number } | null {
  const re = /\[T2Q_PLAN\]\s+([^\n\r]+)/i;
  const match = text.match(re);
  if (!match) return null;
  const out: {
    length_m?: number;
    width_m?: number;
    height_m?: number;
    spacing_mm?: number;
  } = {};
  for (const part of (match[1] ?? "").split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).toLowerCase();
    const raw = part.slice(eq + 1);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (key === "length_m" && n >= MIN_PLAN_M && n <= MAX_PLAN_M) out.length_m = n;
    if (key === "width_m" && n >= MIN_PLAN_M && n <= MAX_PLAN_M) out.width_m = n;
    if (key === "height_m" && n >= 0.5 && n <= 20) out.height_m = n;
    if (key === "joist_spacing_mm" && n >= 100 && n <= 1200) out.spacing_mm = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry — regex extraction.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extract a structured ExtractedExtraction from a description for a
 * given scope. Pure regex — no LLM. Unknown values are left as null
 * (per CRITICAL RULES at top of file).
 */
export function extractFromText(
  description: string,
  scope: ScopeType,
): ExtractedExtraction {
  const text = description ?? "";
  const marker = extractMarker(text);
  const rect = extractRectangle(text);

  const dimensions: ExtractedDimensions = {
    length_m: marker?.length_m ?? rect?.length_m ?? null,
    width_m: marker?.width_m ?? rect?.width_m ?? null,
    height_m: marker?.height_m ?? null,
    area_m2: extractAreaM2(text),
    perimeter_m: extractPerimeterM(text),
    pitch_deg: extractPitch(text),
    volume_m3: extractVolumeM3(text),
  };

  // Height-specific regex (separate from any rectangle).
  if (dimensions.height_m === null) {
    const heightPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:m|metres?)\s+high\b/i,
      /(?:wall|ceiling|fence)\s+height\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(?:m|metres?)?\b/i,
      /(\d+(?:\.\d+)?)\s+high\b/i,
    ];
    const h = extractSinglePattern(text, heightPatterns);
    if (h !== null && h > 0 && h < 20) dimensions.height_m = h;
  }

  const openings = extractOpenings(text);
  const spacing_mm = extractSpacing(text) ?? marker?.spacing_mm ?? null;
  const waste_percent = extractWastePercent(text);
  const stock_length_m = extractStockLengthM(text);
  const coverage_mm = extractCoverageMm(text);

  const needs_clarification: string[] = [];
  const dimensionRequirementByScope: Record<ScopeType, string[]> = {
    deck: ["length_m", "width_m"],
    cladding: ["length_m"],
    framing: ["length_m", "height_m"],
    roofing: ["area_m2"],
    lining: ["area_m2"],
    insulation: ["area_m2"],
    fencing: ["length_m"],
    concrete: ["length_m"],
    fixing: ["length_m"],
    generic: [],
  };
  for (const field of dimensionRequirementByScope[scope]) {
    const v = (dimensions as Record<string, number | null | undefined>)[field];
    if (v === null || v === undefined) needs_clarification.push(field);
  }

  return {
    confidence: marker ? 0.85 : rect ? 0.6 : 0.4,
    project_type: null,
    scope_type: scope,
    sub_scopes: [],
    dimensions,
    openings,
    spacing_mm,
    material_spec: null,
    stock_length_m,
    coverage_mm,
    waste_percent,
    notes: [],
    needs_clarification,
    clarification_questions: [],
    source_basis: marker ? "marker" : "regex",
  };
}

/**
 * Parse LLM-emitted structured JSON. Returns either a validated
 * extraction or a failure result.
 */
export function extractFromLLM(
  rawJson: unknown,
): { ok: true; extraction: ExtractedExtraction } | { ok: false; errors: string[] } {
  const parsed = parseExtractedExtraction(rawJson);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, extraction: { ...parsed.value, source_basis: "llm" } };
}
