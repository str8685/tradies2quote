// ─────────────────────────────────────────────────────────────────────────
// CSI / MasterFormat trade-mapping — Stage 1 implementation.
//
// Pure, deterministic, non-mutating. Groups existing calculated takeoff /
// review line items into MasterFormat-aligned divisions + tradie trade
// buckets. See contracts.ts for the hard rules. This module:
//   - NEVER calculates a quantity or sets a price (both carried through).
//   - NEVER mutates the input.
//   - Classifies by the line's DESCRIPTION (review lines carry no scope).
//   - Emits "uncategorized" explicitly when no rule confidently matches —
//     no silent fallback, no guess.
//   - Preserves takeoff_status (blocked/needs_review/assumed/ok) and a
//     provenance derived ONLY from existing fields.
// ─────────────────────────────────────────────────────────────────────────

import type {
  CsiDivision,
  CsiGroupedQuote,
  CsiLineItem,
  CsiProvenance,
  CsiSourceLine,
  TradeBucket,
} from "./contracts";

// Canonical render/group order. Only divisions WITH lines appear in output.
const DIVISION_ORDER: Array<Exclude<CsiDivision, "uncategorized">> = [
  "03_concrete",
  "05_metals",
  "06_wood_plastics",
  "07_thermal_moisture",
  "09_finishes",
];

type Rule = {
  division: Exclude<CsiDivision, "uncategorized">;
  trade: TradeBucket;
  /** Stable label recorded in mapping_basis for audit. */
  label: string;
  re: RegExp;
};

// Ordered rules — FIRST match wins. Order matters: more specific / context-
// bearing material families are tested before broader carpentry words so a
// "GIB screw" lands in finishes (09), not generic fixings, and a "concrete
// pile" lands in concrete (03) even though it is part of a deck structure
// (that is correct CSI: a concrete pile is Division 03 regardless of trade).
//
// Policy decisions encoded here (see SYSTEM_ARCHITECTURE.md ambiguity list):
//   - Bare fasteners (screws/nails/bolts) with NO material context stay
//     uncategorized — never guessed. Only context-bearing fasteners map
//     (joist-hanger nails, decking/framing/timber screws).
//   - Finish carpentry: skirting/architrave/scotia → 06; timber-qualified
//     cornice/fascia/soffit → 06; plaster cornice/coving → 09; bare
//     fascia/soffit/cornice-without-material → handled below or left
//     uncategorized when the material is unclear.
//   - Lintels: "steel lintel" → 05; "timber"/"LVL" lintel → 06; bare
//     "lintel" → uncategorized (no rule names it).
//   - Flashing → 07 by DEFAULT, even "metal"/"steel" flashing (the 07 trim
//     rule is ordered BEFORE the 05 steel rule so it wins).
const RULES: Rule[] = [
  // ── 09 — interior lining / gypsum-board finishes ─────────────────────────
  // Checked first: "GIB screws"/"plasterboard fixings" contain generic words.
  {
    division: "09_finishes",
    trade: "lining",
    label: "name:lining/gib",
    re: /\b(gib|plaster\s?board|wall\s?board|aqualine|fyreline|braceline|standard\s+board|ceiling\s+lining|wall\s+lining|stopping|jointing\s+compound|joint\s+tape|scrim|gib\s+screws?|board\s+screws?)\b/i,
  },

  // ── 06 — finish carpentry (timber trim) ──────────────────────────────────
  // Skirting / architrave / scotia are timber/MDF finish carpentry → 06.
  // Cornice is classified by its installed FINISH ROLE, not raw material, so
  // only a TIMBER-qualified cornice lands here ("timber cornice" → 06); every
  // other cornice (incl. "PVC cornice") is treated as a plaster/coving finish
  // by the rule below → 09. Timber-qualified fascia/soffit also land here.
  {
    division: "06_wood_plastics",
    trade: "other",
    label: "name:finish-carpentry-timber",
    re: /\b(skirtings?|architraves?|scotia|(?:timber|wooden|pine|mdf|h[1-5])\s+(?:cornice|fascia|soffit)|fascia\s+boards?|barge\s?boards?)\b/i,
  },

  // ── 09 — plaster cornice / coving (finish-role, any material) ────────────
  // Cornice/coving = installed finish role → 09 regardless of material, so a
  // "PVC cornice" lands here, NOT in 06. Timber-qualified cornice was already
  // caught above. A bare "cornice" with no other clue is still a finish → 09.
  {
    division: "09_finishes",
    trade: "lining",
    label: "name:plaster-cornice",
    re: /\b(cornice|cornicing|coving|coved|cove)\b/i,
  },

  // ── 07 — thermal & moisture envelope (insulation + wraps + cladding) ─────
  {
    division: "07_thermal_moisture",
    trade: "insulation",
    label: "name:insulation/moisture",
    re: /\b(insulation|pink\s?batts?|batts?|r[-\s]?\d(?:\.\d)?\b|wall\s+wrap|building\s+wrap|building\s+paper|building\s+underlay|dpc|damp[-\s]?proof|vapou?r\s+barrier|moisture\s+barrier|sisalation)\b/i,
  },
  {
    division: "07_thermal_moisture",
    trade: "cladding",
    label: "name:cladding",
    re: /\b(cladding|weather\s?board|weatherboards?|siding|fibre[-\s]?cement|fiber[-\s]?cement|cavity\s+battens?|board\s?and\s?batten)\b/i,
  },
  // Envelope trim: flashing → 07 by default (incl. metal/steel flashing — this
  // rule is BEFORE the 05 steel rule so it wins). Qualified soffit/fascia in a
  // cladding material context → 07. Bare "soffit"/"fascia" match nothing here
  // and fall through to uncategorized.
  {
    division: "07_thermal_moisture",
    trade: "cladding",
    label: "name:envelope-trim",
    re: /\b(flashings?|(?:fibre[-\s]?cement|fiber[-\s]?cement|hardi\w*|pvc|metal|colou?rsteel|alum\w*)\s+(?:fascia|soffit)|soffit\s+lining)\b/i,
  },

  // ── 03 — concrete & foundations (incl. REINFORCING — CSI puts reinforcing
  // in the concrete package, NOT structural metals). This rule is ordered
  // BEFORE the 05 steel rule, and the 05 rule names no reinforcing terms, so
  // rebar / reo / reinforcing bar / reinforcing+welded mesh can never be
  // captured by 05. Note: bare "mesh" is intentionally NOT matched (could be
  // insect/plaster/screen mesh) — only reinforcement-context mesh maps here.
  {
    division: "03_concrete",
    trade: "concrete",
    label: "name:concrete/reinforcing",
    re: /\b(concrete|ready[-\s]?mix|readymix|piles?|footings?|foundation|slab|rebar|reinforc(?:ing|ement)|reinforcing\s+bars?|\breo\b|reo\s+bars?|(?:reinforc\w+|reinforcement|welded|crack[-\s]?control)\s+mesh|se\d{2}\b|hardfill|builders?\s+mix|post[-\s]?crete|postcrete|rapid\s?set|dpm)\b/i,
  },

  // ── 05 — structural metals ───────────────────────────────────────────────
  {
    division: "05_metals",
    trade: "framing",
    label: "name:structural-steel",
    re: /\b(steel\s+(?:beam|post|lintel|column|frame|framing)|\brhs\b|\bshs\b|\bub\b|\bpfc\b|\buc\b|\buniversal\s+beam|universal\s+column|galv(?:anised)?\s+steel|steel\s+angle)\b/i,
  },

  // ── 06 — timber framing, carpentry, deck structure + carpentry fixings ───
  {
    division: "06_wood_plastics",
    trade: "framing",
    label: "name:timber-framing",
    re: /\b(stud|studs|top\s+plate|bottom\s+plate|plate|nog(?:gin)?s?|dwang|timber|h[1-5]\b|sg\d\b|mgp\d\b|framing|rafter|purlin|ribbon\s?plate|blocking|brace|lvl)\b/i,
  },
  // Carpentry fixings — CONTEXT-BEARING ONLY. A fastener must name what it
  // fastens (joist hanger, decking/framing/timber screw or nail) to map.
  // Generic "screws"/"nails"/"bolts"/"brackets" do NOT match → uncategorized.
  {
    division: "06_wood_plastics",
    trade: "fixings",
    label: "name:carpentry-fixings",
    re: /\b(joist\s+hangers?|joist\s+hanger\s+nails?|nail\s?plates?|(?:decking|framing|timber)\s+(?:screws?|nails?))\b/i,
  },
  {
    division: "06_wood_plastics",
    trade: "decking",
    label: "name:deck-structure",
    re: /\b(deck|decking|deck\s+board|joist|joists|bearer|bearers|pergola|hand\s?rail|baluster|balustrade)\b/i,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Real-quote eval additions (placed LATE so they only catch strings that no
  // earlier material rule already mapped — additive, never a re-route).
  // ─────────────────────────────────────────────────────────────────────────

  // 06 — structural wood sheet: plywood / bracing ply / sheathing. Kept on the
  // wood/composites side; non-wood boards are NOT remapped here.
  {
    division: "06_wood_plastics",
    trade: "framing",
    label: "name:ply/sheathing",
    re: /\b(ply(?:wood)?|sheathing|bracing\s+ply(?:wood)?|structural\s+ply(?:wood)?)\b/i,
  },

  // 07 — roofing / roof cladding. Requires explicit ROOF context or a clearly
  // roofing product (long-run / corrugated iron / Colorsteel), so it never
  // grabs wall cladding, roof framing/trusses, or generic sheet metal.
  {
    division: "07_thermal_moisture",
    trade: "cladding",
    label: "name:roofing",
    re: /\b(roofing|roof\s+cladding|roof\s+sheets?|roof\s+iron|long[-\s]?run|corrugated\s+(?:iron|steel)|colou?rsteel|metal\s+roof\w*)\b/i,
  },

  // 09 — paint / primer / coatings (finish role). Material-context lines
  // ("concrete sealer", "timber primer") are already claimed by 03/06 above,
  // so only finish-role paint strings reach here. Excludes "sealant" (silicone).
  {
    division: "09_finishes",
    trade: "other",
    label: "name:paint/coating",
    re: /\b(paint|primer|undercoat|top\s?coat|sealer|coatings?)\b/i,
  },
];

/**
 * Derive a line's quantity provenance from fields ALREADY on the line.
 * Never inferred beyond what the line states. `blocked` wins because that
 * is the must-not-erase missing-info state.
 */
export function deriveProvenance(line: CsiSourceLine): CsiProvenance {
  if (line.takeoff_status === "blocked") return "blocked";
  switch (line.quantity_source) {
    case "calculator":
      return "calculated";
    case "supplier":
      return "supplier";
    case "user":
      return "user";
    case "ai":
      return "ai_estimated";
  }
  if (line.is_calculated_takeoff) return "calculated";
  if (line.is_ai_estimated) return "ai_estimated";
  return "unknown";
}

/**
 * Classify ONE line into a division + trade by its description. Returns the
 * uncategorized result (with an explicit reason) when no rule matches or the
 * line is non-material — never a guessed division.
 */
export function classifyLine(line: CsiSourceLine): {
  division: CsiDivision;
  trade: TradeBucket;
  basis: string[];
} {
  // Non-material lines (labour/other) are not CSI material divisions. Mark
  // them explicitly rather than forcing them into a trade bucket.
  if (line.type && line.type !== "material") {
    return {
      division: "uncategorized",
      trade: "other",
      basis: [`non-material:${line.type}`],
    };
  }

  const desc = (line.description ?? "").trim();
  if (!desc) {
    return {
      division: "uncategorized",
      trade: "other",
      basis: ["unmapped:empty-description"],
    };
  }

  for (const rule of RULES) {
    if (rule.re.test(desc)) {
      return { division: rule.division, trade: rule.trade, basis: [rule.label] };
    }
  }

  return {
    division: "uncategorized",
    trade: "other",
    basis: ["unmapped:no-rule-matched"],
  };
}

/** Map one source line into a CsiLineItem (pure; builds a fresh object). */
function toCsiLine(line: CsiSourceLine): CsiLineItem {
  const { division, trade, basis } = classifyLine(line);
  return {
    source_description: line.description,
    division,
    trade,
    mapping_basis: basis,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unit_price: line.unit_price ?? null,
    takeoff_status: line.takeoff_status ?? null,
    provenance: deriveProvenance(line),
  };
}

/**
 * Group existing review/takeoff line items into a CSI-divisioned view.
 *
 * Pure + non-mutating: input objects are never touched; every output line
 * is freshly built. Divisions appear in canonical order and only when they
 * contain at least one line. Unmapped lines are surfaced explicitly under
 * `uncategorized`, never silently dropped or guessed into a division.
 */
export function mapLinesToCsi(
  lines: readonly CsiSourceLine[],
): CsiGroupedQuote {
  const byDivision = new Map<
    Exclude<CsiDivision, "uncategorized">,
    CsiLineItem[]
  >();
  const uncategorized: CsiLineItem[] = [];
  let blocked = 0;

  for (const line of lines) {
    const mapped = toCsiLine(line);
    if (mapped.takeoff_status === "blocked") blocked += 1;

    if (mapped.division === "uncategorized") {
      uncategorized.push(mapped);
      continue;
    }
    const bucket = byDivision.get(mapped.division);
    if (bucket) bucket.push(mapped);
    else byDivision.set(mapped.division, [mapped]);
  }

  const divisions = DIVISION_ORDER.filter((d) => byDivision.has(d)).map((d) => ({
    division: d,
    lines: byDivision.get(d)!,
  }));

  const mappedCount = divisions.reduce((n, d) => n + d.lines.length, 0);

  return {
    divisions,
    uncategorized,
    totals: {
      mapped: mappedCount,
      uncategorized: uncategorized.length,
      blocked,
    },
  };
}
