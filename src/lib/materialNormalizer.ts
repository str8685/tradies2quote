/**
 * Stage 4.2 — Material query normalisation.
 *
 * Pure functions. No DB. No side effects.
 *
 * Job: turn a tradie's spoken/typed material description into a structured
 * record that preserves the things which MUST NOT collapse:
 *   - treatment class (H1, H1.2, H3.2, H4, H5)
 *   - timber size (90x45, 100x100)
 *   - sheet thickness (10mm, 13mm)
 *   - brand (Pink Batts, GIB, James Hardie)
 *   - finish (stainless, galvanised, zinc)
 *
 * The output drives both the `search_materials` RPC (filters + query string)
 * and the missing_price decision (so we never invent supplier prices for
 * something we don't know).
 */

export type MaterialCategoryHint =
  | "timber"
  | "plasterboard"
  | "insulation"
  | "fixing"
  | "drainage"
  | "paint"
  | "roofing"
  | "concrete"
  | "unknown";

export type NormalizedMaterialQuery = {
  raw: string;
  normalized: string;
  treatmentClass: string | null;
  size: string | null;
  thicknessMm: number | null;
  brand: string | null;
  tradeName: string | null;
  finish: string | null;
  categoryHint: MaterialCategoryHint;
};

const TREATMENT_RE = /\bh(\d(?:\.\d)?)\b/i;
const SIZE_BY_RE = /\b(\d{2,4})\s*(?:x|by|×|\*)\s*(\d{2,4})\b/i;
const THICKNESS_RE = /\b(\d{1,3})\s*mm\b/i;

/**
 * Spoken-number → digit substitutions, applied as a preprocess pass before
 * the structured regexes run. The compound forms ("h three point two") MUST
 * be checked BEFORE the simple forms ("h three"), otherwise the simple
 * pattern eats the leading "h three" and leaves "point two" stranded.
 */
const SPOKEN_TREATMENT_NUMBERS: Array<[RegExp, string]> = [
  // Compound H-class: "h one point two", "h three point two", etc.
  [/\bh\s+one\s+point\s+two\b/i, "h1.2"],
  [/\bh\s+three\s+point\s+two\b/i, "h3.2"],
  [/\bh\s+four\s+point\s+two\b/i, "h4.2"],
  [/\bh\s+five\s+point\s+two\b/i, "h5.2"],
  // Whole-number H-class — must come AFTER the compound forms above.
  [/\bh\s+one\b/i, "h1"],
  [/\bh\s+two\b/i, "h2"],
  [/\bh\s+three\b/i, "h3"],
  [/\bh\s+four\b/i, "h4"],
  [/\bh\s+five\b/i, "h5"],
];

/**
 * Order matters — earlier entries win. Pink Batts must come before any
 * generic "batt(en)" timber rule, and "GIB Aqualine" must be checked before
 * the bare "GIB" so the trade-name detector sees it first.
 */
const KNOWN_BRANDS: Array<[RegExp, string]> = [
  [/\bpink\s*batts?\b/i, "Pink Batts"],
  [/\bpink\s*bats\b/i, "Pink Batts"], // common typo
  [/\bjames\s*hardie\b/i, "James Hardie"],
  [/\bgib\b/i, "GIB"],
];

const KNOWN_TRADE_NAMES: Array<[RegExp, string]> = [
  [/\baqualine\b/i, "Aqualine"],
  [/\baqua(?!line)\b/i, "Aqualine"], // 'gib aqua' shorthand
  [/\bbraceline\b/i, "Braceline"],
  [/\bnoiseline\b/i, "Noiseline"],
  [/\bstandard\b/i, "Standard"],
];

const KNOWN_FINISHES: Array<[RegExp, string]> = [
  [/\bstainless\b/i, "stainless"],
  [/\bgalvani[sz]ed\b/i, "galvanised"],
  [/\bzinc\b/i, "zinc"],
];

/**
 * Category hint detection. Order matters: insulation must be checked before
 * timber so "Pink Batts" lands in insulation, not "battens" → timber.
 */
const CATEGORY_HINTS: Array<[RegExp, MaterialCategoryHint]> = [
  [/\bpink\s*batts?\b|\bpink\s*bats\b|\binsulation\b|\br[\s-]?value\b/i, "insulation"],
  [
    /\bgib\b|\bplasterboard\b|\baqualine\b|\baqua\b|\bbraceline\b|\bnoiseline\b/i,
    "plasterboard",
  ],
  [
    /\b(post|stud|joist|rafter|noggin|nog|dwang|batten|plate|timber|framing|h\d(?:\.\d)?)\b/i,
    "timber",
  ],
  [/\b(novaflow|drainage|drain\s*coil|sewer\s*pipe|gully)\b/i, "drainage"],
  [/\b(paint|primer|coat|emulsion|enamel|undercoat)\b/i, "paint"],
  [
    /\b(roofing|metalcraft|color[s​]?steel|colour[s​]?steel|colorbond|colourbond)\b/i,
    "roofing",
  ],
  [/\b(concrete|cement|topcrete|gib\s*mix|allwall)\b/i, "concrete"],
  [
    /\b(screws?|nails?|bolts?|fasteners?|brackets?|clips?|hangers?|saddles?|rivets?)\b/i,
    "fixing",
  ],
];

export function normalizeMaterialQuery(input: string): NormalizedMaterialQuery {
  const raw = input ?? "";
  let lower = raw.toLowerCase().trim();

  // Preprocess: substitute spoken treatment numbers BEFORE feature extraction.
  for (const [re, replacement] of SPOKEN_TREATMENT_NUMBERS) {
    lower = lower.replace(re, replacement);
  }

  // Treatment class — preserve precise grade. H1.2 ≠ H3.2 ≠ H4 ≠ H5.
  const tMatch = lower.match(TREATMENT_RE);
  const treatmentClass = tMatch ? `H${tMatch[1]}` : null;

  // Size: "90 by 45" / "90x45" / "90×45" → "90x45"
  const sMatch = lower.match(SIZE_BY_RE);
  const size = sMatch ? `${sMatch[1]}x${sMatch[2]}` : null;

  // Sheet thickness in mm
  const thMatch = lower.match(THICKNESS_RE);
  const thicknessMm = thMatch ? parseInt(thMatch[1], 10) : null;

  // Brand
  let brand: string | null = null;
  for (const [re, label] of KNOWN_BRANDS) {
    if (re.test(lower)) {
      brand = label;
      break;
    }
  }

  // Trade name
  let tradeName: string | null = null;
  for (const [re, label] of KNOWN_TRADE_NAMES) {
    if (re.test(lower)) {
      tradeName = label;
      break;
    }
  }

  // Finish
  let finish: string | null = null;
  for (const [re, label] of KNOWN_FINISHES) {
    if (re.test(lower)) {
      finish = label;
      break;
    }
  }

  // Category — insulation, plasterboard, timber, etc. Order in CATEGORY_HINTS
  // matters; first match wins.
  let categoryHint: MaterialCategoryHint = "unknown";
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(lower)) {
      categoryHint = cat;
      break;
    }
  }

  // Canonical search string for pg_trgm. We DO NOT collapse meaningful
  // distinctions — we only normalise whitespace and the "X by Y" pattern.
  const normalized = lower
    .replace(/\s*(?:by|×|\*)\s*(?=\d)/gi, "x")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw,
    normalized,
    treatmentClass,
    size,
    thicknessMm,
    brand,
    tradeName,
    finish,
    categoryHint,
  };
}
