// ─────────────────────────────────────────────────────────────────────────
// Scope licensing — POSITIVE allow-list for material families (P0).
//
// The scope router is keyword-permissive by design (it suggests). This
// layer decides what is actually ALLOWED to calculate. The rules:
//
//   - DECK is special-cased fail-closed: it is licensed ONLY by
//     (a) a scan classified as a deck plan (legacy parser type=deck), or
//     (b) an explicit deck noun in the tradie's own words ("deck",
//         "decking", "deck boards" …) — NOT by structural-member words
//         alone. "Fence with 100x50 joists" routes a deck hit but gets a
//         DENIAL: joists/bearers exist in fences, pergolas and subfloors,
//         and deck materials must be impossible without deck evidence.
//   - Every other scope's router keyword hit IS its positive evidence
//     (saying "GIB" licenses lining; saying "insulation" licenses the
//     insulation scope — whose own exterior-wall gate then applies).
//
// A denial is never silent: the orchestrator surfaces it as a warning +
// a non-blocking clarification so the tradie can supply the evidence.
//
// Pure + unit-tested. No LLM, no IO.
// ─────────────────────────────────────────────────────────────────────────

import type { LicenseDenial, ScopeLicense } from "./schemas";
import type { ScopeRoute } from "./scope-router";

export type LicenseContext = {
  /**
   * Legacy scan classification (parseTakeoffDescription().type) when the
   * input came from a drawing scan. "deck" is positive deck evidence.
   */
  scanType?: string | null;
};

// Deck NOUN — explicit deck evidence in the tradie's own words. The
// negative lookahead excludes the verb phrase "deck out" ("deck out the
// office") which is not a deck job; "decked out" likewise.
const DECK_NOUN_RE = /\bdeck(?:ing|s)?\b(?!\s+(?:out|it\s+out))/i;
const DECKED_OUT_RE = /\bdecked\s+out\b/i;

export type LicenseDecision = {
  licenses: ScopeLicense[];
  denials: LicenseDenial[];
};

/**
 * Decide which routed scopes are positively licensed for this job.
 * Deterministic; a scope the router never produced is never licensed.
 */
export function licenseScopes(
  description: string,
  route: ScopeRoute,
  ctx: LicenseContext = {},
): LicenseDecision {
  const text = description ?? "";
  const licenses: ScopeLicense[] = [];
  const denials: LicenseDenial[] = [];

  for (const scope of route.scopes) {
    if (scope === "deck") {
      if (ctx.scanType === "deck") {
        licenses.push({
          scope,
          granted_by: {
            kind: "scan_marker",
            ref: "scan classified this drawing as a deck plan",
          },
          confidence: 0.95,
        });
        continue;
      }
      const deckNoun = DECK_NOUN_RE.exec(text);
      if (deckNoun && !DECKED_OUT_RE.test(text)) {
        licenses.push({
          scope,
          granted_by: {
            kind: "user_statement",
            ref: `"${deckNoun[0]}" in the job description`,
          },
          confidence: 0.9,
        });
        continue;
      }
      denials.push({
        scope,
        reason:
          "Deck materials need explicit deck evidence — joist/bearer words alone " +
          "aren't enough (fences, pergolas and subfloors use them too). Say " +
          '"deck" in the description or scan the deck plan to quote deck materials.',
      });
      continue;
    }

    // All other scopes: the router's keyword hit is the positive evidence.
    const hitCount = route.hits[scope] ?? 0;
    licenses.push({
      scope,
      granted_by: {
        kind: "keyword",
        ref: `${hitCount} ${scope} keyword hit(s) in the job description`,
      },
      confidence: Math.min(0.95, 0.5 + hitCount * 0.1),
    });
  }

  return { licenses, denials };
}

// ─────────────────────────────────────────────────────────────────────────
// Material-family classification of FREE-TEXT lines (LLM output).
//
// Used by the generate route to drop an LLM material line whose family
// is not licensed/calculable for this job — closing the gap where
// "deck joists H3.2 90x45" slipped past the dedupe filters when no deck
// scope existed. Broader than scopeFamily.ts's output-name regex on
// purpose: it classifies free text, so "H3.2 joists" with no "deck"
// prefix still counts as deck family. "floor joists" is FRAMING family
// (subfloors legitimately have them), hence the lookbehind.
// ─────────────────────────────────────────────────────────────────────────

export type MaterialFamily = "deck" | "framing" | "lining" | "insulation";

const FAMILY_PATTERNS: Array<{ family: MaterialFamily; re: RegExp }> = [
  {
    family: "deck",
    re: /\b(?:deck(?:ing)?\s+(?:boards?|screws?|nails?|timber)|(?<!floor\s)joists?|bearers?|joist\s+hangers?|piles?)\b/i,
  },
  {
    family: "insulation",
    re: /\b(?:insulation|pink\s*batts?|batts?|R\d(?:\.\d)?\s*(?:wall|ceiling|floor)?\s*batts?)\b/i,
  },
  {
    family: "lining",
    re: /\b(?:gib|plasterboard|aqualine|fyreline|lining\s+sheets?)\b/i,
  },
  {
    family: "framing",
    re: /\b(?:studs?|top\s+plates?|bottom\s+plates?|nogs?|noggins?|floor\s+joists?|framing\s+(?:timber|pine|nails?))\b/i,
  },
];

/** Classify a free-text material description into a takeoff family. */
export function materialFamilyForDescription(
  description: string,
): MaterialFamily | null {
  for (const { family, re } of FAMILY_PATTERNS) {
    if (re.test(description ?? "")) return family;
  }
  return null;
}
