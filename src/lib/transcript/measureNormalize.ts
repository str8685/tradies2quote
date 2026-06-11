// ─────────────────────────────────────────────────────────────────────────
// Spoken-measurement normalization — deterministic, NO LLM, NO I/O.
//
// Tradies SPEAK dimensions ("ten metres by two point four", "ninety by
// forty-five", "six hundred mil centres") but every downstream extraction
// regex needs DIGITS. This pass converts spoken numbers to digits ONLY in
// measurement contexts, so quote-critical dimensions survive into the
// takeoff pipeline instead of silently failing extraction.
//
// SAFETY RULES (the whole point):
//   - A number WORD is converted only when it sits in a measurement
//     context: immediately followed by a unit (metres/m/mm/mil/cm/
//     centres/high/wide/long/deep) or paired with "by" in a dimension.
//     "I told the two owners" is never touched.
//   - Existing DIGITS are never altered, ever.
//   - "N mil" → "N mm" only for INTEGER N ("600 mil" is millimetres;
//     "one point five mil" is money slang and is left alone).
//   - "A by B" → "AxB" only when both sides are digits ≤ 1000 (timber
//     profiles / plan dimensions), never across sentence punctuation.
//   - Lines carrying [T2Q_…] scan markers are passed through untouched.
//   - Every change is reported as an audited correction; the caller keeps
//     the raw transcript, so nothing is ever silently rewritten.
//   - Idempotent: running twice changes nothing the second time.
// ─────────────────────────────────────────────────────────────────────────

export type MeasureCorrection = {
  before: string;
  after: string;
  index: number;
};

export type MeasureNormalizeResult = {
  text: string;
  corrections: MeasureCorrection[];
};

// ── Number-word parsing (0–9999, conservative) ─────────────────────────────

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const NUMBER_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|point)";
// A run of number words ("ninety", "twenty five", "six hundred and fifty",
// "two point four"). Hyphens between tens-ones ("forty-five") allowed.
const NUMBER_RUN_RE = new RegExp(
  `\\b${NUMBER_WORD}(?:[\\s-]+${NUMBER_WORD})*\\b`,
  "gi",
);

/** Parse a spoken number run to a digit string, or null if not parseable. */
export function parseNumberRun(run: string): string | null {
  const words = run.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // Split on "point" for decimals: left = integer part, right = digit words.
  const pointIdx = words.indexOf("point");
  const intWords = pointIdx === -1 ? words : words.slice(0, pointIdx);
  const fracWords = pointIdx === -1 ? [] : words.slice(pointIdx + 1);
  if (pointIdx !== -1 && (intWords.length === 0 || fracWords.length === 0)) {
    return null;
  }

  let total = 0;
  let current = 0;
  let sawNumberWord = false;
  for (const w of intWords) {
    if (w === "and") continue;
    if (w in ONES) {
      sawNumberWord = true;
      current += ONES[w];
    } else if (w in TENS) {
      sawNumberWord = true;
      current += TENS[w];
    } else if (w === "hundred") {
      if (current === 0) return null; // bare "hundred" — too ambiguous
      current *= 100;
    } else if (w === "thousand") {
      if (current === 0) return null;
      total += current * 1000;
      current = 0;
    } else {
      return null;
    }
  }
  total += current;
  if (!sawNumberWord) return null; // "and"-only runs are not numbers
  if (total > 9999) return null;

  // Fraction: each word must be a single digit ("two point four five").
  let frac = "";
  for (const w of fracWords) {
    if (w in ONES && ONES[w] <= 9) frac += String(ONES[w]);
    else return null;
  }
  return frac ? `${total}.${frac}` : String(total);
}

// ── Measurement context ─────────────────────────────────────────────────────

// Units / dimension words that LICENSE a conversion when they directly
// follow the number run. "high/wide/long/deep" catch "two point four high".
const UNIT_AFTER_RE =
  /^\s*(?:metres?|meters?|m\b|millimetres?|millimeters?|mm\b|mil\b|mils\b|centimetres?|centimeters?|cm\b|centres?|centers?|high\b|wide\b|long\b|deep\b|square\s+metres?|sqm\b)/i;
// "by" pairing also licenses: "ninety by forty five".
const BY_AFTER_RE = new RegExp(`^\\s*by\\s+(?:${NUMBER_WORD}|\\d)`, "i");
// A preceding "by" licenses the right-hand side of a pair.
const BY_BEFORE_RE = /(?:\bby|x)\s*$/i;

function isMarkerLine(line: string): boolean {
  return /\[T2Q_[A-Z]+\]/.test(line);
}

// ── The pass ────────────────────────────────────────────────────────────────

export function normalizeSpokenMeasurements(
  raw: string,
): MeasureNormalizeResult {
  if (!raw) return { text: "", corrections: [] };
  const corrections: MeasureCorrection[] = [];

  // Process line-by-line so scan-marker lines stay byte-identical.
  const lines = raw.split("\n");
  const outLines = lines.map((line) => {
    if (isMarkerLine(line)) return line;
    let text = line;

    // 1. Number WORDS → digits, only in measurement contexts.
    text = text.replace(NUMBER_RUN_RE, (run, offset: number, full: string) => {
      // Trailing "and" belongs to prose ("ten metres and a door"), not the
      // number — trim it (and recompute) before parsing.
      let core = run;
      while (/[\s-]and$/i.test(core)) core = core.replace(/[\s-]+and$/i, "");
      const after = full.slice(offset + core.length);
      const before = full.slice(0, offset);
      const licensed =
        UNIT_AFTER_RE.test(after) ||
        BY_AFTER_RE.test(after) ||
        BY_BEFORE_RE.test(before);
      if (!licensed) return run;
      const digits = parseNumberRun(core);
      if (digits === null) return run;
      corrections.push({ before: core, after: digits, index: offset });
      return digits + run.slice(core.length);
    });

    // 2. Integer "N mil(s)" → "N mm" (NZ trade speech; decimals = money slang).
    text = text.replace(
      /\b(\d{1,4})\s*mils?\b/gi,
      (m, n: string, offset: number, full: string) => {
        // Don't touch decimals: "1.5 mil" (money). The regex's \b excludes a
        // leading "x." match only partially — check the preceding char.
        const prev = full[offset - 1];
        if (prev === "." || prev === ",") return m;
        const after = `${n}mm`;
        corrections.push({ before: m, after, index: offset });
        return after;
      },
    );

    // 3. Digit pairs "A by B" → "AxB" for profile/plan-scale values (≤1000).
    text = text.replace(
      /\b(\d{1,4}(?:\.\d+)?)\s+by\s+(\d{1,4}(?:\.\d+)?)\b/gi,
      (m, a: string, b: string, offset: number) => {
        if (Number(a) > 1000 || Number(b) > 1000) return m;
        const after = `${a}x${b}`;
        corrections.push({ before: m, after, index: offset });
        return after;
      },
    );

    return text;
  });

  return { text: outLines.join("\n"), corrections };
}
