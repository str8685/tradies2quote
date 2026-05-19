/**
 * Wave 41 — "did I hear you right?" highlighter.
 *
 * Splits a transcript into a list of segments tagged as either plain
 * text or a highlighted token. A token is anything that — if misheard
 * by the transcriber — would silently produce a wrong quote: numbers
 * with units, treatment classes (H1 / H3.2 / H4 / H5), and timber
 * size specs like 90x45 / 140x19.
 *
 * The point is NOT to validate correctness. Numbers that look right
 * are still highlighted — the goal is to draw the tradie's eye to
 * the places where a mishear would matter, so they scan-check them
 * in two seconds before tapping "Continue".
 *
 * Pure, no DOM. Caller wraps the tokens in a span however it wants.
 */

export type TranscriptSegment =
  | { kind: "text"; value: string }
  | { kind: "highlight"; value: string };

/**
 * Combined regex with three alternation branches:
 *
 *   1. Size specs:        90x45 / 140x45 / 140x19 / 90x45x2400
 *   2. Treatment classes: H1, H1.2, H3, H3.2, H4, H5
 *   3. Numbers with units: 4m / 4.2m / 1800mm / 450mm / 2.4 metres
 *
 * Order matters: size specs first so we don't tokenise the "90" of
 * "90x45" as a bare number.
 */
const HIGHLIGHT_RE =
  /(\b\d+\s*x\s*\d+(?:\s*x\s*\d+)?\b)|(\bH[1-5](?:\.\d)?\b)|(\b\d+(?:\.\d+)?\s*(?:mm|cm|m|metres?|meters?|kg|kgs|tonnes?)\b)/gi;

export function splitTranscript(text: string): TranscriptSegment[] {
  if (!text) return [];
  const out: TranscriptSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(HIGHLIGHT_RE.source, HIGHLIGHT_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    out.push({ kind: "highlight", value: match[0] });
    lastIndex = match.index + match[0].length;
    // Guard against zero-width matches that would loop forever.
    if (match[0].length === 0) re.lastIndex++;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

/** True if at least one highlightable token exists in the transcript. */
export function hasHighlights(text: string): boolean {
  return new RegExp(HIGHLIGHT_RE.source, HIGHLIGHT_RE.flags).test(text);
}
