// ── Best-effort job-type inference ─────────────────────────────────────────
// Quotes have no job_type column — the trade only exists as free text in
// quote_data.job_summary. This maps that text to one of the 10 rule ids so a
// scheduled quote can be assessed out of the box. It is a CONVENIENCE only: the
// tradie can always override it in the Workboard. When nothing matches we return
// null and the orchestrator SKIPS (it never guesses a risk for an unknown trade).

import { JOB_TYPE_IDS } from "./rules";

// Keyword → job_type. First match wins (ordered most-specific first).
const KEYWORDS: Array<[RegExp, string]> = [
  [/\broof|reroof|gutter|spouting|flashing\b/i, "roofing"],
  [/\bsolar|pv panel|photovoltaic\b/i, "solar_install"],
  [/\bexterior paint|repaint exterior|house paint|weatherboard paint\b/i, "exterior_painting"],
  [/\bpaint\b/i, "exterior_painting"],
  [/\bdeck|pergola|handrail|exterior carpentry\b/i, "decking"],
  [/\bfence|fencing|gate post|retaining\b/i, "fencing"],
  [/\bconcrete|slab|pour|driveway|footing|foundation\b/i, "concrete"],
  [/\bexcavat|dig|earthworks|trench|digger|bulk earth\b/i, "excavation"],
  [/\blandscap|garden|planting|paving|turf|lawn\b/i, "landscaping"],
  [/\boutdoor electric|external wiring|outdoor power|ev charger\b/i, "electrical_outdoor"],
  [/\bplumb|drain|pipe|hot water|leak\b/i, "plumbing_service"],
];

/**
 * Infer a job_type id from free-text (job summary / title). Returns null when
 * nothing confidently matches — callers must treat null as "ask the tradie",
 * not as a default.
 */
export function guessJobType(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [re, jobType] of KEYWORDS) {
    if (re.test(text)) return jobType;
  }
  return null;
}

export function isKnownJobType(jobType: string | null | undefined): boolean {
  return !!jobType && JOB_TYPE_IDS.includes(jobType);
}
