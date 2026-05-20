// ─────────────────────────────────────────────────────────────────────────
// Scope router.
//
// Maps a free-text job description (voice transcript / typed entry) to
// the calculator(s) we need to run. Pure regex; no LLM. The router is
// intentionally permissive — when it's uncertain it tags `generic` and
// the orchestrator can fall through to the generic stock/coverage
// calculator, which is safer than guessing wrong.
//
// Order matters: a sentence like "build a 6m fence with a small deck"
// should still resolve to BOTH scopes. We collect every keyword hit and
// dedupe at the end, then pick the most-mentioned scope as the primary.
// ─────────────────────────────────────────────────────────────────────────

import type { ScopeType } from "./schemas";

const SCOPE_PATTERNS: Array<{ scope: ScopeType; pattern: RegExp }> = [
  // Deck — includes "decking" but excludes "deck" as a verb-ish noun.
  { scope: "deck", pattern: /\bdeck(?:ing|s)?\b/i },
  { scope: "deck", pattern: /\b(?:joists?|bearers?|decking\s+boards?)\b/i },

  // Cladding — exterior wall finish.
  {
    scope: "cladding",
    pattern: /\b(?:clad(?:ding)?|weatherboards?|siding|fibre[-\s]?cement)\b/i,
  },
  { scope: "cladding", pattern: /\b(?:cavity\s+battens?|building\s+wrap)\b/i },

  // Framing — structural framing of walls / floors.
  {
    scope: "framing",
    pattern:
      /\b(?:framing|frame\s+(?:a|the)\s+wall|stud(?:s)?(?:\s+(?:wall|partition))?|top\s+plate|bottom\s+plate|noggin|nog\b|sub[-\s]?floor|floor\s+framing|floor\s+joists?)\b/i,
  },

  // Roofing — long-run, tile, sheet.
  {
    scope: "roofing",
    pattern:
      /\b(?:roof(?:ing|s)?|colorsteel|long[-\s]?run|coloursteel|roof\s+sheets?|tiles?\s+(?:roof|on))\b/i,
  },
  { scope: "roofing", pattern: /\b(?:rafters?|purlins?|ridge\s+capping?)\b/i },

  // Lining — interior wall / ceiling lining (GIB / plasterboard).
  {
    scope: "lining",
    pattern:
      /\b(?:gib|plasterboard|aqualine|fyreline|ceiling\s+lining|wall\s+lining|line\s+the\s+wall)\b/i,
  },

  // Insulation — pink batts, R-values.
  {
    scope: "insulation",
    pattern:
      /\b(?:insulation|pink\s*batts?|batts?|R\d(?:\.\d)?(?:\s|$)|wall\s+wrap)\b/i,
  },

  // Fencing — paling, post-and-rail, picket.
  // NB: bare "post(s)" is deliberately NOT a fencing trigger — decks,
  // pergolas and verandas all have posts, so matching it pulled fencing
  // materials (palings/rails) into deck jobs. Require fencing context:
  // "fence", "paling", "picket", or the "post and rail" phrase.
  {
    scope: "fencing",
    pattern:
      /\b(?:fenc(?:e|ing)|palings?|pickets?|posts?\s+and\s+rails?)\b/i,
  },

  // Concrete — slabs, footings, piles.
  {
    scope: "concrete",
    pattern:
      /\b(?:concrete|slab(?:s)?(?:\s+on\s+grade)?|footings?|foundation|pour\b|m[³3]\s*(?:of\s+)?(?:concrete|mix)|driveway)\b/i,
  },

  // Fixing — skirting, architraves, scotia.
  {
    scope: "fixing",
    pattern:
      /\b(?:skirtings?|architraves?|scotia|trim(?:s|ming)?|cover\s+strips?)\b/i,
  },
];

export type ScopeRoute = {
  scopes: ScopeType[];
  primary: ScopeType;
  /** Confidence the routing is correct, in [0,1]. */
  confidence: number;
  /** Per-scope keyword hit counts for debug visibility. */
  hits: Partial<Record<ScopeType, number>>;
};

/**
 * Route a description to its scope(s).
 *
 * Returns at least one scope. When nothing matches we return `generic`
 * so the orchestrator can still produce a stock/coverage takeoff
 * without crashing.
 */
export function routeScope(description: string): ScopeRoute {
  const text = (description ?? "").toLowerCase();
  const hits: Partial<Record<ScopeType, number>> = {};
  for (const { scope, pattern } of SCOPE_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches && matches.length > 0) {
      hits[scope] = (hits[scope] ?? 0) + matches.length;
    }
  }
  const scopes = Object.keys(hits) as ScopeType[];
  if (scopes.length === 0) {
    return {
      scopes: ["generic"],
      primary: "generic",
      confidence: 0,
      hits: {},
    };
  }
  // Primary = scope with the most hits; ties broken by SCOPE_PATTERNS
  // order (deck before cladding etc.) — that matches NZ residential
  // convention where deck/cladding are more specific than framing.
  scopes.sort((a, b) => {
    const ha = hits[a] ?? 0;
    const hb = hits[b] ?? 0;
    if (hb !== ha) return hb - ha;
    return SCOPE_PATTERNS.findIndex((p) => p.scope === a) -
      SCOPE_PATTERNS.findIndex((p) => p.scope === b);
  });
  const primary = scopes[0];
  const totalHits = scopes.reduce((s, sc) => s + (hits[sc] ?? 0), 0);
  // Confidence: more hits → more confident, capped at 0.95 because
  // even a clear match can be wrong about sub-scopes.
  const confidence = Math.min(0.95, 0.4 + totalHits * 0.1);
  return { scopes, primary, confidence, hits };
}

/**
 * Returns true when this scope is one of the original four supported
 * by the existing aiTakeoffParser/materialCalculator pipeline. Used by
 * the orchestrator to decide whether to delegate to the legacy parser
 * or go through the new extraction → calculate path.
 */
export function isLegacyScope(scope: ScopeType): boolean {
  return scope === "deck" || scope === "cladding";
}
