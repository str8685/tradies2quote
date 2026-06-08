import { describe, expect, it } from "vitest";
import { classifyLine, deriveProvenance, mapLinesToCsi } from "./map";
import type { CsiSourceLine } from "./contracts";

const line = (over: Partial<CsiSourceLine> & { description: string }): CsiSourceLine => ({
  type: "material",
  quantity: 1,
  unit: "ea",
  unit_price: 0,
  ...over,
});

// ── Division mapping (the enumerated rule set) ─────────────────────────────
describe("mapLinesToCsi — correct CSI division per material family", () => {
  const cases: Array<[string, string]> = [
    ["Concrete piles (200mm)", "03_concrete"],
    ["Ready-mix concrete for slab", "03_concrete"],
    ["Footings reinforcing mesh SE62", "03_concrete"],
    ["Steel beam (UB 150)", "05_metals"],
    ["90x45 SG8 Studs", "06_wood_plastics"],
    ["90x45 SG8 Top plate", "06_wood_plastics"],
    ["Deck joists (2 × 6m stock)", "06_wood_plastics"],
    ["Decking boards (90mm)", "06_wood_plastics"],
    ["Deck bearers", "06_wood_plastics"],
    ["Pink Batts Insulation R2.6", "07_thermal_moisture"],
    ["Building wrap", "07_thermal_moisture"],
    ["Bevel-back weatherboard cladding", "07_thermal_moisture"],
    ["10mm GIB Board", "09_finishes"],
    ["Plasterboard ceiling lining", "09_finishes"],
    ["GIB screws 32mm", "09_finishes"],
  ];

  for (const [desc, division] of cases) {
    it(`"${desc}" → ${division}`, () => {
      expect(classifyLine(line({ description: desc })).division).toBe(division);
    });
  }

  it("groups in canonical division order, only non-empty divisions", () => {
    const grouped = mapLinesToCsi([
      line({ description: "10mm GIB Board" }), // 09
      line({ description: "Concrete piles" }), // 03
      line({ description: "90x45 SG8 Studs" }), // 06
    ]);
    expect(grouped.divisions.map((d) => d.division)).toEqual([
      "03_concrete",
      "06_wood_plastics",
      "09_finishes",
    ]);
    expect(grouped.totals.mapped).toBe(3);
    expect(grouped.totals.uncategorized).toBe(0);
  });
});

// ── Unknown / unmapped stays explicit (no guessing, no silent fallback) ────
describe("mapLinesToCsi — unmapped items are explicit, never guessed", () => {
  it("an unrecognised material → uncategorized with an explicit reason", () => {
    const grouped = mapLinesToCsi([line({ description: "Mystery widget 5000" })]);
    expect(grouped.divisions).toHaveLength(0);
    expect(grouped.uncategorized).toHaveLength(1);
    expect(grouped.uncategorized[0].division).toBe("uncategorized");
    expect(grouped.uncategorized[0].mapping_basis).toEqual(["unmapped:no-rule-matched"]);
  });

  it("a non-material (labour) line → uncategorized, tagged non-material, not a trade division", () => {
    const grouped = mapLinesToCsi([
      line({ description: "Builder labour — 8 hrs", type: "labour" }),
    ]);
    expect(grouped.uncategorized[0].division).toBe("uncategorized");
    expect(grouped.uncategorized[0].mapping_basis).toEqual(["non-material:labour"]);
  });

  it("an empty description → uncategorized, never forced into a bucket", () => {
    expect(classifyLine(line({ description: "   " })).division).toBe("uncategorized");
  });
});

// ── Blocked / missing-info state survives the mapping ──────────────────────
describe("mapLinesToCsi — blocked state is preserved, never erased", () => {
  it("a blocked framing line keeps takeoff_status blocked AND still maps by name", () => {
    const grouped = mapLinesToCsi([
      line({
        description: "Wall framing — needs dimensions",
        takeoff_status: "blocked",
        quantity: 0,
      }),
    ]);
    const all = [...grouped.divisions.flatMap((d) => d.lines), ...grouped.uncategorized];
    expect(all).toHaveLength(1);
    expect(all[0].takeoff_status).toBe("blocked");
    expect(all[0].provenance).toBe("blocked");
    // "framing" in the description still classifies it (blocked ≠ uncategorized)
    expect(all[0].division).toBe("06_wood_plastics");
    expect(grouped.totals.blocked).toBe(1);
  });

  it("needs_review / assumed statuses pass through unchanged", () => {
    const grouped = mapLinesToCsi([
      line({ description: "10mm GIB Board", takeoff_status: "needs_review" }),
      line({ description: "Concrete slab", takeoff_status: "assumed" }),
    ]);
    const statuses = grouped.divisions.flatMap((d) => d.lines.map((l) => l.takeoff_status));
    expect(statuses).toContain("needs_review");
    expect(statuses).toContain("assumed");
  });
});

// ── Provenance derived only from existing fields ───────────────────────────
describe("deriveProvenance — from existing fields only, never guessed", () => {
  it("maps quantity_source faithfully", () => {
    expect(deriveProvenance(line({ description: "x", quantity_source: "calculator" }))).toBe("calculated");
    expect(deriveProvenance(line({ description: "x", quantity_source: "supplier" }))).toBe("supplier");
    expect(deriveProvenance(line({ description: "x", quantity_source: "user" }))).toBe("user");
    expect(deriveProvenance(line({ description: "x", quantity_source: "ai" }))).toBe("ai_estimated");
  });

  it("blocked wins over everything (must-not-erase missing state)", () => {
    expect(
      deriveProvenance(line({ description: "x", takeoff_status: "blocked", quantity_source: "calculator" })),
    ).toBe("blocked");
  });

  it("falls back to is_calculated_takeoff / is_ai_estimated, else unknown", () => {
    expect(deriveProvenance(line({ description: "x", is_calculated_takeoff: true }))).toBe("calculated");
    expect(deriveProvenance(line({ description: "x", is_ai_estimated: true }))).toBe("ai_estimated");
    expect(deriveProvenance(line({ description: "x" }))).toBe("unknown");
  });
});

// ── Wrong-scope protection: organise, do NOT rewrite history ───────────────
describe("mapLinesToCsi — does not remap or rewrite a deck line", () => {
  it("a deck line stays a deck line — description unchanged, trade=decking", () => {
    const src = line({ description: "Deck joists (2 × 6m stock)" });
    const grouped = mapLinesToCsi([src]);
    const mapped = grouped.divisions[0].lines[0];
    // description carried through verbatim — never relabelled as wall framing
    expect(mapped.source_description).toBe("Deck joists (2 × 6m stock)");
    expect(mapped.trade).toBe("decking");
    expect(mapped.division).toBe("06_wood_plastics");
  });

  it("a deck quote and a wall quote both land in 06 WITHOUT cross-contaminating each other", () => {
    // This layer organises existing lines; it neither strips nor moves them
    // between scopes (that is scopeFamily's job, upstream).
    const grouped = mapLinesToCsi([
      line({ description: "Decking boards 140mm" }),
      line({ description: "90x45 SG8 Studs" }),
    ]);
    const six = grouped.divisions.find((d) => d.division === "06_wood_plastics")!;
    expect(six.lines.map((l) => l.trade).sort()).toEqual(["decking", "framing"]);
  });
});

// ── Purity: no mutation, no pricing assumptions ────────────────────────────
describe("mapLinesToCsi — pure: no mutation, no pricing added", () => {
  it("does not mutate the input line objects", () => {
    const input: CsiSourceLine = line({ description: "Concrete piles", unit_price: null });
    const snapshot = JSON.stringify(input);
    mapLinesToCsi([input]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("carries unit_price through verbatim — never invents a price", () => {
    const grouped = mapLinesToCsi([
      line({ description: "Concrete piles", unit_price: null }),
      line({ description: "10mm GIB Board", unit_price: 0 }),
    ]);
    const all = grouped.divisions.flatMap((d) => d.lines);
    expect(all.find((l) => l.source_description === "Concrete piles")!.unit_price).toBeNull();
    expect(all.find((l) => l.source_description === "10mm GIB Board")!.unit_price).toBe(0);
    // and quantity is carried, never derived
    expect(all.every((l) => l.quantity === 1)).toBe(true);
  });

  it("an empty quote maps to an empty grouped view, no throw", () => {
    const grouped = mapLinesToCsi([]);
    expect(grouped.divisions).toHaveLength(0);
    expect(grouped.uncategorized).toHaveLength(0);
    expect(grouped.totals).toEqual({ mapped: 0, uncategorized: 0, blocked: 0 });
  });
});

// Helper: division of a single line ("uncategorized" when no rule matched).
const div = (description: string, over: Partial<CsiSourceLine> = {}) =>
  classifyLine(line({ description, ...over })).division;

// ── POLICY 1 — bare fasteners stay uncategorized, context-bearing map ──────
describe("policy 1 — bare fasteners are never guessed", () => {
  it("generic screws / nails / bolts → uncategorized", () => {
    expect(div("Galvanised nails 90mm")).toBe("uncategorized");
    expect(div("Stainless screws box")).toBe("uncategorized");
    expect(div("M12 bolts")).toBe("uncategorized");
    expect(div("Brackets and connectors")).toBe("uncategorized");
  });

  it("context-bearing fasteners still map to 06", () => {
    expect(div("Joist hangers")).toBe("06_wood_plastics");
    expect(div("Joist hanger nails")).toBe("06_wood_plastics");
    expect(div("Decking screws (stainless)")).toBe("06_wood_plastics");
    expect(div("Framing nails 90mm")).toBe("06_wood_plastics");
    expect(div("Nail plates")).toBe("06_wood_plastics");
  });
});

// ── POLICY 2 — finish carpentry: timber → 06, plaster cornice → 09 ─────────
describe("policy 2 — finish carpentry", () => {
  it("skirting / architrave / scotia → Division 06", () => {
    expect(div("Pine skirting 60mm")).toBe("06_wood_plastics");
    expect(div("Architrave 60x18")).toBe("06_wood_plastics");
    expect(div("Scotia")).toBe("06_wood_plastics");
  });

  it("plaster cornice / coving → Division 09", () => {
    expect(div("Cornice")).toBe("09_finishes");
    expect(div("Coving 90mm")).toBe("09_finishes");
    expect(div("Coved cornice")).toBe("09_finishes");
  });

  it("timber-qualified cornice → Division 06 (beats the plaster cornice rule)", () => {
    expect(div("Timber cornice")).toBe("06_wood_plastics");
    expect(div("MDF cornice")).toBe("06_wood_plastics");
  });

  it("genuinely ambiguous trim with no material clue → uncategorized", () => {
    expect(div("Decorative trim moulding")).toBe("uncategorized");
  });
});

// ── POLICY 3 — lintels by material; bare lintel uncategorized ──────────────
describe("policy 3 — lintels", () => {
  it("steel lintel → 05, timber/LVL lintel → 06", () => {
    expect(div("Steel lintel 150 PFC")).toBe("05_metals");
    expect(div("Timber lintel 290x45")).toBe("06_wood_plastics");
    expect(div("LVL lintel")).toBe("06_wood_plastics");
  });

  it("bare lintel with no material clue → uncategorized (never assume timber)", () => {
    expect(div("Lintel over opening")).toBe("uncategorized");
  });
});

// ── POLICY 4 — flashing → 07 default; soffit/fascia by context ─────────────
describe("policy 4 — flashings / soffit / fascia", () => {
  it("flashing → 07 by default, and metal/steel flashing STAYS 07 (not 05)", () => {
    expect(div("Flashing")).toBe("07_thermal_moisture");
    expect(div("Metal flashing")).toBe("07_thermal_moisture");
    expect(div("Galvanised steel flashing")).toBe("07_thermal_moisture");
  });

  it("clearly-cladding soffit/fascia → 07", () => {
    expect(div("Fibre-cement soffit")).toBe("07_thermal_moisture");
    expect(div("PVC fascia")).toBe("07_thermal_moisture");
  });

  it("clearly-timber soffit/fascia → 06", () => {
    expect(div("Timber fascia board")).toBe("06_wood_plastics");
    expect(div("Bargeboard")).toBe("06_wood_plastics");
  });

  it("bare soffit / fascia with no context → uncategorized", () => {
    expect(div("Soffit")).toBe("uncategorized");
    expect(div("Fascia")).toBe("uncategorized");
  });
});

// ── LOCKED CALL A — PVC cornice → 09 (finish role, not raw material) ───────
describe("locked: cornice is classified by finish role", () => {
  it("PVC cornice → Division 09 (not 06)", () => {
    expect(div("PVC cornice")).toBe("09_finishes");
    expect(div("uPVC cornice 90mm")).toBe("09_finishes");
  });

  it("timber cornice stays Division 06", () => {
    expect(div("Timber cornice")).toBe("06_wood_plastics");
    expect(div("MDF cornice")).toBe("06_wood_plastics");
  });

  it("bare/plaster cornice & coving → 09; genuinely ambiguous trim → uncategorized", () => {
    expect(div("Cornice")).toBe("09_finishes");
    expect(div("Coving")).toBe("09_finishes");
    expect(div("Decorative trim moulding")).toBe("uncategorized");
  });
});

// ── LOCKED CALL B — reinforcing steel stays in the concrete package (03) ───
describe("locked: reinforcing → Division 03, never 05", () => {
  it("rebar / reo / reinforcing bar / reinforcement → 03", () => {
    expect(div("Rebar 12mm")).toBe("03_concrete");
    expect(div("Reo bars")).toBe("03_concrete");
    expect(div("Reinforcing bar D12")).toBe("03_concrete");
    expect(div("Reinforcement starter bars")).toBe("03_concrete");
  });

  it("reinforcing / reinforcement / welded mesh → 03", () => {
    expect(div("Reinforcing mesh SE62")).toBe("03_concrete");
    expect(div("Reinforcement mesh")).toBe("03_concrete");
    expect(div("Welded mesh sheets")).toBe("03_concrete");
    // real calculator output strings
    expect(div("Reinforcing mesh (SE62)")).toBe("03_concrete");
    expect(div("Reinforcing mesh sheets")).toBe("03_concrete");
  });

  it("'steel reinforcing mesh' still lands in 03 (concrete wins over steel)", () => {
    expect(div("Steel reinforcing mesh")).toBe("03_concrete");
  });

  it("structural steel members are unaffected → still 05", () => {
    expect(div("Steel beam UB 150")).toBe("05_metals");
    expect(div("Steel post 89 SHS")).toBe("05_metals");
    expect(div("Steel lintel 150 PFC")).toBe("05_metals");
  });

  it("bare 'mesh' with no reinforcement context → uncategorized (no false concrete match)", () => {
    expect(div("Insect mesh screen")).toBe("uncategorized");
    expect(div("Mesh")).toBe("uncategorized");
  });
});

// ── REAL-DATA PASS — paint → 09, roofing → 07, ply/sheathing → 06 ──────────
describe("real-data pass: paint / primer / coating → Division 09", () => {
  it("maps common finish-role coating strings to 09", () => {
    expect(div("Interior paint and primer")).toBe("09_finishes");
    expect(div("Resene undercoat")).toBe("09_finishes");
    expect(div("Exterior topcoat")).toBe("09_finishes");
    expect(div("Sealer")).toBe("09_finishes");
    expect(div("Protective coating")).toBe("09_finishes");
  });

  it("material-context coatings stay with their material (no wrong-scope steal)", () => {
    expect(div("Concrete sealer")).toBe("03_concrete"); // concrete wins
    expect(div("Timber primer")).toBe("06_wood_plastics"); // timber wins
  });

  it("does not capture silicone sealant (not a finish coat)", () => {
    expect(div("Silicone sealant")).toBe("uncategorized");
  });
});

describe("real-data pass: roofing / roof cladding → Division 07", () => {
  it("maps clear roofing strings to 07", () => {
    expect(div("Colorsteel roofing 0.4mm")).toBe("07_thermal_moisture");
    expect(div("Corrugated iron roofing")).toBe("07_thermal_moisture");
    expect(div("Long-run roofing")).toBe("07_thermal_moisture");
    expect(div("Metal roofing sheets")).toBe("07_thermal_moisture");
    expect(div("Roof cladding")).toBe("07_thermal_moisture");
  });

  it("does NOT capture roof framing or generic roof context", () => {
    expect(div("Roof framing timber 140x45")).toBe("06_wood_plastics"); // framing wins
    expect(div("Roof trusses 35 degree")).toBe("uncategorized"); // no roofing product → not stolen
  });
});

describe("real-data pass: plywood / bracing / sheathing → Division 06", () => {
  it("maps structural wood-sheet strings to 06", () => {
    expect(div("Plywood structural bracing 12mm")).toBe("06_wood_plastics");
    expect(div("Bracing ply")).toBe("06_wood_plastics");
    expect(div("Wall sheathing")).toBe("06_wood_plastics");
    expect(div("Roof sheathing plywood")).toBe("06_wood_plastics");
    expect(div("Structural plywood")).toBe("06_wood_plastics");
  });

  it("does not over-match (word-boundary 'ply' ≠ 'supply')", () => {
    expect(div("Supply and install allowance")).toBe("uncategorized");
  });
});

describe("real-data pass: fencing remains untouched (reported separately)", () => {
  it("fence timber stays uncategorized — no new rule added", () => {
    expect(div("Fence posts")).toBe("uncategorized");
    expect(div("Fence rails")).toBe("uncategorized");
    expect(div("Palings")).toBe("uncategorized");
  });
});

describe("real-data pass: generic fasteners still uncategorized", () => {
  it("bare fasteners unchanged by the new rules", () => {
    expect(div("Galvanised coach screws M12x150")).toBe("uncategorized");
    expect(div("Galvanised nails and screws")).toBe("uncategorized");
    expect(div("Fixings and hardware")).toBe("uncategorized");
  });
});

// ── POLICY 5 — labour / non-material stays excluded ────────────────────────
describe("policy 5 — labour / non-material lines excluded from CSI divisions", () => {
  it("labour and other lines remain uncategorized, tagged non-material", () => {
    const grouped = mapLinesToCsi([
      line({ description: "Site labour 8 hrs", type: "labour" }),
      line({ description: "Skip bin hire", type: "other" }),
    ]);
    expect(grouped.divisions).toHaveLength(0);
    expect(grouped.uncategorized.map((l) => l.mapping_basis[0])).toEqual([
      "non-material:labour",
      "non-material:other",
    ]);
  });
});
