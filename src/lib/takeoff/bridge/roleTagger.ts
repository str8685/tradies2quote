// ─────────────────────────────────────────────────────────────────────────
// roleTagger — DETERMINISTIC text role tagger, SCAFFOLD ONLY (non-runtime).
//
// The "secondary" role source from FLOORPLAN_ROLE_CONTRACT.md §1: assigns a
// dimension's ROLE *only* when the sheet's raw printed text EXPLICITLY names
// it. It never infers a role from a bare value, and it never guesses — an
// unmatched label is returned untagged and must go to USER CONFIRMATION
// (the primary source).
//
// Pure + deterministic. NOT imported by any route, UI, calculator, or live
// planreader flow. No wiring.
//
// Semantics (per the contract):
//   - `length` ALWAYS means total wall run — only "wall length/run" text maps
//     here. "overall length" is a BUILDING dimension → `building_length`, which
//     no calculator consumes (no silent reinterpretation as wall run).
// ─────────────────────────────────────────────────────────────────────────

import type { DimensionRole, RoledDimension } from "./sheetToExtraction";

/** A raw labelled dimension as read off the sheet (value + the printed text). */
export interface RawLabelledDimension {
  /** Canonical metric value (m, or m² for area). */
  value_m: number;
  /** The text printed next to / containing the value. */
  raw_text: string;
}

// Ordered patterns — FIRST match wins. Each only fires on EXPLICIT role text.
// Order matters: "wall length" (wall run) is tested before the generic overall
// dims so "overall wall length" reads as a wall run, and bare "overall length"
// (no "wall") falls to building_length.
const PATTERNS: Array<{ role: DimensionRole; re: RegExp }> = [
  { role: "height", re: /\b(stud|ceiling|wall)\s+height\b/i },
  {
    role: "area",
    re: /\b(floor\s+area|gross\s+floor\s+area|g\.?f\.?a\.?|total\s+floor\s+area)\b/i,
  },
  {
    role: "perimeter",
    re: /\b(perimeter|exterior\s+wall\s+run|external\s+wall\s+run)\b/i,
  },
  // length = TOTAL WALL RUN — must explicitly say "wall length/run".
  {
    role: "length",
    re: /\b(total\s+wall\s+length|total\s+wall\s+run|wall\s+run|wall\s+length)\b/i,
  },
  // Overall BUILDING dims — recognized, but NOT a calculator role.
  { role: "building_length", re: /\b(overall\s+length|building\s+length)\b/i },
  { role: "building_width", re: /\b(overall\s+width|building\s+width)\b/i },
];

/**
 * Tag ONE raw dimension. Returns a RoledDimension with
 * `source: "labelled-sheet-confirmed"` when the text explicitly names a role,
 * else `null` (→ user confirmation). Junk values (≤0 / non-finite) → null;
 * they are never coerced.
 */
export function tagDimensionRole(
  d: RawLabelledDimension,
): RoledDimension | null {
  if (!Number.isFinite(d.value_m) || d.value_m <= 0) return null;
  const text = (d.raw_text ?? "").trim();
  if (!text) return null;
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      return {
        role: p.role,
        value_m: d.value_m,
        source: "labelled-sheet-confirmed",
      };
    }
  }
  return null;
}

/**
 * Tag a batch. Returns the confidently-tagged dimensions and the leftover
 * `untagged` raws that still require user confirmation. Never mutates input.
 */
export function tagDimensions(dims: readonly RawLabelledDimension[]): {
  tagged: RoledDimension[];
  untagged: RawLabelledDimension[];
} {
  const tagged: RoledDimension[] = [];
  const untagged: RawLabelledDimension[] = [];
  for (const d of dims) {
    const r = tagDimensionRole(d);
    if (r) tagged.push(r);
    else untagged.push(d);
  }
  return { tagged, untagged };
}
