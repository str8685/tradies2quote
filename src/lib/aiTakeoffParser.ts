import {
  calculateCladdingTakeoff,
  calculateDeckTakeoff,
  calculateMaterialTakeoff,
  calculateSubfloorTakeoff,
  type CladdingTakeoffInput,
  type DeckTakeoffInput,
  type MaterialTakeoffInput,
  type MaterialTakeoffResult,
  type SubfloorTakeoffInput,
} from "./materialCalculator";

/**
 * What kind of job the operator described in voice/text.
 * - "wall":     internal wall framing (the original takeoff)
 * - "deck":     external decking (bearers, joists, boards, piles)
 * - "cladding": exterior weatherboard on a wall
 * - "subfloor": floor framing under the house
 * - "unknown":  no clear signal — falls back to no calculator run
 */
export type TakeoffType =
  | "wall"
  | "deck"
  | "cladding"
  | "subfloor"
  | "unknown";

interface ParsedTakeoffBase {
  missingFields: string[];
  assumptions: string[];
  confidence: number;
}

/**
 * Discriminated union: the `type` field narrows `input` to the right
 * shape automatically, so callers can do `if (r.type === "deck")` and
 * TS will know `r.input` is `Partial<DeckTakeoffInput>`.
 */
export type ParsedTakeoffResult =
  | (ParsedTakeoffBase & { type: "wall"; input: Partial<MaterialTakeoffInput> })
  | (ParsedTakeoffBase & { type: "deck"; input: Partial<DeckTakeoffInput> })
  | (ParsedTakeoffBase & {
      type: "cladding";
      input: Partial<CladdingTakeoffInput>;
    })
  | (ParsedTakeoffBase & {
      type: "subfloor";
      input: Partial<SubfloorTakeoffInput>;
    })
  | (ParsedTakeoffBase & { type: "unknown"; input: Record<string, never> });

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

// ─────────────────────────────────────────────────────────────────────────
// Structured markers (Wave 43)
//
// The scan-drawing route extracts a structured `plan` object from the
// drawing (shape, length_m, width_m, …). That structured data USED to
// be discarded — the ScanPanel built a plain-English transcript and the
// parser had to guess at the deck dimensions by scanning the text for
// "X by Y" patterns. That guess was fragile: if the drawing also had
// a site outline (e.g. 7m × 6m) the parser could grab THAT instead of
// the deck dims (e.g. 4.8m × 3.82m), and the calculator produced a
// 30-m² deck takeoff when the real deck is 18 m². No amount of
// downstream ratio-guarding can fix bad inputs — the dimensions have
// to be right at the source.
//
// The fix: ScanPanel now embeds a deterministic marker line at the top
// of the transcript when the AI produced structured plan data:
//
//   [T2Q_PLAN] type=deck length_m=4.8 width_m=3.82 joist_spacing_mm=450
//   [T2Q_TIMBER] stock_length_m=6
//
// Markers are parsed FIRST, before any loose text matching, so the
// calculator gets the AI's structured guess directly. The free-form
// dimensions textarea stays as-is for AI consumption (it captures
// step heights, post depths, accessories the calculator doesn't model)
// but no longer doubles as the source of truth for the calculator's
// primary plan dimensions.
// ─────────────────────────────────────────────────────────────────────────
const T2Q_PLAN_RE = /\[T2Q_PLAN\]\s+([^\n\r]+)/i;
const T2Q_TIMBER_RE = /\[T2Q_TIMBER\]\s+([^\n\r]+)/i;

function parseMarkerPairs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export interface StructuredPlanMarker {
  type?: string;
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  joistSpacingMm?: number;
  postCount?: number;
  postSpacingM?: number;
  // Wave 44 — whole-drawing wall totals for multi-room floor plans.
  wallRunM?: number;
  studSpacingMm?: number;
  doorCount?: number;
  windowCount?: number;
}

/**
 * Pull `[T2Q_PLAN] key=value key=value …` off the transcript. Returns
 * undefined if no marker, or if the marker's length/width values are
 * outside the sane plan envelope (1m–30m). The envelope check matches
 * `extractRectangle` so a corrupted marker can't bypass the safety
 * floor.
 */
export function extractStructuredPlanMarker(
  text: string,
): StructuredPlanMarker | undefined {
  const m = text.match(T2Q_PLAN_RE);
  if (!m) return undefined;
  const pairs = parseMarkerPairs(m[1] ?? "");
  const optNum = (key: string): number | undefined => {
    const raw = pairs[key];
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const rawLength = optNum("length_m");
  const rawWidth = optNum("width_m");
  // Envelope check — same MIN/MAX as extractRectangle. Out-of-range
  // markers are dropped so a corrupted marker can't bypass the safety
  // floor.
  const MIN_PLAN_M = 1;
  const MAX_PLAN_M = 30;
  if (rawLength !== undefined && (rawLength < MIN_PLAN_M || rawLength > MAX_PLAN_M)) {
    return undefined;
  }
  if (rawWidth !== undefined && (rawWidth < MIN_PLAN_M || rawWidth > MAX_PLAN_M)) {
    return undefined;
  }
  // NZ convention: length ≥ width. The deck calculator runs joists
  // across width and decking along length — silently swapping the
  // two changes joist count (e.g. 7×6 → 17 joists, 6×7 → 15) so
  // normalising here keeps the result deterministic regardless of
  // how the AI labelled the axes.
  let lengthM = rawLength;
  let widthM = rawWidth;
  if (lengthM !== undefined && widthM !== undefined) {
    lengthM = Math.max(rawLength!, rawWidth!);
    widthM = Math.min(rawLength!, rawWidth!);
  }
  // Total wall run — a SUM of every wall segment, so it legitimately exceeds
  // the single-edge plan envelope. Clamp to a whole-house sane band instead.
  const rawWallRun = optNum("wall_run_m");
  const wallRunM =
    rawWallRun !== undefined && rawWallRun >= 2 && rawWallRun <= 1000
      ? rawWallRun
      : undefined;
  const optCount = (key: string): number | undefined => {
    const raw = pairs[key];
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n) : undefined;
  };
  return {
    type: pairs["type"]?.toLowerCase(),
    lengthM,
    widthM,
    heightM: optNum("height_m"),
    joistSpacingMm: optNum("joist_spacing_mm"),
    postCount: optNum("post_count"),
    postSpacingM: optNum("post_spacing_m"),
    wallRunM,
    studSpacingMm: optNum("stud_spacing_mm"),
    doorCount: optCount("door_count"),
    windowCount: optCount("window_count"),
  };
}

/**
 * Pull `[T2Q_TIMBER] stock_length_m=6` off the transcript. Defence
 * against the scan UI's timber-length preference being silently
 * dropped on the way to the calculator. Clamps to the same 2.4–7.2 m
 * band the UI enforces so a bad marker can't produce nonsense.
 */
export function extractTimberStockLengthM(text: string): number | undefined {
  const m = text.match(T2Q_TIMBER_RE);
  if (m) {
    const pairs = parseMarkerPairs(m[1] ?? "");
    const raw = pairs["stock_length_m"];
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 2.4 && n <= 7.2) {
        return Math.round(n * 10) / 10;
      }
    }
  }
  // Fallback to the prose hint the ScanPanel writes ("Tradie buys
  // timber in 6m lengths").
  const re = /buys?\s+timber\s+in\s+(\d+(?:\.\d+)?)\s*(?:m|metres?)?\s+length/i;
  const pm = text.match(re);
  if (pm) {
    const n = Number(pm[1]);
    if (Number.isFinite(n) && n >= 2.4 && n <= 7.2) {
      return Math.round(n * 10) / 10;
    }
  }
  return undefined;
}

function readNumberToken(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const lower = token.toLowerCase();
  if (lower in NUMBER_WORDS) return NUMBER_WORDS[lower];
  const n = Number(token);
  return Number.isFinite(n) ? n : undefined;
}

function extractWallLength(text: string): number | undefined {
  const patterns: RegExp[] = [
    /wall\s+length\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(?:m|metres?)?\b/i,
    /(\d+(?:\.\d+)?)\s*(?:m|metres?)\s+wall(?!\s+(?:height|high))/i,
    /(\d+(?:\.\d+)?)\s*metre\s+wall/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

function extractWallHeight(text: string): number | undefined {
  const patterns: RegExp[] = [
    /(\d+(?:\.\d+)?)\s*(?:m|metres?)\s+high\b/i,
    /(?:wall\s+)?height\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(?:m|metres?)?\b/i,
    /(\d+(?:\.\d+)?)\s+high\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

function extractStudSpacing(text: string): number | undefined {
  const m = text.match(/(\d{3})\s*(?:mm)?\s+centres?\b/i);
  if (m) {
    const v = Number(m[1]);
    if (v === 400 || v === 600) return v;
  }
  return undefined;
}

function extractCount(
  text: string,
  noun: "door" | "window",
): number | undefined {
  const re = new RegExp(
    `\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+${noun}s?\\b`,
    "i",
  );
  const m = text.match(re);
  if (m) {
    const n = readNumberToken(m[1]);
    if (typeof n === "number") return n;
  }
  return undefined;
}

function extractGibSides(text: string): 1 | 2 | undefined {
  if (
    /\b(both\s+sides?|two\s+sides?|gib\s+both|double\s+sided?)/i.test(text)
  ) {
    return 2;
  }
  if (
    /\b(one\s+side(?:\s+only)?|single\s+sided?|gib\s+one\s+side)/i.test(text)
  ) {
    return 1;
  }
  return undefined;
}

function extractIncludeInsulation(text: string): boolean | undefined {
  if (/\b(no\s+insulation|without\s+insulation|skip\s+insulation)\b/i.test(text)) {
    return false;
  }
  if (/\b(insulation|pink\s*batts?|batts?|R\d+(?:\.\d+)?)/i.test(text)) {
    return true;
  }
  return undefined;
}

function extractIncludeSkirting(text: string): boolean | undefined {
  if (/\bno\s+skirtings?\b/i.test(text)) return false;
  if (/\bskirtings?\b/i.test(text)) return true;
  return undefined;
}

function extractIncludeArchitraves(text: string): boolean | undefined {
  if (/\bno\s+architraves?\b/i.test(text)) return false;
  if (/\barchitraves?\b/i.test(text)) return true;
  return undefined;
}

function extractWastePercent(text: string): number | undefined {
  const re =
    /(?:(\d+(?:\.\d+)?)\s*(?:%|percent)\s*waste|waste\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)?)/i;
  const m = text.match(re);
  if (m) {
    const raw = m[1] ?? m[2];
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

export type ParseOptions = {
  applyDefaults?: boolean;
};

/**
 * Pick the takeoff type from a voice/text description.
 *
 * The order of the checks matters — "subfloor" is checked before
 * "deck" because every subfloor is also a deck-shaped structure
 * (joists/bearers/piles) and the subfloor keyword should win when
 * present. Similarly "cladding" is checked before "wall" because
 * "cladding on a 6m wall" is a cladding job, not a framing job.
 *
 * Returns "unknown" when nothing matches; the caller falls back to
 * the AI quote generator instead of a calculator.
 */
export function detectTakeoffType(description: string): TakeoffType {
  const raw = description ?? "";
  const text = raw.toLowerCase();
  // Prefer the structured `[T2Q_PLAN] type=…` marker the scan flow emits —
  // it carries the structure type the AI read off the DRAWING, which is the
  // source of truth. Loose keyword matching on the prose (below) is only a
  // fallback for legacy voice/typed entry that has no marker. Without this,
  // a "Job type: Deck" line or a stray "deck" mention in the prose could
  // force the deck calculator even when the drawing is a house layout the AI
  // never classified as a deck.
  const marker = extractStructuredPlanMarker(raw);
  if (marker?.type) {
    if (marker.type === "subfloor") return "subfloor";
    if (marker.type === "cladding") return "cladding";
    if (marker.type === "deck") return "deck";
    if (marker.type === "wall") return "wall";
    // A marker whose type isn't a calculator type (e.g. the AI classified a
    // house plan, fence or slab) means we have no calculator for it — fall
    // back to the AI generator rather than loose-matching the prose.
    return "unknown";
  }
  if (/\bsub[-\s]?floor\b|\bfloor\s+framing\b|\bfloor\s+joists?\b/.test(text)) {
    return "subfloor";
  }
  if (/\bclad(ding)?\b|\bweatherboards?\b|\bsiding\b/.test(text)) {
    return "cladding";
  }
  if (/\bdeck(ing|s)?\b/.test(text)) {
    return "deck";
  }
  if (/\bwall\b|\bgib\b|\bplasterboard\b|\bframing\b|\bstuds?\b/.test(text)) {
    return "wall";
  }
  return "unknown";
}

/**
 * Pull "L by W" dimensions from a description.
 *
 * Handles every common spoken/typed shorthand:
 *   "6m by 3m", "6 by 3", "6m × 3m", "6m x 3m", "6 metres by 3 metres",
 *   "6×3", "deck 6 by 3", "I'm doing a 4 m x 2 m deck"
 *
 * Returns the larger number as `lengthM`, the smaller as `widthM`. NZ
 * residential convention: long side = length, short side = width. The
 * downstream calculators run joists across width and decking along
 * length — flipping the two would silently swap joist orientation.
 */
function extractRectangle(
  text: string,
): { lengthM: number; widthM: number } | undefined {
  // Capture the value AND any unit suffix on each side so we can
  // disambiguate millimetres from metres. NZ trade drawings almost
  // always write dimensions in mm with the suffix dropped — "4800 x
  // 3820" means 4.8 m × 3.82 m, NOT 4800 m × 3820 m. Older versions
  // of this regex treated bare numbers as metres and produced
  // 1000× quote explosions.
  //
  // matchAll, not match — the transcript can contain multiple "X x Y"
  // patterns (e.g. "Posts 125x125", "Joists 140x45", "Deck 4800x3820")
  // and the FIRST match isn't always the deck plan. We loop and pick
  // the first match where both sides come out in a sane deck range.
  const re =
    /(\d+(?:\.\d+)?)\s*(mm|m|metres?|meters?)?\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|m|metres?|meters?)?/gi;
  const parseSide = (value: string, unit: string | undefined): number => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return NaN;
    const u = (unit ?? "").toLowerCase();
    if (u === "mm") return n / 1000;
    if (u === "m" || u === "metre" || u === "metres" || u === "meter" || u === "meters") {
      return n;
    }
    // Unitless. Apply the "NZ-builder reasonableness" clamp: any
    // plan dimension above 50 m is almost certainly mm written
    // without the suffix. Below 50 m, treat as metres.
    return n > 50 ? n / 1000 : n;
  };
  // A sane deck/wall/slab footprint is 1 m on the short side and at
  // most 30 m on the long side. Anything outside that envelope is
  // almost certainly a timber size (90x45, 125x125, 140x19) or a
  // bay window or fastener spacing, not the plan footprint.
  const MIN_PLAN_M = 1;
  const MAX_PLAN_M = 30;
  for (const m of text.matchAll(re)) {
    const a = parseSide(m[1] ?? "", m[2]);
    const b = parseSide(m[3] ?? "", m[4]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const lengthM = Math.max(a, b);
    const widthM = Math.min(a, b);
    if (widthM < MIN_PLAN_M) continue; // both timber-size or one tiny → skip
    if (lengthM > MAX_PLAN_M) continue; // even after clamp it's too big → skip
    return { lengthM, widthM };
  }
  return undefined;
}

/**
 * Pull the two largest standalone dimensions out of the transcript's
 * DIMENSIONS section. Used as a CROSS-CHECK against the
 * `[T2Q_PLAN]` marker: when the user edits the dimensions textarea
 * to correct what the AI mis-read, those edits should win over the
 * AI's structured plan guess.
 *
 * Scoping is critical. Wave 43 regression: the first version of this
 * function scanned the FULL transcript, including the AI's prose,
 * structural and notes sections. The AI sometimes mentions area /
 * volume values like "deck area 28.8m²" or "concrete 0.45m³ × 60",
 * and the regex would happily lift "28.8m" out of "28.8m²" because
 * `\b` treats `²` as a word boundary. That value then beat the
 * correct marker (6m × 4.8m) in the cross-check because 28.8 ≤ 30,
 * the calculator received a 28.8m × 6m "deck", and emitted 72 joist
 * lengths / 2027m of decking — exactly the bug the marker was
 * meant to PREVENT.
 *
 * Two defences:
 *   1. Restrict scanning to the explicit DIMENSIONS section if it's
 *      present (delimited by "DIMENSIONS (tradie-confirmed):" and
 *      the next "STRUCTURAL"/"NOTES" header). The AI is told to put
 *      ONE PLAN DIMENSION PER LINE in this section — exactly the
 *      shape this helper is meant to read.
 *   2. Tighter unit regex that explicitly rejects m²/m³/m2/m3.
 */
function extractStandaloneDims(
  text: string,
): { lengthM: number; widthM: number } | undefined {
  // Scope to the DIMENSIONS section when present. The whole-transcript
  // path is a fallback for inputs that don't go through ScanPanel
  // (legacy voice / typed entry).
  const dimsSectionRe =
    /DIMENSIONS\s*(?:\([^)]*\))?\s*:?\s*\n([\s\S]*?)(?=\n[A-Z][A-Z\s/&]+:|$)/i;
  const dimsMatch = text.match(dimsSectionRe);
  const scope = dimsMatch ? dimsMatch[1] : text;

  // Strip "X by Y" pairs so they don't double-count as standalone.
  const withoutPairs = scope.replace(
    /\d+(?:\.\d+)?\s*(?:mm|m|metres?|meters?)?\s*(?:by|x|×|\*)\s*\d+(?:\.\d+)?\s*(?:mm|m|metres?|meters?)?/gi,
    " ",
  );

  // Reject m² / m³ / m2 / m3 — those are areas / volumes, not plan
  // dimensions. `(?![²³23])` after the unit is the area/volume
  // guard. `(?!m)` keeps us from matching the first `m` of `mm` as
  // a standalone metre unit.
  const re =
    /(\d+(?:\.\d+)?)\s*(mm|metres?|meters?|m)(?![²³23m])\b/gi;
  const values = new Set<number>();
  const MIN_PLAN_M = 1;
  const MAX_PLAN_M = 30;
  for (const m of withoutPairs.matchAll(re)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = (m[2] ?? "").toLowerCase();
    const inM = unit === "mm" ? n / 1000 : n;
    if (inM < MIN_PLAN_M || inM > MAX_PLAN_M) continue;
    values.add(Math.round(inM * 1000) / 1000);
  }
  if (values.size < 2) return undefined;
  const sorted = Array.from(values).sort((a, b) => b - a);
  return { lengthM: sorted[0], widthM: sorted[1] };
}

function extractJoistSpacingMm(text: string): number | undefined {
  // "450mm centres", "joists at 450mm", "joist centres 600"
  const re =
    /(\d{3})\s*mm\s*(?:centres|centers|cc|c\/c|spacing)|joist(?:\s+centres?|\s+spacing)?\s+(\d{3})\s*mm/i;
  const m = text.match(re);
  if (!m) return undefined;
  const n = Number(m[1] ?? m[2]);
  return Number.isFinite(n) ? n : undefined;
}

function extractIncludePiles(text: string): boolean | undefined {
  if (/\bno\s+piles?\b|\bground[-\s]?level\b/i.test(text)) return false;
  if (/\bon\s+piles?\b|\bpile\s+spacing\b|\braised\b/i.test(text)) return true;
  return undefined;
}

/**
 * Decking board width (mm) from the job text.
 *
 * Decking-ANCHORED on purpose: a deck job also names joist/bearer sizes
 * like "140x45", so we only treat a "WxT" (or "Wmm") as the board width
 * when it sits next to a decking/board reference. Returns undefined when
 * the width isn't stated — the calculator then keeps its 90mm default and
 * the caller surfaces that assumption rather than hiding it.
 *
 * Catches:  "140x32 decking", "decking 140x32",
 *           "150x40 ... decking (140x32)", "140mm decking"
 * Ignores:  "140x45 joists at 450", "100x100 posts"
 */
export function extractDeckBoardWidthMm(text: string): number | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const ok = (w: number) =>
    Number.isFinite(w) && w >= 60 && w <= 200 ? w : undefined;

  // Dressed size in parens next to a decking mention: "decking (140x32)".
  const paren = t.match(/decking[^()]{0,40}\((\d{2,3})\s*[x×]\s*\d{2,3}\)/);
  if (paren) {
    const w = ok(Number(paren[1]));
    if (w) return w;
  }

  // "<WxT> ... decking" (allow grade/treatment tokens in between).
  const before = t.match(
    /(\d{2,3})\s*[x×]\s*\d{2,3}\s*(?:rad\s*|h\d(?:\.\d)?\s*|sg\d\s*|gt\s*|premium\s*|kwila\s*|vitex\s*|garapa\s*|pine\s*)*decking/,
  );
  if (before) {
    const w = ok(Number(before[1]));
    if (w) return w;
  }

  // "decking ... <WxT>"
  const after = t.match(
    /decking\s*(?:boards?\s*)?(?:rad\s*|h\d(?:\.\d)?\s*)*(\d{2,3})\s*[x×]\s*\d{2,3}/,
  );
  if (after) {
    const w = ok(Number(after[1]));
    if (w) return w;
  }

  // "140mm decking" / "decking boards 140mm"
  const mm =
    t.match(/(\d{2,3})\s*mm\s*(?:wide\s*)?(?:deck(?:ing)?|board)/) ??
    t.match(/(?:deck(?:ing)?|board)s?\D{0,12}?(\d{2,3})\s*mm/);
  if (mm) {
    const w = ok(Number(mm[1]));
    if (w) return w;
  }

  return undefined;
}

function parseDeckDescription(
  description: string,
  options: ParseOptions,
): ParsedTakeoffResult {
  const { applyDefaults = true } = options;
  const text = description ?? "";
  const input: Partial<DeckTakeoffInput> = {};
  const assumptions: string[] = [];
  const missingFields: string[] = [];

  // Dimension resolution priority:
  //   1. `[T2Q_PLAN]` marker (AI's structured plan) — UNLESS it
  //      disagrees by > 15% with what the dimensions section actually
  //      says, in which case the user-visible text wins. This catches
  //      the failure mode where the AI mis-read the drawing but
  //      transcribed the prose correctly.
  //   2. Loose "X by Y" rectangle scan with timber-size filter.
  //   3. Two-largest-standalone-dim cross-check, when no rectangle.
  const marker = extractStructuredPlanMarker(text);
  const standalone = extractStandaloneDims(text);

  const useMarker =
    marker &&
    (marker.type === undefined || marker.type === "deck") &&
    marker.lengthM !== undefined &&
    marker.widthM !== undefined;

  if (useMarker) {
    // Cross-check against user-visible standalone dims. If the
    // marker disagrees by > 15% in EITHER axis, the dimensions text
    // (which the tradie has reviewed and edited) wins.
    // Tolerance: 25% in EITHER axis. Tightened from 15% in Wave 43b
    // because the cross-check kept misfiring on L-shaped decks where
    // the DIMENSIONS section lists multiple edge lengths and the
    // marker bounds the enclosing rectangle. The marker is right
    // more often than not — only override when there's a meaningful
    // disagreement.
    const TOLERANCE = 0.25;
    const disagrees =
      standalone &&
      (Math.abs(marker.lengthM! - standalone.lengthM) / standalone.lengthM >
        TOLERANCE ||
        Math.abs(marker.widthM! - standalone.widthM) / standalone.widthM >
          TOLERANCE);
    // Plausibility guard: the standalone-dim extractor sometimes offers an
    // AREA figure (e.g. 28.8 = 6 × 4.8) or another oversized number as a
    // side length. Don't let the text override a sane AI plan when a side
    // ≈ the plan's area or is implausibly large for a residential deck —
    // that bug turned a 6×4.8 deck into 28.8×6 (72 joists).
    const deckMarkerArea = marker.lengthM! * marker.widthM!;
    const standaloneSuspect =
      !!standalone &&
      ((deckMarkerArea > 0 &&
        Math.abs(standalone.lengthM - deckMarkerArea) / deckMarkerArea < 0.1) ||
        (deckMarkerArea > 0 &&
          Math.abs(standalone.widthM - deckMarkerArea) / deckMarkerArea < 0.1) ||
        Math.max(standalone.lengthM, standalone.widthM) > 25);
    if (disagrees && !standaloneSuspect) {
      input.deckLengthM = standalone.lengthM;
      input.deckWidthM = standalone.widthM;
      assumptions.push(
        `AI's structured plan (${marker.lengthM}m × ${marker.widthM}m) disagreed with the dimensions text (${standalone.lengthM}m × ${standalone.widthM}m). Using the dimensions text.`,
      );
    } else if (disagrees && standaloneSuspect && standalone) {
      input.deckLengthM = marker.lengthM;
      input.deckWidthM = marker.widthM;
      assumptions.push(
        `Dimensions text (${standalone.lengthM}m × ${standalone.widthM}m) looked like an area or an implausible length — kept the AI plan (${marker.lengthM}m × ${marker.widthM}m).`,
      );
    } else {
      input.deckLengthM = marker.lengthM;
      input.deckWidthM = marker.widthM;
    }
  } else {
    const dims = extractRectangle(text);
    if (dims) {
      input.deckLengthM = dims.lengthM;
      input.deckWidthM = dims.widthM;
    } else if (standalone) {
      input.deckLengthM = standalone.lengthM;
      input.deckWidthM = standalone.widthM;
    }
  }

  const joistSpacing =
    extractJoistSpacingMm(text) ?? marker?.joistSpacingMm;
  if (joistSpacing !== undefined) {
    input.joistSpacingMm = joistSpacing;
  } else if (applyDefaults) {
    input.joistSpacingMm = 450;
    assumptions.push("Used default joist spacing of 450mm centres.");
  }

  const timberStock = extractTimberStockLengthM(text);
  if (timberStock !== undefined) {
    input.timberStockLengthM = timberStock;
  }

  const piles = extractIncludePiles(text);
  if (piles !== undefined) input.includePiles = piles;

  const waste = extractWastePercent(text);
  if (waste !== undefined) input.wastePercent = waste;
  else if (applyDefaults) input.wastePercent = 10;

  // Decking board width drives the lineal-metre count. When the tradie
  // states it (e.g. "140x32 decking") we use it; otherwise the calculator
  // keeps its 90mm default — but we make that ASSUMPTION VISIBLE rather
  // than silently costing wide boards as narrow ones.
  const boardWidthMm = extractDeckBoardWidthMm(text);
  if (boardWidthMm !== undefined) {
    input.boardWidthMm = boardWidthMm;
    if (boardWidthMm !== 90) {
      assumptions.push(`Decking width ${boardWidthMm}mm (read from your description).`);
    }
  } else if (applyDefaults) {
    assumptions.push(
      'Assumed 90mm decking boards — say e.g. "140mm decking" if yours are wider.',
    );
  }

  if (input.deckLengthM === undefined || input.deckWidthM === undefined) {
    missingFields.push("Deck length and width.");
  }

  let confidence = 0;
  if (input.deckLengthM !== undefined) confidence += 0.5;
  if (input.deckWidthM !== undefined) confidence += 0.3;
  if (joistSpacing !== undefined) confidence += 0.1;
  if (piles !== undefined) confidence += 0.1;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  return {
    type: "deck",
    input,
    missingFields,
    assumptions,
    confidence,
  };
}

function parseCladdingDescription(
  description: string,
  options: ParseOptions,
): ParsedTakeoffResult {
  const { applyDefaults = true } = options;
  const text = description ?? "";
  const input: Partial<CladdingTakeoffInput> = {};
  const assumptions: string[] = [];
  const missingFields: string[] = [];

  const marker = extractStructuredPlanMarker(text);

  const wallLength = extractWallLength(text) ?? marker?.lengthM;
  if (wallLength !== undefined) input.wallLengthM = wallLength;

  const wallHeight = extractWallHeight(text) ?? marker?.heightM;
  if (wallHeight !== undefined) {
    input.wallHeightM = wallHeight;
  } else if (applyDefaults) {
    input.wallHeightM = 2.4;
    assumptions.push("Used default wall height of 2.4m.");
  }

  const timberStock = extractTimberStockLengthM(text);
  if (timberStock !== undefined) {
    input.timberStockLengthM = timberStock;
  }

  // Openings — count windows + doors, estimate area from defaults.
  const doors = extractCount(text, "door");
  const windows = extractCount(text, "window");
  const numberOfOpenings = (doors ?? 0) + (windows ?? 0);
  if (numberOfOpenings > 0) {
    input.numberOfOpenings = numberOfOpenings;
    // Estimate opening area: doors 0.82×2.04 = 1.67m², windows 1.2×1.2 = 1.44m²
    const estimatedArea =
      (doors ?? 0) * 1.67 + (windows ?? 0) * 1.44;
    input.openingAreaM2 = Math.round(estimatedArea * 100) / 100;
    if (applyDefaults) {
      assumptions.push(
        `Estimated opening area from ${doors ?? 0} door(s) + ${windows ?? 0} window(s) at standard sizes.`,
      );
    }
  }

  const waste = extractWastePercent(text);
  if (waste !== undefined) input.wastePercent = waste;
  else if (applyDefaults) input.wastePercent = 10;

  if (input.wallLengthM === undefined) {
    missingFields.push("Wall length.");
  }

  let confidence = 0;
  if (input.wallLengthM !== undefined) confidence += 0.5;
  if (wallHeight !== undefined) confidence += 0.2;
  if (numberOfOpenings > 0) confidence += 0.2;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  return {
    type: "cladding",
    input,
    missingFields,
    assumptions,
    confidence,
  };
}

function parseSubfloorDescription(
  description: string,
  options: ParseOptions,
): ParsedTakeoffResult {
  const { applyDefaults = true } = options;
  const text = description ?? "";
  const input: Partial<SubfloorTakeoffInput> = {};
  const assumptions: string[] = [];
  const missingFields: string[] = [];

  const marker = extractStructuredPlanMarker(text);
  const standalone = extractStandaloneDims(text);
  const useMarker =
    marker &&
    (marker.type === undefined || marker.type === "subfloor") &&
    marker.lengthM !== undefined &&
    marker.widthM !== undefined;
  if (useMarker) {
    // Tolerance: 25% in EITHER axis. Tightened from 15% in Wave 43b
    // because the cross-check kept misfiring on L-shaped decks where
    // the DIMENSIONS section lists multiple edge lengths and the
    // marker bounds the enclosing rectangle. The marker is right
    // more often than not — only override when there's a meaningful
    // disagreement.
    const TOLERANCE = 0.25;
    const disagrees =
      standalone &&
      (Math.abs(marker.lengthM! - standalone.lengthM) / standalone.lengthM >
        TOLERANCE ||
        Math.abs(marker.widthM! - standalone.widthM) / standalone.widthM >
          TOLERANCE);
    // Plausibility guard (same as the deck path): reject a standalone side
    // that ≈ the plan's area, or is implausibly large for a residential
    // floor, so an area-as-length read can't override a sane AI plan.
    const floorMarkerArea = marker.lengthM! * marker.widthM!;
    const standaloneSuspect =
      !!standalone &&
      ((floorMarkerArea > 0 &&
        Math.abs(standalone.lengthM - floorMarkerArea) / floorMarkerArea <
          0.1) ||
        (floorMarkerArea > 0 &&
          Math.abs(standalone.widthM - floorMarkerArea) / floorMarkerArea <
            0.1) ||
        Math.max(standalone.lengthM, standalone.widthM) > 25);
    if (disagrees && !standaloneSuspect) {
      input.floorLengthM = standalone.lengthM;
      input.floorWidthM = standalone.widthM;
      assumptions.push(
        `AI's structured plan (${marker.lengthM}m × ${marker.widthM}m) disagreed with the dimensions text (${standalone.lengthM}m × ${standalone.widthM}m). Using the dimensions text.`,
      );
    } else if (disagrees && standaloneSuspect && standalone) {
      input.floorLengthM = marker.lengthM;
      input.floorWidthM = marker.widthM;
      assumptions.push(
        `Dimensions text (${standalone.lengthM}m × ${standalone.widthM}m) looked like an area or an implausible length — kept the AI plan (${marker.lengthM}m × ${marker.widthM}m).`,
      );
    } else {
      input.floorLengthM = marker.lengthM;
      input.floorWidthM = marker.widthM;
    }
  } else {
    const dims = extractRectangle(text);
    if (dims) {
      input.floorLengthM = dims.lengthM;
      input.floorWidthM = dims.widthM;
    } else if (standalone) {
      input.floorLengthM = standalone.lengthM;
      input.floorWidthM = standalone.widthM;
    }
  }

  const joistSpacing =
    extractJoistSpacingMm(text) ?? marker?.joistSpacingMm;
  if (joistSpacing !== undefined) {
    input.joistSpacingMm = joistSpacing;
  } else if (applyDefaults) {
    input.joistSpacingMm = 450;
    assumptions.push("Used default joist spacing of 450mm centres.");
  }

  const timberStock = extractTimberStockLengthM(text);
  if (timberStock !== undefined) {
    input.timberStockLengthM = timberStock;
  }

  const waste = extractWastePercent(text);
  if (waste !== undefined) input.wastePercent = waste;
  else if (applyDefaults) input.wastePercent = 10;

  if (input.floorLengthM === undefined || input.floorWidthM === undefined) {
    missingFields.push("Floor length and width.");
  }

  let confidence = 0;
  if (input.floorLengthM !== undefined) confidence += 0.5;
  if (input.floorWidthM !== undefined) confidence += 0.3;
  if (joistSpacing !== undefined) confidence += 0.2;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  return {
    type: "subfloor",
    input,
    missingFields,
    assumptions,
    confidence,
  };
}

export function parseTakeoffDescription(
  description: string,
  options: ParseOptions = {},
): ParsedTakeoffResult {
  const type = detectTakeoffType(description);
  if (type === "deck") return parseDeckDescription(description, options);
  if (type === "cladding") {
    return parseCladdingDescription(description, options);
  }
  if (type === "subfloor") return parseSubfloorDescription(description, options);
  // Fall through to the original wall framing parser for type === "wall"
  // or "unknown" (the unknown branch produces an empty wall result which
  // canRunCalculator rejects, so the route falls back to the AI generator).
  return parseWallDescription(description, options);
}

function parseWallDescription(
  description: string,
  options: ParseOptions,
): ParsedTakeoffResult {
  const { applyDefaults = true } = options;
  const text = description ?? "";
  const input: Partial<MaterialTakeoffInput> = {};
  const assumptions: string[] = [];
  const missingFields: string[] = [];

  const marker = extractStructuredPlanMarker(text);

  // Wall framing scales every quantity (studs/plates/nogs/GIB/insulation)
  // off the wall RUN. For a multi-room floor plan that's the TOTAL of every
  // wall segment (marker.wallRunM), NOT a single bounding-box edge. Prefer
  // it; fall back to a single explicit "wall length" or the marker's edge
  // length for a one-wall job, keeping old transcripts byte-identical.
  let wallLengthM = marker?.wallRunM;
  let usedWallRun = false;
  if (wallLengthM !== undefined) {
    usedWallRun = true;
  } else {
    wallLengthM = extractWallLength(text) ?? marker?.lengthM;
  }
  if (wallLengthM !== undefined) input.wallLengthM = wallLengthM;
  if (usedWallRun) {
    assumptions.push(
      `Framed off the total wall run (${wallLengthM}m) — every exterior and interior wall summed from the floor plan.`,
    );
  }

  const wallHeightM = extractWallHeight(text) ?? marker?.heightM;
  if (wallHeightM !== undefined) {
    input.wallHeightM = wallHeightM;
  } else if (applyDefaults) {
    input.wallHeightM = 2.4;
    assumptions.push("Used default wall height of 2.4m.");
  }

  const timberStock = extractTimberStockLengthM(text);
  if (timberStock !== undefined) {
    input.timberStockLengthM = timberStock;
  }

  // The legacy wall calculator only models 400/600 stud centres. Take the
  // marker spacing only when it's one of those; otherwise fall through to
  // the default so we don't emit a "studSpacingMm must be 400 or 600" warning.
  const markerStud =
    marker?.studSpacingMm === 400 || marker?.studSpacingMm === 600
      ? marker.studSpacingMm
      : undefined;
  const studSpacingMm = extractStudSpacing(text) ?? markerStud;
  if (studSpacingMm !== undefined) {
    input.studSpacingMm = studSpacingMm;
  } else if (applyDefaults) {
    input.studSpacingMm = 600;
    assumptions.push("Used default stud spacing of 600mm centres.");
  }

  const numberOfDoors = extractCount(text, "door") ?? marker?.doorCount;
  input.numberOfDoors = numberOfDoors ?? 0;

  const numberOfWindows = extractCount(text, "window") ?? marker?.windowCount;
  input.numberOfWindows = numberOfWindows ?? 0;

  const gibSides = extractGibSides(text);
  if (gibSides !== undefined) input.gibSides = gibSides;

  const insulation = extractIncludeInsulation(text);
  if (insulation !== undefined) {
    input.includeInsulation = insulation;
  } else if (applyDefaults) {
    input.includeInsulation = true;
    assumptions.push("Assumed insulation is included unless stated otherwise.");
  }

  const skirting = extractIncludeSkirting(text);
  if (skirting !== undefined) input.includeSkirting = skirting;

  const architraves = extractIncludeArchitraves(text);
  if (architraves !== undefined) input.includeArchitraves = architraves;

  const wastePercent = extractWastePercent(text);
  if (wastePercent !== undefined) {
    input.wastePercent = wastePercent;
  } else if (applyDefaults) {
    input.wastePercent = 10;
  }

  if (input.wallLengthM === undefined) {
    missingFields.push("Wall length.");
  }
  if (input.wallHeightM === undefined) {
    missingFields.push("Wall height.");
  }
  if (input.gibSides === undefined) {
    missingFields.push("GIB one side or both sides?");
  }

  let confidence = 0;
  if (input.wallLengthM !== undefined) confidence += 0.4;
  if (input.gibSides !== undefined) confidence += 0.3;
  if (wallHeightM !== undefined) confidence += 0.1;
  if (numberOfDoors !== undefined) confidence += 0.05;
  if (numberOfWindows !== undefined) confidence += 0.05;
  if (insulation !== undefined) confidence += 0.05;
  if (skirting !== undefined) confidence += 0.025;
  if (architraves !== undefined) confidence += 0.025;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  return {
    type: "wall",
    input,
    missingFields,
    assumptions,
    confidence,
  };
}

/**
 * Dispatch on type: do we have enough parsed input to actually run a
 * calculator, or do we need to fall back to AI generation?
 */
export function canRunCalculator(parsed: ParsedTakeoffResult): boolean {
  if (parsed.type === "deck") {
    const i = parsed.input as Partial<DeckTakeoffInput>;
    return (
      i.deckLengthM !== undefined &&
      i.deckLengthM > 0 &&
      i.deckWidthM !== undefined &&
      i.deckWidthM > 0
    );
  }
  if (parsed.type === "cladding") {
    const i = parsed.input as Partial<CladdingTakeoffInput>;
    return (
      i.wallLengthM !== undefined &&
      i.wallLengthM > 0 &&
      i.wallHeightM !== undefined &&
      i.wallHeightM > 0
    );
  }
  if (parsed.type === "subfloor") {
    const i = parsed.input as Partial<SubfloorTakeoffInput>;
    return (
      i.floorLengthM !== undefined &&
      i.floorLengthM > 0 &&
      i.floorWidthM !== undefined &&
      i.floorWidthM > 0
    );
  }
  // wall (original) — need length + height + gibSides
  const i = parsed.input as Partial<MaterialTakeoffInput>;
  return (
    i.wallLengthM !== undefined &&
    i.wallLengthM > 0 &&
    i.wallHeightM !== undefined &&
    i.wallHeightM > 0 &&
    i.gibSides !== undefined
  );
}

/**
 * Single entry point the route calls: parse → run the matching
 * calculator → return the unified result. Returns null when the
 * parsed result doesn't have enough to run (caller falls back to AI
 * generation).
 */
export function runTakeoff(parsed: ParsedTakeoffResult): MaterialTakeoffResult | null {
  if (!canRunCalculator(parsed)) return null;
  if (parsed.type === "deck") {
    return calculateDeckTakeoff(parsed.input as DeckTakeoffInput);
  }
  if (parsed.type === "cladding") {
    return calculateCladdingTakeoff(parsed.input as CladdingTakeoffInput);
  }
  if (parsed.type === "subfloor") {
    return calculateSubfloorTakeoff(parsed.input as SubfloorTakeoffInput);
  }
  return calculateMaterialTakeoff(parsed.input as MaterialTakeoffInput);
}
