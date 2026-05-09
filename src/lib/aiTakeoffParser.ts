import type { MaterialTakeoffInput } from "./materialCalculator";

export type ParsedTakeoffResult = {
  input: Partial<MaterialTakeoffInput>;
  missingFields: string[];
  assumptions: string[];
  confidence: number;
};

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

export function parseTakeoffDescription(
  description: string,
  options: ParseOptions = {},
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

  return { input, missingFields, assumptions, confidence };
}

export function canRunCalculator(parsed: ParsedTakeoffResult): boolean {
  return (
    parsed.input.wallLengthM !== undefined &&
    parsed.input.wallLengthM > 0 &&
    parsed.input.wallHeightM !== undefined &&
    parsed.input.wallHeightM > 0 &&
    parsed.input.gibSides !== undefined
  );
}
