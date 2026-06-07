// ─────────────────────────────────────────────────────────────────────────
// Scope-family guard — deterministic defense-in-depth.
//
// Even if routing ever picks the wrong calculator, DECK-only material families
// (deck joists/bearers/decking boards/concrete piles + their fixings) must
// NEVER appear in a wall / framing / interior-partition / building quote. This
// guard strips such lines from a non-deck, non-subfloor quote (a subfloor
// legitimately has floor joists/bearers/piles, so it is exempt) and reports
// what it dropped so the caller can surface an explicit blocked/review state
// instead of a silently-wrong or empty material list.
//
// Pure + unit-tested. Matches on the DECK calculator's own output names, so it
// can't accidentally strip a framing/GIB/insulation line.
// ─────────────────────────────────────────────────────────────────────────

export type ScopeFamily = "deck" | "subfloor" | "building" | "other";

/** Map a takeoff/scope type to its material family. */
export function scopeFamilyForType(type: string | null | undefined): ScopeFamily {
  switch (type) {
    case "deck":
      return "deck";
    case "subfloor":
      return "subfloor";
    case "wall":
    case "framing":
    case "lining":
    case "insulation":
    case "cladding":
    case "fixing":
      return "building";
    default:
      return "other";
  }
}

// The DECK calculator's exact output material names (calculateDeckTakeoff).
// Anchored to "deck"/"decking"/"pile"/"joist hanger" so a framing line
// ("90x45 SG8 Studs", "10mm GIB Board", "Pink Batts Insulation") never matches.
const DECK_FAMILY_RE =
  /\b(deck\s+joists?|deck\s+bearers?|decking\s+boards?|decking\s+screws?|joist\s+hangers?|joist\s+hanger\s+nails?|concrete\s+piles?)\b/i;

const DECK_FAMILY_CATEGORIES = new Set(["Joists", "Bearers", "Decking", "Piles"]);

/** True when a line is a DECK-only material (by category or output name). */
export function isDeckFamilyLine(line: {
  description?: string | null;
  category?: string | null;
}): boolean {
  if (line.category && DECK_FAMILY_CATEGORIES.has(line.category)) return true;
  return DECK_FAMILY_RE.test(line.description ?? "");
}

/**
 * Remove deck-only material lines when the quote is NOT deck- or subfloor-scoped.
 * Returns the kept lines and the dropped lines (empty when nothing was stripped
 * or when the family legitimately uses those materials).
 */
export function guardLinesForScope<
  T extends { description?: string | null; category?: string | null },
>(lines: T[], family: ScopeFamily): { kept: T[]; dropped: T[] } {
  if (family === "deck" || family === "subfloor") {
    return { kept: lines, dropped: [] };
  }
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const line of lines) {
    if (isDeckFamilyLine(line)) dropped.push(line);
    else kept.push(line);
  }
  return { kept, dropped };
}
