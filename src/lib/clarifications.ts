/**
 * Clarifications — turn the cleanup pass's raw signals into a unified
 * list of "questions with options" that the new-quote modal can render
 * as radio buttons (where we know the answer space) or free-text
 * inputs (where we don't).
 *
 * Wave 36. Inputs come from two places inside `cleanTranscript`:
 *   - The deterministic regex pass emits structured ClarificationItem
 *     objects with stable `id` prefixes that tell us what kind of
 *     ambiguity was hit (jib/gyp -> GIB, pink-batts -> insulation vs
 *     timber, battens -> insulation vs timber).
 *   - The LLM summary call emits three loose string arrays:
 *     material_assumptions, missing_information, compliance_risks.
 *     These are statements rather than questions — we wrap each in a
 *     short confirmation prompt so the modal flow stays uniform.
 *
 * Output: an array of `Clarification` rows. Each row has either a
 * non-empty `options` array (radio choices) OR an empty array (modal
 * renders a free-text input). The modal also tacks on its own "Other"
 * option to every radio set so the tradie always has an escape hatch.
 *
 * This module is pure and synchronous — safe to import from a server
 * route handler, a server action, or a Vitest test.
 */

import type {
  ClarificationItem,
  TranscriptSummary,
} from "./transcriptCleanup";

/** Source of a clarification — drives the answer-prompt copy. */
export type ClarificationSource =
  | "regex"
  | "assumption"
  | "missing_info"
  | "compliance_risk";

/** One question shown in the modal. */
export type Clarification = {
  /** Stable id, used as React key + sent back with the answer. */
  id: string;
  /** Short question the tradie answers. */
  question: string;
  /** One-line "why this matters" subtitle. */
  why: string;
  /**
   * Radio-button options. Empty array = free-text input. The "Other"
   * fallback option is appended by the modal, so callers should NOT
   * put one in here.
   */
  options: string[];
  /** Whether the question came from the regex pass or the LLM. */
  source: ClarificationSource;
};

/** Build inputs — what the cleanup pass produced. */
export type BuildInput = {
  regexQuestions: ClarificationItem[];
  summary: TranscriptSummary | null;
};

/**
 * Hardcoded option sets for the known regex-pass clarification ids.
 *
 * The id prefix is set by `applyDeterministicCorrections` in
 * transcriptCleanup.ts (e.g. `transcript.gib.<offset>`); we match the
 * prefix here so a new id minted by the regex pass for the same
 * pattern still falls into the right bucket.
 *
 * Each option list reflects the most common NZ-tradie picks for that
 * ambiguity. Lengths kept short (≤6) so the radio group fits on a
 * single phone screen without scrolling.
 */
const REGEX_OPTIONS: Record<string, string[]> = {
  "transcript.gib": [
    "GIB Standard 10mm",
    "GIB Standard 13mm",
    "GIB Aqualine 13mm (wet area)",
    "GIB Braceline 13mm (structural)",
    "Not GIB — see note",
  ],
  "transcript.batts": [
    "Pink Batts R1.8 (walls)",
    "Pink Batts R2.2 (walls)",
    "Pink Batts R2.6 (walls)",
    "Pink Batts R3.6 (ceiling)",
    "Timber battens — not insulation",
  ],
  "transcript.battens": [
    "Timber battens — framing / cladding",
    "Pink Batts insulation",
  ],
};

function regexOptionsForId(id: string): string[] {
  // Match by stable prefix; the suffix is a character offset.
  for (const prefix of Object.keys(REGEX_OPTIONS)) {
    if (id.startsWith(`${prefix}.`)) return REGEX_OPTIONS[prefix];
  }
  return [];
}

/**
 * Compose the final list of clarifications shown in the modal.
 *
 * Order is deliberate — regex hits first (most concrete, easiest to
 * answer), then LLM compliance risks (highest-stakes), then missing
 * information (broadest scope), then assumptions (lowest-stakes
 * "did I get this right?" confirmations).
 */
export function buildClarificationsWithOptions(
  input: BuildInput,
): Clarification[] {
  const out: Clarification[] = [];

  // 1. Regex-pass questions — keep their question + why text, attach
  //    a known option set if we recognise the id prefix.
  for (const q of input.regexQuestions) {
    out.push({
      id: q.id,
      question: q.question,
      why: q.why,
      options: regexOptionsForId(q.id),
      source: "regex",
    });
  }

  const s = input.summary;
  if (s) {
    // 2. Compliance risks — wrap each statement as a confirmation
    //    prompt with a binary radio set.
    s.compliance_risks
      .filter((r) => typeof r === "string" && r.trim().length > 0)
      .forEach((risk, i) => {
        out.push({
          id: `compliance.${i}`,
          question: `Confirm: ${risk}`,
          why: "Code-critical detail — confirm before sending.",
          options: ["Confirmed — include as-is", "Need to discuss with client first"],
          source: "compliance_risk",
        });
      });

    // 3. Missing information — these are open-ended ("what is X?"),
    //    so default to a free-text answer (empty options).
    s.missing_information
      .filter((m) => typeof m === "string" && m.trim().length > 0)
      .forEach((missing, i) => {
        out.push({
          id: `missing.${i}`,
          question: missing.endsWith("?") ? missing : `${missing.replace(/[.!]$/, "")}?`,
          why: "T2Q didn't have this detail from the recording.",
          options: [],
          source: "missing_info",
        });
      });

    // 4. Material assumptions — light-touch confirm/deny so the
    //    tradie can quickly green-light or override.
    s.material_assumptions
      .filter((a) => typeof a === "string" && a.trim().length > 0)
      .forEach((assumption, i) => {
        out.push({
          id: `assumption.${i}`,
          question: `T2Q assumed: ${assumption}. Is that right?`,
          why: "Material the recording didn't name explicitly.",
          options: ["Yes — that's what I meant", "No — different material (type below)"],
          source: "assumption",
        });
      });
  }

  return out;
}
