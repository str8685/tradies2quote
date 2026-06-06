// ─────────────────────────────────────────────────────────────────────────
// Foundation review-UI rendering contract (isolated, non-runtime).
//
// Pure transform: the locked clarification contract (FoundationClarification[])
// → a deterministic field model a mobile review screen can render directly,
// with NO ambiguity and NO inference. This module is UNUSED by runtime code —
// no React, no routes, no flags, no CALCULATORS. It exists so the eventual UI
// slice is a thin renderer over a tested contract.
//
// It re-uses the adapter's runtime invariant guard, so any contract drift in a
// clarification fails loudly here too.
//
// CONTRACT DISCIPLINE: the input_kind → control mapping is a CLOSED mapping.
// Adding a control (or a new dimensions_pair field) must update this module,
// its tests, and docs/plan-reader/REVIEW_UI_CONTRACT.md in the SAME change.
// ─────────────────────────────────────────────────────────────────────────

import {
  assertValidFoundationClarification,
  type ClarificationSource,
  type FoundationClarification,
} from "./foundationAdapter";

/** UI control kinds — 1:1 with the clarification input_kind closed set. */
export type ReviewControl = "number" | "dimensions_pair" | "select";

/** One half of a dimensions_pair (e.g. length / width). */
export type ReviewFieldPart = {
  /** Key the UI writes this sub-answer under in `confirmed`. */
  confirmed_key: string;
  /** Short label for the sub-input. */
  label: string;
  /** Unit adornment, or null. */
  unit: string | null;
};

/**
 * A single render-ready field. Note: there is intentionally NO `value` /
 * `default` property — the model never seeds an answer (no invented defaults).
 */
export type ReviewField = {
  /** Stable clarification field key. */
  key: string;
  /** Question text, used as the field label. */
  label: string;
  /** One-line helper, or null. */
  hint: string | null;
  /** Which control to render. */
  control: ReviewControl;
  /** Unit adornment for single-value controls, or null. */
  unit: string | null;
  /** Explicit required flag (mirrors the contract). */
  required: boolean;
  /** Explicit complement of `required` — never inferred by the UI. */
  optional: boolean;
  /** Quick-pick chips, passed through verbatim from the contract. */
  suggestions: string[];
  /** Stable sort key (the clarification display_order). */
  order: number;
  /** Why this was raised — drives copy/iconography. */
  source: ClarificationSource;
  /** The exact key(s) the UI must send back in `confirmed` for this field. */
  confirmed_keys: string[];
  /** dimensions_pair only: the two sub-inputs. */
  parts?: ReviewFieldPart[];
  /** select only: enumerated options (reserved; empty until a select exists). */
  options?: string[];
};

export type FoundationReviewModel = {
  /** "blocked" when there are clarifications to answer; "ready" otherwise. */
  status: "blocked" | "ready";
  /** Short screen title. */
  title: string;
  /** Render-ready fields, pre-sorted by `order`. */
  fields: ReviewField[];
  /** Flattened confirmed-keys that must be answered before "Calculate" enables. */
  required_keys: string[];
};

// ── dimensions_pair field mappings (closed) ───────────────────────────────
//
// Each dimensions_pair clarification field maps to a fixed pair of confirmed
// keys. Only `slab_size` exists today. An unknown dimensions_pair field is
// treated as contract drift and throws — never guessed.

const DIMENSION_PAIRS: Record<string, ReviewFieldPart[]> = {
  slab_size: [
    { confirmed_key: "slab_length_m", label: "Length", unit: "m" },
    { confirmed_key: "slab_width_m", label: "Width", unit: "m" },
  ],
};

function toReviewField(c: FoundationClarification): ReviewField {
  // Fail loudly if the clarification itself is off-contract.
  assertValidFoundationClarification(c);

  const base = {
    key: c.field,
    label: c.question,
    hint: c.hint ?? null,
    unit: c.unit ?? null,
    required: c.required,
    optional: !c.required,
    suggestions: c.suggestions ?? [],
    order: c.display_order,
    source: c.source,
  };

  switch (c.input_kind) {
    case "dimensions_pair": {
      const parts = DIMENSION_PAIRS[c.field];
      if (!parts) {
        throw new Error(
          `Foundation review model: no dimensions_pair mapping for field "${c.field}" — contract drift.`,
        );
      }
      return {
        ...base,
        control: "dimensions_pair",
        parts,
        confirmed_keys: parts.map((p) => p.confirmed_key),
      };
    }
    case "select": {
      // Reserved: no clarification emits "select" yet. Options come from the
      // contract's `suggestions` if/when a select is introduced; empty today.
      return {
        ...base,
        control: "select",
        options: [...base.suggestions],
        confirmed_keys: [c.field],
      };
    }
    case "number":
    default:
      return { ...base, control: "number", confirmed_keys: [c.field] };
  }
}

/**
 * Build a deterministic mobile field model from a clarification list.
 * Pure: same input → same output. Throws on contract drift (via the invariant).
 */
export function buildFoundationReviewModel(
  clarifications: FoundationClarification[],
): FoundationReviewModel {
  const sorted = [...clarifications].sort((a, b) => a.display_order - b.display_order);
  const fields = sorted.map(toReviewField);
  const required_keys = fields
    .filter((f) => f.required)
    .flatMap((f) => f.confirmed_keys);

  const blocked = fields.length > 0;
  return {
    status: blocked ? "blocked" : "ready",
    title: blocked
      ? "Enter the missing foundation measurements"
      : "Foundation measurements complete",
    fields,
    required_keys,
  };
}
