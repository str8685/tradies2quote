/**
 * Voice Cleanup Agent — pure rule-based transcript cleaner.
 *
 * Takes a raw voice transcript and produces a cleaner, scoped version
 * the tradie can paste into the quote's job description / scope field.
 *
 * Safety:
 *   - Pure function. No I/O, no AI, no DB writes.
 *   - The original transcript is never modified — the UI shows both
 *     "Original" and "Cleaned" side-by-side and the user clicks an
 *     Apply / Copy button to move the cleaned version anywhere.
 *
 * Cleanup steps (in order):
 *   1. Trim outer whitespace.
 *   2. Collapse runs of whitespace into single spaces (within a line).
 *   3. Drop common filler words ("um", "uh", "like", "you know", etc.)
 *      when they sit as standalone tokens.
 *   4. Remove repeated stutter-style word doublings ("the the wall").
 *   5. Capitalise sentence starts after `.` / `!` / `?`.
 *   6. Insert paragraph breaks before topic-change cue phrases
 *      ("then we", "next", "after that", "as well").
 *   7. Ensure the result ends with a sentence-final punctuation mark.
 */

const FILLERS = [
  "um",
  "umm",
  "uh",
  "uhh",
  "ah",
  "ahh",
  "er",
  "erm",
  "like",
  "kinda",
  "kind of",
  "sort of",
  "basically",
  "literally",
  "you know",
  "you know what i mean",
  "i mean",
  "i guess",
  "anyway",
];

const TOPIC_CUES = [
  /\b(?:then|next|after that|after which|then we'll|so then)\b/i,
  /\b(?:as well|also|on top of that|plus)\b/i,
  /\b(?:exclud(?:e|ing)|not included|does not include)\b/i,
];

function stripFillers(text: string): string {
  let out = text;
  for (const filler of FILLERS) {
    // Match standalone tokens — preceded by start/whitespace/punctuation,
    // followed by whitespace/punctuation/end. Case-insensitive.
    const safe = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(^|[\\s,;.!?-])${safe}(?=[\\s,;.!?]|$)`,
      "gi",
    );
    out = out.replace(re, "$1");
  }
  return out;
}

function dropDoubleWords(text: string): string {
  return text.replace(
    /\b(\w+)\s+\1\b/gi,
    (m, w) => (m.toLowerCase() === `${w} ${w}`.toLowerCase() ? w : m),
  );
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c: string) =>
    `${p}${c.toUpperCase()}`,
  );
}

function paragraphBreaks(text: string): string {
  let out = text;
  for (const cue of TOPIC_CUES) {
    out = out.replace(cue, (m) => `\n\n${m}`);
  }
  // Collapse 3+ newlines back to 2.
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function ensureTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function collapseSpaces(text: string): string {
  // Preserve newlines, collapse all OTHER whitespace runs.
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
}

export interface VoiceCleanupResult {
  cleaned: string;
  originalLength: number;
  cleanedLength: number;
  /** Whether cleanup actually changed anything. Useful for "no change"
   *  UI states. */
  changed: boolean;
}

export function runVoiceCleanup(original: string): VoiceCleanupResult {
  const src = original ?? "";
  let s = src;
  s = collapseSpaces(s);
  s = stripFillers(s);
  s = dropDoubleWords(s);
  // Collapse the extra whitespace stripFillers left behind.
  s = collapseSpaces(s);
  s = paragraphBreaks(s);
  s = capitalizeSentences(s);
  s = ensureTerminalPunctuation(s.trim());
  return {
    cleaned: s,
    originalLength: src.length,
    cleanedLength: s.length,
    changed: s.trim() !== src.trim(),
  };
}
