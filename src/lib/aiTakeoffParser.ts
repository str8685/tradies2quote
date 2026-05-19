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
  const text = (description ?? "").toLowerCase();
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
  const re =
    /(\d+(?:\.\d+)?)\s*(mm|m|metres?|meters?)?\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|m|metres?|meters?)?/i;
  const m = text.match(re);
  if (!m) return undefined;
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
  const a = parseSide(m[1] ?? "", m[2]);
  const b = parseSide(m[3] ?? "", m[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { lengthM: Math.max(a, b), widthM: Math.min(a, b) };
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

function parseDeckDescription(
  description: string,
  options: ParseOptions,
): ParsedTakeoffResult {
  const { applyDefaults = true } = options;
  const text = description ?? "";
  const input: Partial<DeckTakeoffInput> = {};
  const assumptions: string[] = [];
  const missingFields: string[] = [];

  const dims = extractRectangle(text);
  if (dims) {
    input.deckLengthM = dims.lengthM;
    input.deckWidthM = dims.widthM;
  }

  const joistSpacing = extractJoistSpacingMm(text);
  if (joistSpacing !== undefined) {
    input.joistSpacingMm = joistSpacing;
  } else if (applyDefaults) {
    input.joistSpacingMm = 450;
    assumptions.push("Used default joist spacing of 450mm centres.");
  }

  const piles = extractIncludePiles(text);
  if (piles !== undefined) input.includePiles = piles;

  const waste = extractWastePercent(text);
  if (waste !== undefined) input.wastePercent = waste;
  else if (applyDefaults) input.wastePercent = 10;

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

  const wallLength = extractWallLength(text);
  if (wallLength !== undefined) input.wallLengthM = wallLength;

  const wallHeight = extractWallHeight(text);
  if (wallHeight !== undefined) {
    input.wallHeightM = wallHeight;
  } else if (applyDefaults) {
    input.wallHeightM = 2.4;
    assumptions.push("Used default wall height of 2.4m.");
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

  const dims = extractRectangle(text);
  if (dims) {
    input.floorLengthM = dims.lengthM;
    input.floorWidthM = dims.widthM;
  }

  const joistSpacing = extractJoistSpacingMm(text);
  if (joistSpacing !== undefined) {
    input.joistSpacingMm = joistSpacing;
  } else if (applyDefaults) {
    input.joistSpacingMm = 450;
    assumptions.push("Used default joist spacing of 450mm centres.");
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

  const wallLengthM = extractWallLength(text);
  if (wallLengthM !== undefined) input.wallLengthM = wallLengthM;

  const wallHeightM = extractWallHeight(text);
  if (wallHeightM !== undefined) {
    input.wallHeightM = wallHeightM;
  } else if (applyDefaults) {
    input.wallHeightM = 2.4;
    assumptions.push("Used default wall height of 2.4m.");
  }

  const studSpacingMm = extractStudSpacing(text);
  if (studSpacingMm !== undefined) {
    input.studSpacingMm = studSpacingMm;
  } else if (applyDefaults) {
    input.studSpacingMm = 600;
    assumptions.push("Used default stud spacing of 600mm centres.");
  }

  const numberOfDoors = extractCount(text, "door");
  input.numberOfDoors = numberOfDoors ?? 0;

  const numberOfWindows = extractCount(text, "window");
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
