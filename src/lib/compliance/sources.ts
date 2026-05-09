/**
 * Approved knowledge-base sources.
 *
 * This is the only place rules pull authoritative references from. We
 * deliberately do NOT fetch live websites at quote time — every chunk
 * here is curated, versioned, and citable.
 *
 * Adding a new source:
 *   1. Add an entry below with id/source_type/name/version/reference/
 *      summary/confidence.
 *   2. Cite it from a rule via `{ source_id, reason }`.
 *
 * IMPORTANT: supplier catalogues (e.g. Mitre 10) are listed as
 * `supplier_catalogue` — they're allowed as material-name references but
 * they are NOT code authority. Rules must not pull compliance decisions
 * from a supplier catalogue.
 */

import type { KnowledgeSource } from "./types";

export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  // -------------------------------------------------------------------------
  // NZ Building Code — performance clauses we cite most.
  // -------------------------------------------------------------------------
  {
    id: "nzbc-b1",
    source_type: "nz_building_code",
    name: "NZ Building Code Clause B1 — Structure",
    version: "MBIE Acceptable Solutions B1/AS1",
    reference: "Clause B1",
    summary:
      "Structural requirements for buildings — loads, durability, and resistance. Requires loadbearing and bracing walls to be designed/specified to NZS 3604 (or specific engineering design).",
    confidence: "high",
  },
  {
    id: "nzbc-b2",
    source_type: "nz_building_code",
    name: "NZ Building Code Clause B2 — Durability",
    version: "MBIE Acceptable Solutions B2/AS1",
    reference: "Clause B2",
    summary:
      "Building elements must remain durable for specified periods (typically 50 years for structure, 15 years for cladding). Drives timber treatment selection per NZS 3602.",
    confidence: "high",
  },
  {
    id: "nzbc-e2",
    source_type: "nz_building_code",
    name: "NZ Building Code Clause E2 — External Moisture",
    version: "MBIE Acceptable Solutions E2/AS1",
    reference: "Clause E2",
    summary:
      "External walls must keep weather out. Drives cladding/cavity choices and the use of treated framing in external walls.",
    confidence: "high",
  },
  {
    id: "nzbc-h1",
    source_type: "nz_building_code",
    name: "NZ Building Code Clause H1 — Energy Efficiency",
    version: "MBIE Acceptable Solutions H1/AS1, 5th edition",
    reference: "Clause H1",
    summary:
      "Thermal envelope of new buildings must meet minimum R-values. Insulation in external walls (and roofs/floors of the thermal envelope) is required; values vary by climate zone.",
    confidence: "high",
  },

  // -------------------------------------------------------------------------
  // NZ Standards — the timber framing/treatment trio.
  // -------------------------------------------------------------------------
  {
    id: "nzs-3604",
    source_type: "nz_standard",
    name: "NZS 3604 — Timber-framed buildings",
    version: "NZS 3604:2011 (Amend 2 2022)",
    reference: "Throughout — see clauses 7 (framing) and 8 (bracing)",
    summary:
      "Standard for non-specific-engineering-design timber-framed buildings up to a defined size. Specifies stud size, spacing, top/bottom plate, lintel sizing, and bracing requirements.",
    confidence: "high",
  },
  {
    id: "nzs-3602",
    source_type: "nz_standard",
    name: "NZS 3602 — Timber and wood-based products for use in building",
    version: "NZS 3602:2003",
    reference: "Tables 1 and 2",
    summary:
      "Specifies minimum hazard-class treatment for timber by end-use: H1.2 protected internal framing; H3.1 partial exterior; H3.2 fully exposed but above ground; H4 in-ground; H5 critical in-ground.",
    confidence: "high",
  },
  {
    id: "nzs-3640",
    source_type: "nz_standard",
    name: "NZS 3640 — Chemical preservation of round and sawn timber",
    version: "NZS 3640:2003",
    reference: "Section 5",
    summary:
      "Defines hazard classes H1-H6 and treatment chemicals/retentions. H1.2 vs H3.2 vs H4 vs H5 are NOT interchangeable — each is a distinct preservation envelope for a distinct exposure condition.",
    confidence: "high",
  },

  // -------------------------------------------------------------------------
  // BRANZ guidance — practical interpretation.
  // -------------------------------------------------------------------------
  {
    id: "branz-fastener-corrosion",
    source_type: "branz_guidance",
    name: "BRANZ — Fasteners and corrosion in NZ buildings",
    version: "BRANZ Build / Bulletin guidance",
    reference: "Multiple Build articles",
    summary:
      "Bright steel nails are only suitable for protected dry interior framing. CCA/MCA-treated framing or external exposure requires hot-dip galvanised or stainless steel fasteners; mismatched metals can fail prematurely.",
    confidence: "medium",
  },

  // -------------------------------------------------------------------------
  // Manufacturer install resources.
  // -------------------------------------------------------------------------
  {
    id: "gib-site-guide",
    source_type: "manufacturer_install",
    name: "GIB Site Guide",
    version: "Winstone Wallboards GIB Site Guide (current)",
    reference: "Wet area / Aqualine section",
    summary:
      "GIB Aqualine is the wet-area board for bathrooms, laundries, and kitchens. Standard GIB is not rated for wet areas; substituting one for the other is non-compliant. Acoustic systems use GIB Noiseline; bracing systems use GIB Braceline.",
    confidence: "high",
  },
  {
    id: "mitek-fixings",
    source_type: "manufacturer_install",
    name: "MiTek New Zealand fixings & connectors",
    version: "Current MiTek NZ install guides",
    reference: "Connector fastener schedule",
    summary:
      "MiTek connectors specify required fastener type and quantity; substituting bright steel for galvanised in a treated/exterior application voids the connector's design load.",
    confidence: "medium",
  },

  // -------------------------------------------------------------------------
  // Supplier catalogues — material-name reference only, NOT code authority.
  // -------------------------------------------------------------------------
  {
    id: "mitre10-catalogue",
    source_type: "supplier_catalogue",
    name: "Mitre 10 reference catalogue",
    version: "Imported in Stage 4.8 cutover",
    reference: "materials.attributes.source = 'kimi_material_library'",
    summary:
      "Supplier-side product names and pack sizes for matching. Treat as material lookup, NOT as compliance authority. Default unit prices are intentionally null — supplier prices change.",
    confidence: "low",
  },
] as const;

/** Look up a source by id; returns undefined if missing. */
export function findSource(id: string): KnowledgeSource | undefined {
  return KNOWLEDGE_SOURCES.find((s) => s.id === id);
}

/** True iff every citation refers to a known source id. */
export function citationsAreValid(
  citations: ReadonlyArray<{ source_id: string }>,
): boolean {
  return citations.every((c) => findSource(c.source_id) !== undefined);
}
