// ─────────────────────────────────────────────────────────────────────────
// sheetToExtraction — CONTRACT SCAFFOLD ONLY (non-runtime, isolated).
//
// The missing bridge between the plan-reader pipeline (an ExtractedSheet of
// labelled/measured dimensions) and the deterministic takeoff calculators
// (which consume an ExtractedExtraction). This file is the TYPED CONTRACT and
// a pure, no-guess reference implementation. It is NOT imported by any route,
// component, calculator, or live planreader flow — wiring is a later task.
//
// HARD RULES (same as the rest of takeoff):
//   - No guessing. Dimension ROLES (which number is length / width / height /
//     area / perimeter) are an INPUT, assigned upstream by the user's own
//     confirmation or a deterministic role-tagger — this bridge NEVER infers a
//     role from a bare value.
//   - No silent defaults. A required role that is absent → BLOCKED with an
//     explicit, human-readable reason. The bridge never substitutes 0 / 2.4 /
//     any assumed number.
//   - No hidden fallbacks. An unsupported scope, a conflicting duplicate role,
//     or an unsatisfiable required-set → BLOCKED, never a best-effort guess.
//   - Pure + deterministic: same input → same output, no IO, no model call.
//
// What it deliberately does NOT do (flagged for product confirmation below):
//   - It does not assign roles (no length/width inference from raw text).
//   - It does not DERIVE perimeter from length×width, or decide whether
//     "length" means one wall run vs total wall run vs building perimeter.
//     Those are semantic decisions, not mechanical mapping.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ExtractedExtraction,
  ExtractedOpening,
  ScopeType,
} from "../schemas";

/**
 * The roles a number can carry. `length` ALWAYS means total wall run (see
 * docs/takeoff-architecture/FLOORPLAN_ROLE_CONTRACT.md §2). `building_length` /
 * `building_width` are overall building dims — recognized but NOT consumed by
 * any calculator (no silent reinterpretation as wall run or perimeter).
 * Roles are assigned upstream (user confirmation / text tagger), never guessed.
 */
export type DimensionRole =
  | "length" // = total wall run
  | "width"
  | "height"
  | "area"
  | "perimeter" // = exterior wall run, its own explicit value
  | "building_length"
  | "building_width";

/**
 * Per-role provenance (decision #4): how the value's role was established.
 *   user-typed               — tradie entered it directly.
 *   labelled-sheet-confirmed — read off a printed label AND confirmed
 *                              (user, or the deterministic text tagger).
 *   geometry-measured        — measured from calibrated geometry (future).
 */
export type RoleSource =
  | "user-typed"
  | "labelled-sheet-confirmed"
  | "geometry-measured";

export interface RoledDimension {
  role: DimensionRole;
  /** Canonical metric value (metres, or m² for area). */
  value_m: number;
  source: RoleSource;
}

export interface BridgeOpening {
  kind: "door" | "window" | "other";
  width_m: number | null;
  height_m: number | null;
  count: number | null;
}

/**
 * The structural slice this bridge reads. Defined here (not imported from
 * planreader) so the contract stays decoupled. Producing a BridgeSheetInput
 * from a raw planreader ExtractedSheet — i.e. ASSIGNING roles — is the separate
 * non-guessing step (user confirmation / deterministic tagger) this scaffold
 * intentionally leaves unimplemented.
 */
export interface BridgeSheetInput {
  scope: ScopeType;
  /** Role-assigned dimensions. Empty when the plan wasn't dimensioned/confirmed. */
  roledDimensions: RoledDimension[];
  /** Labelled/measured openings to deduct, passed through verbatim. */
  openings: BridgeOpening[];
  /** Optional pass-throughs — carried only if present, never defaulted. */
  stock_length_m?: number | null;
  material_spec?: string | null;
  notes?: string[];
}

export interface BlockedReason {
  /** Stable machine code, e.g. "missing_required_dimension". */
  code: string;
  /** The field/role at fault. */
  field: string;
  /** Human-facing clarification text for Review Quote. */
  message: string;
}

export type BridgeResult =
  | { ok: true; extraction: ExtractedExtraction }
  | { ok: false; blocked: { scope: ScopeType; reasons: BlockedReason[] } };

/**
 * Per-scope REQUIRED role-sets — the single source of truth for what a scope
 * needs before a calculator may run. Each scope lists ALTERNATIVE sets; the
 * scope is satisfiable if ANY one set is fully present. (Mirrors validate.ts.)
 *
 * Only the three scopes this task targets are declared. Any other scope is
 * treated as unsupported → BLOCKED (never silently passed through).
 */
const REQUIRED_ROLE_SETS: Partial<Record<ScopeType, DimensionRole[][]>> = {
  framing: [["length", "height"]],
  lining: [["area"], ["length", "height"]],
  insulation: [["area"], ["length", "height"]],
};

export const SUPPORTED_BRIDGE_SCOPES = Object.keys(
  REQUIRED_ROLE_SETS,
) as ScopeType[];

function mapOpening(o: BridgeOpening): ExtractedOpening {
  return {
    kind: o.kind,
    width_m: o.width_m,
    height_m: o.height_m,
    count: o.count,
  };
}

/**
 * Map a role-assigned sheet slice into an ExtractedExtraction, or BLOCK with
 * explicit reasons. Pure, no-guess, no defaults.
 */
export function sheetToExtraction(input: BridgeSheetInput): BridgeResult {
  const { scope } = input;
  const requiredSets = REQUIRED_ROLE_SETS[scope];

  // 1. Unsupported scope → blocked (never a silent pass-through).
  if (!requiredSets) {
    return {
      ok: false,
      blocked: {
        scope,
        reasons: [
          {
            code: "unsupported_scope",
            field: "scope",
            message: `This bridge supports ${SUPPORTED_BRIDGE_SCOPES.join(
              ", ",
            )}. "${scope}" has no deterministic floor-plan mapping yet.`,
          },
        ],
      },
    };
  }

  // 2. Collect roles → values. A duplicate role with a DIFFERENT value is a
  //    cross-check conflict — block, never silently pick one.
  const byRole = new Map<DimensionRole, number>();
  for (const d of input.roledDimensions) {
    if (!Number.isFinite(d.value_m) || d.value_m <= 0) continue; // ignore junk; never coerce
    const existing = byRole.get(d.role);
    if (existing !== undefined && existing !== d.value_m) {
      return {
        ok: false,
        blocked: {
          scope,
          reasons: [
            {
              code: "conflicting_dimension",
              field: d.role,
              message: `Two different "${d.role}" values (${existing} and ${d.value_m}) — confirm which is correct before quoting.`,
            },
          ],
        },
      };
    }
    byRole.set(d.role, d.value_m);
  }

  // 3. Is ANY required role-set fully satisfied?
  const satisfied = requiredSets.some((set) => set.every((r) => byRole.has(r)));
  if (!satisfied) {
    // Report the missing roles from the SMALLEST set (the easiest to satisfy).
    const smallest = [...requiredSets].sort((a, b) => a.length - b.length)[0];
    const missing = smallest.filter((r) => !byRole.has(r));
    const reasons: BlockedReason[] = missing.map((r) => ({
      code: "missing_required_dimension",
      field: r,
      message: `${scope} needs ${describeSet(
        requiredSets,
      )}. Missing: ${r}. Enter it (or confirm it on the plan) — it won't be assumed.`,
    }));
    return { ok: false, blocked: { scope, reasons } };
  }

  // 4. Build the extraction from PRESENT roles only. Absent optional roles stay
  //    null (never defaulted). Openings pass through verbatim.
  const allGeometry =
    input.roledDimensions.length > 0 &&
    input.roledDimensions.every((d) => d.source === "geometry-measured");

  const extraction: ExtractedExtraction = {
    confidence: allGeometry ? 0.9 : 0.75,
    project_type: null,
    scope_type: scope,
    sub_scopes: [],
    dimensions: {
      length_m: byRole.get("length") ?? null,
      width_m: byRole.get("width") ?? null,
      height_m: byRole.get("height") ?? null,
      area_m2: byRole.get("area") ?? null,
      perimeter_m: byRole.get("perimeter") ?? null,
    },
    openings: input.openings.map(mapOpening),
    notes: input.notes ?? [],
    needs_clarification: [],
    clarification_questions: [],
    source_basis: "manual",
    ...(input.stock_length_m != null
      ? { stock_length_m: input.stock_length_m }
      : {}),
    ...(input.material_spec != null
      ? { material_spec: input.material_spec }
      : {}),
  };

  return { ok: true, extraction };
}

/** Human description of a scope's required alternatives, e.g. "area, OR length + height". */
function describeSet(sets: DimensionRole[][]): string {
  return sets.map((s) => s.join(" + ")).join(", OR ");
}
