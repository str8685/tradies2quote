/**
 * Wall classifier (rule category A).
 *
 * Pure functions over the description + `JobContext.wall`. Decides:
 *
 *   1. Does this job involve a wall? (keyword scan over description.)
 *   2. If yes, what wall sub-classifications are *known* from the
 *      explicit `JobContext.wall` fields? (We never guess — unknown
 *      stays unknown.)
 *
 * What's known here drives the downstream rules:
 *   - Internal vs external → insulation rules + fastener rules
 *   - Loadbearing/bracing → NZS 3604 framing/connector rules
 *   - Wet area → GIB Aqualine vs Standard
 *   - Thermal envelope → H1 insulation
 *
 * What's unknown becomes a `ClarificationQuestion` in the clarification
 * module, NOT a guess.
 */

import type { WallContext } from "./types";

/**
 * Words/phrases in a job description that indicate a wall is in scope.
 *
 * The intent is to be permissive on detection (catches "wall", "stud",
 * "framing", "GIB", etc.) and let downstream rules be strict about
 * confirmation. False-positives just trigger clarification questions
 * — they don't auto-add materials.
 */
const WALL_KEYWORDS: readonly RegExp[] = [
  /\bwalls?\b/i,
  /\bstuds?\b/i,
  /\bframings?\b/i,
  /\bplates?\b/i,
  /\bnogs?\b/i,
  /\bdwangs?\b/i,
  /\bgib\b/i,
  /\bplasterboards?\b/i,
  /\blining\b/i,
  /\bcladding\b/i,
  /\bweatherboards?\b/i,
];

/** True iff the description names something that lives in a wall. */
export function descriptionMentionsWall(description: string): boolean {
  if (!description) return false;
  return WALL_KEYWORDS.some((re) => re.test(description));
}

/** Convenience — what fields on `WallContext` are present (not undefined)? */
export type KnownWallFields = {
  hasType: boolean;
  hasLoadbearing: boolean;
  hasBracing: boolean;
  hasWetArea: boolean;
  hasThermalEnvelope: boolean;
  hasCladding: boolean;
  hasLining: boolean;
  hasStudSpacing: boolean;
  hasAcousticOrFire: boolean;
};

/** Pure projection of `WallContext` to "what do we know?" booleans. */
export function knownWallFields(wall: WallContext | undefined): KnownWallFields {
  const w = wall ?? {};
  return {
    hasType: w.type === "internal" || w.type === "external",
    hasLoadbearing: typeof w.isLoadbearing === "boolean",
    hasBracing: typeof w.isBracing === "boolean",
    hasWetArea: typeof w.isWetArea === "boolean",
    hasThermalEnvelope: typeof w.isThermalEnvelope === "boolean",
    hasCladding:
      typeof w.cladding === "string" && w.cladding !== "unknown",
    hasLining: typeof w.lining === "string" && w.lining !== "unknown",
    hasStudSpacing:
      typeof w.studSpacingMm === "number" && w.studSpacingMm > 0,
    hasAcousticOrFire: typeof w.acousticOrFireRequired === "boolean",
  };
}

/**
 * True iff the wall context is a fully classified external thermal-envelope
 * wall — i.e. we know all fields needed to decide on insulation under H1.
 */
export function isFullyClassifiedExternalEnvelope(
  wall: WallContext | undefined,
): boolean {
  const k = knownWallFields(wall);
  return (
    !!wall &&
    wall.type === "external" &&
    wall.isThermalEnvelope === true &&
    k.hasCladding
  );
}

/**
 * True iff the wall context is a fully classified internal wall — a
 * partition with no acoustic/fire/wet-area requirement and no thermal
 * envelope role (since by definition internal walls don't form the
 * thermal envelope of a heated building).
 */
export function isFullyClassifiedInternalDryPartition(
  wall: WallContext | undefined,
): boolean {
  if (!wall) return false;
  if (wall.type !== "internal") return false;
  if (wall.isWetArea === true) return false;
  if (wall.acousticOrFireRequired === true) return false;
  if (wall.isThermalEnvelope === true) return false;
  // We've explicitly disqualified the cases that need extra materials —
  // every other knob is allowed to be unknown.
  return true;
}
