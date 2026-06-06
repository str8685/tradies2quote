// ─────────────────────────────────────────────────────────────────────────
// Phase 4 foundation ADAPTER (isolated — NOT registered in CALCULATORS yet).
//
// Bridges the generic extraction shape (ExtractedExtraction) + any user-
// confirmed answers into the deterministic foundation calculator, and maps the
// result into the existing takeoff line shape (TakeoffLine / ScopeResult), so
// it can drop into the orchestrator in a later, explicitly-flagged step.
//
// It owns the orchestrator-friendly behaviour the raw calculator deliberately
// does NOT: instead of throwing FoundationInputError through a route, it
// catches it and returns a `blocked` result carrying one BLOCKING, tradie-
// friendly clarification question per missing required field.
//
// Isolation note: "foundation" is intentionally NOT added to ScopeType / the
// CALCULATORS map yet (that's the production-wiring step, to be done behind a
// flag once this is proven). So this module defines `"foundation"`-scoped
// variants of ScopeResult/ClarificationQuestion locally. When wired up, those
// collapse to the shared types unchanged.
// ─────────────────────────────────────────────────────────────────────────

import type {
  ClarificationQuestion,
  ExtractedExtraction,
  ScopeResult,
  TakeoffLine,
  TakeoffStatus,
} from "./schemas";
import { worstStatus } from "./schemas";
import {
  FoundationInputError,
  calculateFoundationTakeoff,
  type FoundationInput,
  type FoundationLine,
  type FoundationTakeoff,
} from "./foundationCalculator";

/** Local scope tag until "foundation" is promoted into ScopeType. */
export type FoundationScope = "foundation";

/** How the review UI should render the answer control. */
export type ClarificationInputKind =
  | "number"
  | "dimensions_pair"
  | "select"
  | "text";

/** Why this clarification was raised. */
export type ClarificationSource =
  | "missing_required_input"
  | "invalid_value"
  | "conflict";

/**
 * Machine-usable clarification shape. Extends the shared ClarificationQuestion
 * with explicit rendering + semantics metadata so a future review UI can drive
 * itself programmatically (no string-sniffing):
 *
 *   input_kind     — which control to render (number / dimensions_pair / …)
 *   required       — is this a REQUIRED input (vs an optional one)?
 *   source         — missing_required_input | invalid_value | conflict
 *   display_order  — stable sort key for consistent UI ordering
 */
export type FoundationClarification = Omit<ClarificationQuestion, "scope"> & {
  scope: FoundationScope;
  input_kind: ClarificationInputKind;
  required: boolean;
  source: ClarificationSource;
  display_order: number;
};

export type FoundationScopeResult = Omit<ScopeResult, "scope" | "clarifications"> & {
  scope: FoundationScope;
  clarifications: FoundationClarification[];
};

/**
 * User-confirmed inputs (e.g. answers to clarification questions from the
 * review UI). These are EXPLICIT values — never silent defaults — and take
 * precedence over anything derived from extraction.
 */
export type FoundationConfirmedInputs = Partial<FoundationInput>;

// ── Missing-field → tradie-friendly clarification ─────────────────────────

type QuestionSpec = {
  field: string;
  question: string;
  hint?: string;
  unit?: string;
  suggestions?: string[];
  input_kind: ClarificationInputKind;
  /** Is the underlying input a REQUIRED measurement (vs optional)? */
  required: boolean;
  /** Stable UI sort key. */
  display_order: number;
};

// Static, deterministic metadata per known field. display_order gives the UI
// a stable top-to-bottom ordering regardless of how the calculator happens to
// list the missing fields.
const FIELD_META: Record<string, QuestionSpec> = {
  slab_size: {
    field: "slab_size",
    question: "What are the slab length and width in metres?",
    hint: "Or give the total slab area in m² if it's not a simple rectangle.",
    unit: "m",
    input_kind: "dimensions_pair",
    required: true,
    display_order: 1,
  },
  slab_perimeter_m: {
    field: "slab_perimeter_m",
    question: "What is the slab perimeter in metres?",
    hint: "Add up all the outside edges of the slab.",
    unit: "m",
    input_kind: "number",
    required: true,
    display_order: 2,
  },
  slab_thickness_mm: {
    field: "slab_thickness_mm",
    question: "What is the slab thickness in mm?",
    hint: "Most residential slabs are 100–150 mm.",
    unit: "mm",
    suggestions: ["100", "125", "150"],
    input_kind: "number",
    required: true,
    display_order: 3,
  },
  footing_width_mm: {
    field: "footing_width_mm",
    question: "How wide are the footings in mm?",
    hint: "Measured across the bottom of the footing trench.",
    unit: "mm",
    suggestions: ["300", "400", "450"],
    input_kind: "number",
    required: true,
    display_order: 4,
  },
  footing_depth_mm: {
    field: "footing_depth_mm",
    question: "How deep are the footings in mm?",
    hint: "From the underside of the slab to the bottom of the footing.",
    unit: "mm",
    suggestions: ["400", "450", "600"],
    input_kind: "number",
    required: true,
    display_order: 5,
  },
  internal_footing_run_m: {
    field: "internal_footing_run_m",
    question: "How many metres of internal (load-bearing) footings are there?",
    hint: "Enter 0 if the footings are only around the perimeter.",
    unit: "m",
    input_kind: "number",
    required: false, // optional — defaults to 0 (no internal footings)
    display_order: 6,
  },
};

const FALLBACK_META = (field: string): QuestionSpec => ({
  field,
  question: `Please check: ${field}.`,
  input_kind: "text",
  required: false,
  display_order: 99,
});

/** Match a calculator `missing` string to its field metadata. */
function specForMissing(missing: string): QuestionSpec {
  if (missing.includes("slab_length_m") || missing.includes("slab_area_m2")) {
    return FIELD_META.slab_size;
  }
  if (missing.includes("slab_perimeter_m")) return FIELD_META.slab_perimeter_m;
  if (missing.includes("slab_thickness_mm")) return FIELD_META.slab_thickness_mm;
  if (missing.includes("footing_width_mm")) return FIELD_META.footing_width_mm;
  if (missing.includes("footing_depth_mm")) return FIELD_META.footing_depth_mm;
  if (missing.includes("internal_footing_run_m")) return FIELD_META.internal_footing_run_m;
  // Config-consistency problems (e.g. mesh lap >= sheet) — surfaced plainly,
  // never silently swallowed.
  return FALLBACK_META(missing);
}

/** Classify why the field was raised, from the calculator's message text. */
function sourceFor(missing: string): ClarificationSource {
  // Invalid-value messages from the calculator contain "must be" / "smaller than".
  if (/must be|smaller than|>=/i.test(missing)) return "invalid_value";
  return "missing_required_input";
}

function clarificationFor(missing: string): FoundationClarification {
  const spec = specForMissing(missing);
  return {
    id: `foundation_clar_${spec.field}`,
    scope: "foundation",
    field: spec.field,
    question: spec.question,
    hint: spec.hint,
    blocking: true,
    suggestions: spec.suggestions,
    unit: spec.unit,
    input_kind: spec.input_kind,
    required: spec.required,
    source: sourceFor(missing),
    display_order: spec.display_order,
  };
}

// ── Extraction → calculator input ─────────────────────────────────────────

/**
 * Build the calculator input from extracted dims + confirmed answers. Only the
 * fields the generic extraction can actually carry are mapped (slab footprint
 * + perimeter). Section measurements (thickness, footing width/depth) are NOT
 * invented from extraction — they must arrive via `confirmed`, otherwise the
 * calculator hard-fails and the adapter asks for them. No fake assumptions.
 */
export function buildFoundationInput(
  ext: ExtractedExtraction,
  confirmed?: FoundationConfirmedInputs,
): FoundationInput {
  const fromExt: FoundationInput = {
    slab_length_m: ext.dimensions.length_m ?? null,
    slab_width_m: ext.dimensions.width_m ?? null,
    slab_area_m2: ext.dimensions.area_m2 ?? null,
    slab_perimeter_m: ext.dimensions.perimeter_m ?? null,
    // Intentionally NOT mapped from extraction (would be a fake assumption):
    // slab_thickness_mm, footing_width_mm, footing_depth_mm.
  };
  // Confirmed answers win, and only overwrite when actually provided.
  const merged: FoundationInput = { ...fromExt };
  if (confirmed) {
    for (const [k, v] of Object.entries(confirmed)) {
      if (v !== undefined && v !== null) {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
  }
  return merged;
}

// ── Line mapping (preserve formula / inputs / assumptions) ────────────────

const CATEGORY_FOR: Record<FoundationLine["key"], string> = {
  slab_area: "Measurement",
  footing_run: "Measurement",
  slab_concrete: "Concrete",
  footing_concrete: "Concrete",
  total_concrete: "Concrete",
  mesh: "Reinforcing",
};

/** Which run-level assumptions apply to a given line + the config keys behind them. */
function assumptionsForLine(
  key: FoundationLine["key"],
  takeoff: FoundationTakeoff,
): { flags: string[]; assumed: string[] } {
  const a = takeoff.assumptions;
  const flags: string[] = [];
  const assumed: string[] = [];
  const waste = a.find((s) => /waste defaulted/i.test(s));
  const internal = a.find((s) => /internal\/load-bearing footings/i.test(s));
  const mesh = a.find((s) => /Mesh sheet assumed/i.test(s));

  if (["slab_concrete", "footing_concrete", "total_concrete"].includes(key) && waste) {
    flags.push(waste);
    assumed.push("concrete_waste_pct");
  }
  if (["footing_run", "footing_concrete", "total_concrete"].includes(key) && internal) {
    flags.push(internal);
    assumed.push("internal_footing_run_m");
  }
  if (key === "mesh" && mesh) {
    flags.push(mesh);
    assumed.push("mesh_sheet");
  }
  return { flags, assumed };
}

function toTakeoffLine(line: FoundationLine, takeoff: FoundationTakeoff): TakeoffLine {
  const { flags, assumed } = assumptionsForLine(line.key, takeoff);
  const status: TakeoffStatus = flags.length > 0 ? "assumed" : "ok";
  return {
    id: `foundation:${line.key}`,
    name: line.name,
    category: CATEGORY_FOR[line.key],
    quantity: line.quantity,
    unit: line.unit,
    status,
    basis: {
      formula: line.formula,
      // Inputs are number-typed already; widen to the LineBasis value type.
      inputs: line.inputs as Record<string, number>,
      assumed,
    },
    confidence: line.confidence,
    assumption_flags: flags,
    validation_flags: [],
    explanation: `${line.name}: ${line.formula} = ${line.quantity} ${line.unit}.`,
    priceMatchKey: line.key,
  };
}

// ── The adapter ───────────────────────────────────────────────────────────

/**
 * Run the deterministic foundation calculator against extracted + confirmed
 * inputs and return an orchestrator-friendly result.
 *
 *   - All required inputs present → status reflects per-line `ok`/`assumed`,
 *     with every line carrying its formula, inputs, and assumptions.
 *   - Any required input missing → status `"blocked"`, no lines, and one
 *     BLOCKING clarification question per missing field. Never throws.
 */
export function runFoundationCalculator(
  ext: ExtractedExtraction,
  confirmed?: FoundationConfirmedInputs,
): FoundationScopeResult {
  const input = buildFoundationInput(ext, confirmed);

  let takeoff: FoundationTakeoff;
  try {
    takeoff = calculateFoundationTakeoff(input);
  } catch (err) {
    if (err instanceof FoundationInputError) {
      const clarifications = err.missing
        .map((m) => clarificationFor(m))
        .sort((a, b) => a.display_order - b.display_order);
      return {
        scope: "foundation",
        status: "blocked",
        summary: {
          primary_metric: "total_concrete",
          primary_value: 0,
          unit: "m³",
          inputs: {},
        },
        lines: [],
        warnings: [
          "Foundation takeoff is blocked: required measurements are missing. Answer the questions below to calculate.",
        ],
        assumptions: [],
        clarifications,
        explanation:
          "Cannot calculate a foundation takeoff yet — the slab/footing measurements below are required and were not provided. Nothing is assumed.",
      };
    }
    throw err; // unexpected — let it surface
  }

  const lines = takeoff.lines.map((l) => toTakeoffLine(l, takeoff));
  const status = worstStatus(lines.map((l) => l.status));

  const total = takeoff.lines.find((l) => l.key === "total_concrete");
  const area = takeoff.lines.find((l) => l.key === "slab_area");
  const run = takeoff.lines.find((l) => l.key === "footing_run");

  return {
    scope: "foundation",
    status,
    summary: {
      primary_metric: "total_concrete",
      primary_value: total?.quantity ?? 0,
      unit: "m³",
      inputs: {
        slab_area_m2: area?.quantity ?? 0,
        footing_run_m: run?.quantity ?? 0,
        concrete_waste_pct: takeoff.config.concrete_waste_pct,
      },
    },
    lines,
    warnings: [],
    assumptions: takeoff.assumptions,
    clarifications: [],
    explanation:
      `Foundation takeoff: ${total?.quantity ?? 0} m³ concrete total ` +
      `over a ${area?.quantity ?? 0} m² slab with ${run?.quantity ?? 0} m of footings.`,
  };
}
