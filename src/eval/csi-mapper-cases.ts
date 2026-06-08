// ─────────────────────────────────────────────────────────────────────────
// CSI mapper eval fixtures — representative quote_data.line_items.
//
// Hand-labelled, dev/test only. These mirror the kind of lines the takeoff
// calculators + review editor actually produce (NZ tradie descriptions),
// across every category the Stage-1 taxonomy must handle. Each case carries
// the division we EXPECT today; "uncategorized" is a legitimate expected
// label for genuinely-ambiguous, non-material, or future-taxonomy lines.
//
// Adding a case here also extends the always-on regression guard in
// csi-mapper-eval.test.ts (mismatches must stay 0).
// ─────────────────────────────────────────────────────────────────────────

import type { CsiEvalCase } from "@/lib/takeoff/csi/eval";

export const CSI_MAPPER_CASES: CsiEvalCase[] = [
  // ── Concrete / foundations (incl. reinforcing → 03) ──────────────────────
  { group: "concrete", description: "Concrete 25MPa for slab (m³)", expected: "03_concrete", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "concrete", description: "Reinforcing mesh (SE62)", expected: "03_concrete", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "concrete", description: "Concrete piles 200mm", expected: "03_concrete", line: { quantity_source: "calculator" } },
  { group: "concrete", description: "DPM polythene 0.25mm under slab", expected: "03_concrete", line: { quantity_source: "calculator" } },
  { group: "concrete", description: "Hardfill GAP65 base course", expected: "03_concrete" },

  // ── Wall / floor framing → 06 ────────────────────────────────────────────
  { group: "framing", description: "90x45 SG8 H1.2 studs", expected: "06_wood_plastics", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "framing", description: "90x45 SG8 top plate", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "framing", description: "140x45 SG8 bottom plate", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "framing", description: "90x45 SG8 dwangs / nogs", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "framing", description: "Timber lintel 290x45 over window", expected: "06_wood_plastics" },

  // ── Deck structure → 06 (concrete pile from a deck still → 03) ────────────
  { group: "deck", description: "Deck joists 140x45 H3.2", expected: "06_wood_plastics", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "deck", description: "Deck bearers 190x45 H3.2", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "deck", description: "Decking boards 140x32 Kwila", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "deck", description: "Joist hangers", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },
  { group: "deck", description: "Decking screws (stainless)", expected: "06_wood_plastics", line: { quantity_source: "calculator" } },

  // ── Insulation / moisture envelope → 07 ──────────────────────────────────
  { group: "insulation", description: "Pink Batts R2.6 wall insulation", expected: "07_thermal_moisture", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "insulation", description: "Building wrap (Thermakraft)", expected: "07_thermal_moisture", line: { quantity_source: "calculator" } },
  { group: "insulation", description: "DPC 300mm damp-proof course", expected: "07_thermal_moisture" },
  { group: "cladding", description: "Bevel-back weatherboard cladding", expected: "07_thermal_moisture", line: { quantity_source: "calculator" } },
  { group: "cladding", description: "Cavity battens 20mm", expected: "07_thermal_moisture", line: { quantity_source: "calculator" } },
  { group: "cladding", description: "Galvanised steel flashing (head)", expected: "07_thermal_moisture" },

  // ── GIB / lining / finishes → 09 ─────────────────────────────────────────
  { group: "lining", description: "10mm GIB Standard board", expected: "09_finishes", line: { quantity_source: "calculator", is_calculated_takeoff: true } },
  { group: "lining", description: "13mm GIB Aqualine (wet areas)", expected: "09_finishes", line: { quantity_source: "calculator" } },
  { group: "lining", description: "GIB stopping compound", expected: "09_finishes", line: { quantity_source: "calculator" } },
  { group: "lining", description: "GIB screws 32mm", expected: "09_finishes", line: { quantity_source: "calculator" } },
  { group: "finishes", description: "Pine skirting 60mm", expected: "06_wood_plastics" },
  { group: "finishes", description: "PVC cornice 90mm", expected: "09_finishes" },

  // ── Blocked lines (status preserved; still classify by name) ─────────────
  { group: "blocked", description: "Wall framing — needs dimensions", expected: "06_wood_plastics", line: { takeoff_status: "blocked", quantity: 0 } },
  { group: "blocked", description: "Ceiling insulation — needs area", expected: "07_thermal_moisture", line: { takeoff_status: "blocked", quantity: 0 } },

  // ── Ambiguous material lines → uncategorized (by design, no guessing) ─────
  { group: "ambiguous", description: "Lintel over opening", expected: "uncategorized" },
  { group: "ambiguous", description: "Fixings as required", expected: "uncategorized" },
  { group: "ambiguous", description: "Sundries", expected: "uncategorized" },
  { group: "ambiguous", description: "Misc hardware", expected: "uncategorized" },

  // ── Future taxonomy candidates (uncategorized today, real materials) ──────
  { group: "future", description: "Pine quad mould 19mm", expected: "uncategorized", futureCandidate: true },
  { group: "future", description: "Picture rail 42mm", expected: "uncategorized", futureCandidate: true },
  { group: "future", description: "Dado rail", expected: "uncategorized", futureCandidate: true },

  // ── Non-material lines (excluded from CSI divisions by design) ────────────
  { group: "non-material", description: "Builder labour — 16 hrs", expected: "uncategorized", line: { type: "labour" } },
  { group: "non-material", description: "Skip bin hire", expected: "uncategorized", line: { type: "other" } },
  { group: "non-material", description: "Scaffold hire (2 weeks)", expected: "uncategorized", line: { type: "other" } },
];
