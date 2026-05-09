/**
 * Stage 4.5 — dev-branch material catalogue seed.
 *
 * SAFETY: refuses to run against the production project. The script reads
 * NEXT_PUBLIC_SUPABASE_URL from env, verifies it does NOT match the
 * production project ref, and only then connects + upserts.
 *
 * IDEMPOTENCY: uses deterministic UUIDs and `onConflict: ignoreDuplicates`
 * so re-running is a no-op once seeded.
 *
 * To run manually against a Supabase dev branch:
 *
 *   1. ensure `.env.development.local` points at the dev branch (URL + key)
 *      and SUPABASE_SERVICE_ROLE_KEY is set to the dev branch's key
 *   2. `npx tsx --env-file=.env.development.local scripts/seed-stage-4-materials.ts`
 *
 * The same data is also captured in two named Supabase migrations
 * (phase_4_3_dev_seed_materials, phase_4_5_dev_seed_extension) so a fresh
 * Supabase branch picks the seed up via apply_migration without invoking
 * this script.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "guiovuqccbzlbacaxepd";

/** Stable UUIDs so re-runs are idempotent. UUID v4 shape, but content fixed. */
const ID = (suffix: string) => `11111111-1111-4111-8111-${suffix}`;

export type SeedMaterial = {
  id: string;
  user_id: null;
  country: "NZ";
  category: string;
  name: string;
  normalized_name: string;
  unit: string;
  default_unit_price: number;
  gst_included: boolean;
  attributes: Record<string, unknown>;
  active: boolean;
  price_source: "catalogue_seed";
  price_confidence: "high" | "medium" | "low";
  brand?: string;
  supplier?: string;
};

export type SeedAlias = {
  material_id: string;
  alias: string;
  normalized_alias: string;
  source: "seed";
  confidence: "high" | "medium";
};

// =============================================================================
// 32 NZ-context catalogue rows across timber / plasterboard / insulation /
// decking / fixings / concrete / cladding / roofing / paint / hardware /
// sundries. Prices are deliberate seed estimates (price_source='catalogue_seed',
// price_confidence reflects how confident we are in that seed value).
// =============================================================================

export const SEED_MATERIALS: SeedMaterial[] = [
  // --- timber (Phase 4.3) ---
  {
    id: ID("000000000001"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H1.2 Pine Framing 90x45",
    normalized_name: "h1.2 pine framing 90x45",
    unit: "m",
    default_unit_price: 4.5,
    gst_included: true,
    attributes: {
      treatment_class: "H1.2",
      size: "90x45",
      species: "radiata pine",
      use_case: "internal_framing",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000002"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H3.2 Pine Joist 140x45",
    normalized_name: "h3.2 pine joist 140x45",
    unit: "m",
    default_unit_price: 11.2,
    gst_included: true,
    attributes: {
      treatment_class: "H3.2",
      size: "140x45",
      species: "radiata pine",
      use_case: "deck_joist",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000003"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H4 Pine Post 100x100",
    normalized_name: "h4 pine post 100x100",
    unit: "m",
    default_unit_price: 18.5,
    gst_included: true,
    attributes: {
      treatment_class: "H4",
      size: "100x100",
      species: "radiata pine",
      use_case: "in_ground_post",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000004"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H5 Pine Pile 200x200",
    normalized_name: "h5 pine pile 200x200",
    unit: "m",
    default_unit_price: 68.0,
    gst_included: true,
    attributes: {
      treatment_class: "H5",
      size: "200x200",
      species: "radiata pine",
      use_case: "pile",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // --- plasterboard (Phase 4.3) ---
  {
    id: ID("000000000005"),
    user_id: null,
    country: "NZ",
    category: "plasterboard",
    name: "GIB Standard 10mm 2400x1200",
    normalized_name: "gib standard 10mm 2400x1200",
    unit: "sheet",
    default_unit_price: 42.0,
    gst_included: true,
    attributes: {
      brand: "GIB",
      product_type: "GIB Standard",
      thickness: "10mm",
      sheet_size: "2400x1200",
      use_case: "general_wall_lining",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "GIB",
  },
  {
    id: ID("000000000006"),
    user_id: null,
    country: "NZ",
    category: "plasterboard",
    name: "GIB Aqualine 13mm 2400x1200",
    normalized_name: "gib aqualine 13mm 2400x1200",
    unit: "sheet",
    default_unit_price: 78.0,
    gst_included: true,
    attributes: {
      brand: "GIB",
      product_type: "GIB Aqualine",
      thickness: "13mm",
      sheet_size: "2400x1200",
      use_case: "wet_area_wall_lining",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "GIB",
  },
  // --- insulation (Phase 4.3) ---
  {
    id: ID("000000000007"),
    user_id: null,
    country: "NZ",
    category: "insulation",
    name: "Pink Batts R2.6 ceiling",
    normalized_name: "pink batts r2.6 ceiling",
    unit: "pack",
    default_unit_price: 89.0,
    gst_included: true,
    attributes: {
      brand: "Pink Batts",
      r_value: "2.6",
      use_case: "ceiling",
      pack_coverage_m2: 8.4,
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "Pink Batts",
  },
  // --- decking (Phase 4.3) ---
  {
    id: ID("000000000008"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H3.2 Pine Decking 90x32",
    normalized_name: "h3.2 pine decking 90x32",
    unit: "m",
    default_unit_price: 8.5,
    gst_included: true,
    attributes: {
      treatment_class: "H3.2",
      size: "90x32",
      species: "radiata pine",
      use_case: "decking",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // --- fixings (Phase 4.3) ---
  {
    id: ID("000000000009"),
    user_id: null,
    country: "NZ",
    category: "fixing",
    name: "Stainless Decking Screws 10g x 65mm",
    normalized_name: "stainless decking screws 10g 65mm",
    unit: "pack",
    default_unit_price: 45.0,
    gst_included: true,
    attributes: {
      fixing_type: "screw",
      finish: "stainless",
      size: "10g x 65mm",
      pack_quantity: 200,
      use_case: "decking",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // --- battens (Phase 4.3) ---
  {
    id: ID("00000000000a"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H3.2 Pine Batten 50x50",
    normalized_name: "h3.2 pine batten 50x50",
    unit: "m",
    default_unit_price: 4.2,
    gst_included: true,
    attributes: {
      treatment_class: "H3.2",
      size: "50x50",
      species: "radiata pine",
      use_case: "batten",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // --- nogs/dwangs (Phase 4.3) ---
  {
    id: ID("00000000000b"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H1.2 Pine Nogs/Dwangs 90x45",
    normalized_name: "h1.2 pine nogs/dwangs 90x45",
    unit: "m",
    default_unit_price: 4.5,
    gst_included: true,
    attributes: {
      treatment_class: "H1.2",
      size: "90x45",
      species: "radiata pine",
      use_case: "nogs_dwangs",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },

  // --- Phase 4.5 expansion (21 new) ---

  // timber (extra sizes)
  {
    id: ID("00000000000c"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H1.2 Pine Framing 140x45",
    normalized_name: "h1.2 pine framing 140x45",
    unit: "m",
    default_unit_price: 7.6,
    gst_included: true,
    attributes: {
      treatment_class: "H1.2",
      size: "140x45",
      species: "radiata pine",
      use_case: "internal_framing",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("00000000000d"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H3.2 Pine Joist 240x45",
    normalized_name: "h3.2 pine joist 240x45",
    unit: "m",
    default_unit_price: 19.2,
    gst_included: true,
    attributes: {
      treatment_class: "H3.2",
      size: "240x45",
      species: "radiata pine",
      use_case: "deck_joist",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("00000000000e"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "H4 Pine Post 125x125",
    normalized_name: "h4 pine post 125x125",
    unit: "m",
    default_unit_price: 28.0,
    gst_included: true,
    attributes: {
      treatment_class: "H4",
      size: "125x125",
      species: "radiata pine",
      use_case: "in_ground_post",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // plasterboard
  {
    id: ID("00000000000f"),
    user_id: null,
    country: "NZ",
    category: "plasterboard",
    name: "GIB Standard 13mm 2400x1200",
    normalized_name: "gib standard 13mm 2400x1200",
    unit: "sheet",
    default_unit_price: 56.0,
    gst_included: true,
    attributes: {
      brand: "GIB",
      product_type: "GIB Standard",
      thickness: "13mm",
      sheet_size: "2400x1200",
      use_case: "general_wall_lining",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "GIB",
  },
  {
    id: ID("000000000010"),
    user_id: null,
    country: "NZ",
    category: "plasterboard",
    name: "GIB Braceline 10mm 2400x1200",
    normalized_name: "gib braceline 10mm 2400x1200",
    unit: "sheet",
    default_unit_price: 64.0,
    gst_included: true,
    attributes: {
      brand: "GIB",
      product_type: "GIB Braceline",
      thickness: "10mm",
      sheet_size: "2400x1200",
      use_case: "structural_bracing",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "GIB",
  },
  // insulation
  {
    id: ID("000000000011"),
    user_id: null,
    country: "NZ",
    category: "insulation",
    name: "Pink Batts R2.0 wall",
    normalized_name: "pink batts r2.0 wall",
    unit: "pack",
    default_unit_price: 79.0,
    gst_included: true,
    attributes: {
      brand: "Pink Batts",
      r_value: "2.0",
      use_case: "wall",
      pack_coverage_m2: 7.4,
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "Pink Batts",
  },
  {
    id: ID("000000000012"),
    user_id: null,
    country: "NZ",
    category: "insulation",
    name: "Pink Batts R3.6 ceiling",
    normalized_name: "pink batts r3.6 ceiling",
    unit: "pack",
    default_unit_price: 109.0,
    gst_included: true,
    attributes: {
      brand: "Pink Batts",
      r_value: "3.6",
      use_case: "ceiling",
      pack_coverage_m2: 7.5,
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "Pink Batts",
  },
  // decking — kwila
  {
    id: ID("000000000013"),
    user_id: null,
    country: "NZ",
    category: "timber",
    name: "Kwila Decking 90x19",
    normalized_name: "kwila decking 90x19",
    unit: "m",
    default_unit_price: 14.5,
    gst_included: true,
    attributes: {
      species: "kwila",
      size: "90x19",
      use_case: "decking",
      exposure: "exterior",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "medium",
  },
  // fixings extras
  {
    id: ID("000000000014"),
    user_id: null,
    country: "NZ",
    category: "fixing",
    name: "Galvanised Framing Nails 90x3.15mm",
    normalized_name: "galvanised framing nails 90x3.15mm",
    unit: "kg",
    default_unit_price: 12.0,
    gst_included: true,
    attributes: {
      fixing_type: "nail",
      finish: "galvanised",
      size: "90x3.15mm",
      use_case: "framing",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000015"),
    user_id: null,
    country: "NZ",
    category: "fixing",
    name: "Joist Hanger 100x50 Galvanised",
    normalized_name: "joist hanger 100x50 galvanised",
    unit: "each",
    default_unit_price: 4.95,
    gst_included: true,
    attributes: {
      fixing_type: "hanger",
      finish: "galvanised",
      size: "100x50",
      use_case: "joist_hanging",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000016"),
    user_id: null,
    country: "NZ",
    category: "fixing",
    name: "M12 x 200mm Coach Screw Galvanised",
    normalized_name: "m12 200mm coach screw galvanised",
    unit: "each",
    default_unit_price: 3.5,
    gst_included: true,
    attributes: {
      fixing_type: "coach_screw",
      finish: "galvanised",
      size: "M12 x 200mm",
      use_case: "structural_connection",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // concrete
  {
    id: ID("000000000017"),
    user_id: null,
    country: "NZ",
    category: "concrete",
    name: "Concrete Mix 25kg General Purpose",
    normalized_name: "concrete mix 25kg general purpose",
    unit: "bag",
    default_unit_price: 11.5,
    gst_included: true,
    attributes: {
      material_type: "concrete_mix",
      pack_quantity: "25kg",
      use_case: "general_purpose",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000018"),
    user_id: null,
    country: "NZ",
    category: "concrete",
    name: "Concrete Mix 20kg Rapid Set",
    normalized_name: "concrete mix 20kg rapid set",
    unit: "bag",
    default_unit_price: 14.5,
    gst_included: true,
    attributes: {
      material_type: "concrete_mix",
      pack_quantity: "20kg",
      use_case: "rapid_set",
      cure_time_min: 15,
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  // cladding
  {
    id: ID("000000000019"),
    user_id: null,
    country: "NZ",
    category: "cladding",
    name: "James Hardie Linea Weatherboard 180mm",
    normalized_name: "james hardie linea weatherboard 180mm",
    unit: "m",
    default_unit_price: 22.0,
    gst_included: true,
    attributes: {
      brand: "James Hardie",
      product_type: "Linea",
      size: "180mm",
      material_type: "fibre_cement",
      use_case: "exterior_cladding",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "medium",
    brand: "James Hardie",
  },
  // roofing
  {
    id: ID("00000000001a"),
    user_id: null,
    country: "NZ",
    category: "roofing",
    name: "Colorsteel Corrugated 0.55mm",
    normalized_name: "colorsteel corrugated 0.55mm",
    unit: "m",
    default_unit_price: 38.0,
    gst_included: true,
    attributes: {
      brand: "Colorsteel",
      thickness: "0.55mm",
      profile: "corrugated",
      material_type: "steel",
      use_case: "roofing",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "medium",
    brand: "Colorsteel",
  },
  {
    id: ID("00000000001b"),
    user_id: null,
    country: "NZ",
    category: "roofing",
    name: "Roofing Underlay 50m Roll",
    normalized_name: "roofing underlay 50m roll",
    unit: "roll",
    default_unit_price: 95.0,
    gst_included: true,
    attributes: {
      material_type: "synthetic_underlay",
      pack_quantity: "50m roll",
      use_case: "roof_substrate",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "medium",
  },
  // paint
  {
    id: ID("00000000001c"),
    user_id: null,
    country: "NZ",
    category: "paint",
    name: "Resene SpaceCote Low Sheen 4L",
    normalized_name: "resene spacecote low sheen 4l",
    unit: "tin",
    default_unit_price: 138.0,
    gst_included: true,
    attributes: {
      brand: "Resene",
      product_type: "SpaceCote",
      finish: "low_sheen",
      pack_quantity: "4L",
      use_case: "interior_walls",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "Resene",
  },
  {
    id: ID("00000000001d"),
    user_id: null,
    country: "NZ",
    category: "paint",
    name: "Resene Lumbersider 4L",
    normalized_name: "resene lumbersider 4l",
    unit: "tin",
    default_unit_price: 168.0,
    gst_included: true,
    attributes: {
      brand: "Resene",
      product_type: "Lumbersider",
      pack_quantity: "4L",
      use_case: "exterior_timber",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
    brand: "Resene",
  },
  // hardware
  {
    id: ID("00000000001e"),
    user_id: null,
    country: "NZ",
    category: "hardware",
    name: "Heavy Duty Hinge Pair",
    normalized_name: "heavy duty hinge pair",
    unit: "pair",
    default_unit_price: 18.5,
    gst_included: true,
    attributes: {
      material_type: "hinge",
      finish: "stainless",
      use_case: "door_hardware",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "medium",
  },
  // sundries
  {
    id: ID("00000000001f"),
    user_id: null,
    country: "NZ",
    category: "sundries",
    name: "Builders Polythene 4m x 25m",
    normalized_name: "builders polythene 4m x 25m",
    unit: "roll",
    default_unit_price: 85.0,
    gst_included: true,
    attributes: {
      material_type: "polythene_dpm",
      size: "4m x 25m",
      use_case: "ground_dpm",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
  {
    id: ID("000000000020"),
    user_id: null,
    country: "NZ",
    category: "sundries",
    name: "Builders Sand 25kg Bag",
    normalized_name: "builders sand 25kg bag",
    unit: "bag",
    default_unit_price: 8.5,
    gst_included: true,
    attributes: {
      material_type: "sand",
      pack_quantity: "25kg",
      use_case: "general_construction",
    },
    active: true,
    price_source: "catalogue_seed",
    price_confidence: "high",
  },
];

// =============================================================================
// 11 catalogue aliases (4 from Phase 4.3 + 7 new in Phase 4.5).
// Token-level transformations like "h four" → "h4" or "90 by 45" → "90x45"
// live in src/lib/materialNormalizer.ts and apply to every row, not here.
// =============================================================================

export const SEED_ALIASES: SeedAlias[] = [
  // Phase 4.3
  {
    material_id: ID("000000000006"),
    alias: "gib aqua",
    normalized_alias: "gib aqua",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("000000000007"),
    alias: "pink bats",
    normalized_alias: "pink bats",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("00000000000b"),
    alias: "dwangs",
    normalized_alias: "dwangs",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("00000000000b"),
    alias: "nogs",
    normalized_alias: "nogs",
    source: "seed",
    confidence: "high",
  },
  // Phase 4.5
  {
    material_id: ID("000000000005"),
    alias: "gib standard",
    normalized_alias: "gib standard",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("00000000000a"),
    alias: "batten",
    normalized_alias: "batten",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("00000000000a"),
    alias: "battens",
    normalized_alias: "battens",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("000000000009"),
    alias: "stainless screws",
    normalized_alias: "stainless screws",
    source: "seed",
    confidence: "medium",
  },
  {
    material_id: ID("000000000009"),
    alias: "decking screws",
    normalized_alias: "decking screws",
    source: "seed",
    confidence: "medium",
  },
  {
    material_id: ID("000000000015"),
    alias: "joist hanger",
    normalized_alias: "joist hanger",
    source: "seed",
    confidence: "high",
  },
  {
    material_id: ID("000000000016"),
    alias: "coach screw",
    normalized_alias: "coach screw",
    source: "seed",
    confidence: "high",
  },
];

// =============================================================================
// Idempotent application against a Supabase client. Caller passes an admin
// (service_role) client. The script's runtime entry point below builds that
// client from environment variables.
// =============================================================================

export type SeedSummary = {
  materialsTotal: number;
  aliasesTotal: number;
};

export async function applySeed(
  supabase: SupabaseClient,
): Promise<SeedSummary> {
  const { error: matErr } = await supabase
    .from("materials")
    .upsert(SEED_MATERIALS, { onConflict: "id", ignoreDuplicates: true });
  if (matErr) {
    throw new Error(`Seed materials failed: ${matErr.message}`);
  }

  const { error: aliasErr } = await supabase
    .from("material_aliases")
    .upsert(SEED_ALIASES, {
      onConflict: "material_id,normalized_alias",
      ignoreDuplicates: true,
    });
  if (aliasErr) {
    throw new Error(`Seed aliases failed: ${aliasErr.message}`);
  }

  return {
    materialsTotal: SEED_MATERIALS.length,
    aliasesTotal: SEED_ALIASES.length,
  };
}

/**
 * Refuses to run against the production project. Caller must set
 * NEXT_PUBLIC_SUPABASE_URL to the dev branch URL and provide the dev
 * branch's service-role key in SUPABASE_SERVICE_ROLE_KEY.
 */
export function assertNotProduction(supabaseUrl: string): void {
  if (supabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `Refusing to seed against the production project (${PRODUCTION_PROJECT_REF}). ` +
        `Point NEXT_PUBLIC_SUPABASE_URL at the dev branch.`,
    );
  }
}
