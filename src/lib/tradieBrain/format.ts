// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — render ranked memories into a compact, READ-ONLY context
// block (pure, NO I/O).
//
// This is the ONLY shape a downstream AI surface would ever consume. It is
// deliberately advisory framing: "context the tradie has shown before",
// never instructions. In v1 NOTHING calls this into a prompt — the owner
// debug view uses it to preview exactly what a future consumer would see, so
// the surface area is provable before it's ever wired to a model.
// ─────────────────────────────────────────────────────────────────────────

import type { RankedMemory } from "./types";

function describe(m: RankedMemory): string | null {
  const v = m.value ?? {};
  switch (m.memory_type) {
    case "preferred_material":
    case "preferred_brand": {
      const name = String(v.name ?? m.memory_key);
      const price = typeof v.unit_price === "number" ? v.unit_price : null;
      const unit = typeof v.unit === "string" ? v.unit : "each";
      return price != null
        ? `Usually prices "${name}" around $${price}/${unit}`
        : `Often uses "${name}"`;
    }
    case "preferred_supplier":
      return `Prefers supplier ${String(v.supplier ?? m.memory_key)}`;
    case "common_exclusion":
      return `Commonly excludes: ${String(v.text ?? m.memory_key)}`;
    case "pricing_habit":
      return typeof v.markup_pct === "number"
        ? `Typical markup ~${v.markup_pct}%`
        : null;
    case "job_type_preference":
      return `Often quotes ${String(v.job_type ?? m.memory_key)} jobs`;
    case "repeated_correction": {
      const field = String(v.field ?? "a field");
      const to = v.to;
      return `Repeatedly corrects ${field} on "${String(v.description ?? m.memory_key)}"${
        to != null ? ` → ${String(to)}` : ""
      }`;
    }
    case "tone_preference":
      return `Wording preference: ${String(v.text ?? m.memory_key)}`;
    case "quote_outcome":
      return null; // not surfaced as guidance in v1
    default:
      return null;
  }
}

/**
 * Build the advisory context block. Each line is tagged with the derived
 * confidence so a reader (human or model) can weight it. Returns "" when
 * there's nothing worth surfacing.
 */
export function formatMemoriesForPrompt(memories: RankedMemory[]): string {
  const lines = memories
    .map((m) => {
      const text = describe(m);
      return text ? `- (${m.confidence}) ${text}` : null;
    })
    .filter((l): l is string => l !== null);

  if (lines.length === 0) return "";
  return [
    "Context from this tradie's own past quotes (advisory only — never override their numbers or the calculator):",
    ...lines,
  ].join("\n");
}
