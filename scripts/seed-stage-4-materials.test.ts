import { describe, it, expect, vi } from "vitest";
import {
  SEED_MATERIALS,
  SEED_ALIASES,
  applySeed,
  assertNotProduction,
} from "./seed-stage-4-materials";

describe("Stage 4 dev seed — data integrity", () => {
  it("contains 25–40 materials (spec: small dev catalogue)", () => {
    expect(SEED_MATERIALS.length).toBeGreaterThanOrEqual(25);
    expect(SEED_MATERIALS.length).toBeLessThanOrEqual(40);
  });

  it("every material has a unique deterministic UUID", () => {
    const ids = SEED_MATERIALS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it("every material is a global row (user_id IS NULL)", () => {
    for (const m of SEED_MATERIALS) {
      expect(m.user_id).toBeNull();
    }
  });

  it("every material declares NZ country and active=true", () => {
    for (const m of SEED_MATERIALS) {
      expect(m.country).toBe("NZ");
      expect(m.active).toBe(true);
    }
  });

  it("every material has price_source='catalogue_seed'", () => {
    for (const m of SEED_MATERIALS) {
      expect(m.price_source).toBe("catalogue_seed");
    }
  });

  it("every material has price_confidence set", () => {
    for (const m of SEED_MATERIALS) {
      expect(["high", "medium", "low"]).toContain(m.price_confidence);
    }
  });

  it("every material has a non-empty attributes object", () => {
    for (const m of SEED_MATERIALS) {
      expect(typeof m.attributes).toBe("object");
      expect(Object.keys(m.attributes).length).toBeGreaterThan(0);
    }
  });

  it("category coverage includes all 11 spec categories", () => {
    const categories = new Set(SEED_MATERIALS.map((m) => m.category));
    // Spec asked for: timber, plasterboard, insulation, decking, fixings,
    // concrete, cladding, roofing, paint, hardware, sundries.
    // Decking is bucketed under timber category in our schema (timber +
    // use_case='decking' attribute) per NZ supplier convention.
    expect(categories).toContain("timber");
    expect(categories).toContain("plasterboard");
    expect(categories).toContain("insulation");
    expect(categories).toContain("fixing");
    expect(categories).toContain("concrete");
    expect(categories).toContain("cladding");
    expect(categories).toContain("roofing");
    expect(categories).toContain("paint");
    expect(categories).toContain("hardware");
    expect(categories).toContain("sundries");
  });

  it("H-class treatments are preserved exactly (no collapse)", () => {
    const h12 = SEED_MATERIALS.filter(
      (m) => m.attributes.treatment_class === "H1.2",
    );
    const h32 = SEED_MATERIALS.filter(
      (m) => m.attributes.treatment_class === "H3.2",
    );
    const h4 = SEED_MATERIALS.filter(
      (m) => m.attributes.treatment_class === "H4",
    );
    const h5 = SEED_MATERIALS.filter(
      (m) => m.attributes.treatment_class === "H5",
    );
    expect(h12.length).toBeGreaterThan(0);
    expect(h32.length).toBeGreaterThan(0);
    expect(h4.length).toBeGreaterThan(0);
    expect(h5.length).toBeGreaterThan(0);
  });

  it("Pink Batts is insulation, not timber (battens vs Pink Batts)", () => {
    const pinkBatts = SEED_MATERIALS.filter((m) => m.brand === "Pink Batts");
    expect(pinkBatts.length).toBeGreaterThan(0);
    for (const row of pinkBatts) {
      expect(row.category).toBe("insulation");
    }
    const battens = SEED_MATERIALS.filter((m) =>
      m.name.toLowerCase().includes("batten"),
    );
    for (const row of battens) {
      expect(row.category).toBe("timber");
      expect(row.brand).not.toBe("Pink Batts");
    }
  });

  it("GIB Aqualine and GIB Standard are distinct rows with distinct attributes.product_type", () => {
    const aqua = SEED_MATERIALS.find(
      (m) => m.attributes.product_type === "GIB Aqualine",
    );
    const std = SEED_MATERIALS.find(
      (m) => m.attributes.product_type === "GIB Standard",
    );
    expect(aqua).toBeDefined();
    expect(std).toBeDefined();
    expect(aqua?.id).not.toBe(std?.id);
  });
});

describe("Stage 4 dev seed — alias integrity", () => {
  it("every alias references a material that exists in SEED_MATERIALS", () => {
    const ids = new Set(SEED_MATERIALS.map((m) => m.id));
    for (const a of SEED_ALIASES) {
      expect(ids.has(a.material_id)).toBe(true);
    }
  });

  it("(material_id, normalized_alias) pairs are unique (UNIQUE constraint guard)", () => {
    const seen = new Set<string>();
    for (const a of SEED_ALIASES) {
      const key = `${a.material_id}::${a.normalized_alias}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("aliases use source='seed'", () => {
    for (const a of SEED_ALIASES) {
      expect(a.source).toBe("seed");
    }
  });

  it("normalized_alias is lowercase trimmed", () => {
    for (const a of SEED_ALIASES) {
      expect(a.normalized_alias).toBe(a.normalized_alias.toLowerCase().trim());
    }
  });

  it("includes the spec-required aliases", () => {
    const aliases = new Set(SEED_ALIASES.map((a) => a.normalized_alias));
    expect(aliases).toContain("gib aqua");
    expect(aliases).toContain("gib standard");
    expect(aliases).toContain("pink bats");
    expect(aliases).toContain("dwangs");
    expect(aliases).toContain("nogs");
    expect(aliases).toContain("batten");
    expect(aliases).toContain("battens");
    expect(aliases).toContain("stainless screws");
    expect(aliases).toContain("decking screws");
  });

  it("'gib aqua' alias points at the GIB Aqualine row", () => {
    const aqua = SEED_MATERIALS.find(
      (m) => m.attributes.product_type === "GIB Aqualine",
    )!;
    const alias = SEED_ALIASES.find((a) => a.normalized_alias === "gib aqua");
    expect(alias?.material_id).toBe(aqua.id);
  });

  it("'pink bats' alias points at a Pink Batts row, not at any timber batten row", () => {
    const alias = SEED_ALIASES.find((a) => a.normalized_alias === "pink bats");
    const target = SEED_MATERIALS.find((m) => m.id === alias?.material_id);
    expect(target?.brand).toBe("Pink Batts");
    expect(target?.category).toBe("insulation");
  });

  it("'battens' alias points at the timber batten row, NOT Pink Batts", () => {
    const alias = SEED_ALIASES.find((a) => a.normalized_alias === "battens");
    const target = SEED_MATERIALS.find((m) => m.id === alias?.material_id);
    expect(target?.category).toBe("timber");
    expect(target?.brand).not.toBe("Pink Batts");
  });

  it("'dwangs' and 'nogs' both point at the same nogs/dwangs row", () => {
    const dwangs = SEED_ALIASES.find((a) => a.normalized_alias === "dwangs");
    const nogs = SEED_ALIASES.find((a) => a.normalized_alias === "nogs");
    expect(dwangs?.material_id).toBe(nogs?.material_id);
    const target = SEED_MATERIALS.find((m) => m.id === dwangs?.material_id);
    expect(target?.attributes.use_case).toBe("nogs_dwangs");
  });
});

describe("Stage 4 dev seed — applySeed (idempotency proxy)", () => {
  // The actual idempotency comes from Postgres (ON CONFLICT DO NOTHING). The
  // applySeed function passes ignoreDuplicates: true to upsert. These tests
  // verify the function uses the right options so re-runs don't error.

  function mockSupabase() {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn(() => ({ upsert }));
    return { supabase: { from: fromMock } as never, upsert, fromMock };
  }

  it("calls supabase.from('materials').upsert with ignoreDuplicates and onConflict='id'", async () => {
    const { supabase, upsert, fromMock } = mockSupabase();
    await applySeed(supabase);
    expect(fromMock).toHaveBeenCalledWith("materials");
    expect(upsert).toHaveBeenCalledWith(
      SEED_MATERIALS,
      expect.objectContaining({ onConflict: "id", ignoreDuplicates: true }),
    );
  });

  it("calls supabase.from('material_aliases').upsert with ignoreDuplicates and the composite key", async () => {
    const { supabase, upsert, fromMock } = mockSupabase();
    await applySeed(supabase);
    expect(fromMock).toHaveBeenCalledWith("material_aliases");
    expect(upsert).toHaveBeenCalledWith(
      SEED_ALIASES,
      expect.objectContaining({
        onConflict: "material_id,normalized_alias",
        ignoreDuplicates: true,
      }),
    );
  });

  it("returns the seed counts on success", async () => {
    const { supabase } = mockSupabase();
    const summary = await applySeed(supabase);
    expect(summary).toEqual({
      materialsTotal: SEED_MATERIALS.length,
      aliasesTotal: SEED_ALIASES.length,
    });
  });

  it("throws a typed error when materials upsert fails", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "materials") {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: { message: "permission denied" },
          }),
        };
      }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    });
    await expect(applySeed({ from: fromMock } as never)).rejects.toThrow(
      /Seed materials failed: permission denied/,
    );
  });

  it("throws a typed error when aliases upsert fails", async () => {
    const fromMock = vi.fn((table: string) => ({
      upsert: vi.fn().mockResolvedValue({
        error: table === "material_aliases" ? { message: "FK violation" } : null,
      }),
    }));
    await expect(applySeed({ from: fromMock } as never)).rejects.toThrow(
      /Seed aliases failed: FK violation/,
    );
  });
});

describe("Stage 4 dev seed — production safety", () => {
  it("assertNotProduction throws if URL contains the production project ref", () => {
    expect(() =>
      assertNotProduction("https://guiovuqccbzlbacaxepd.supabase.co"),
    ).toThrow(/Refusing to seed against the production project/);
  });

  it("assertNotProduction allows other URLs (dev branch)", () => {
    expect(() =>
      assertNotProduction("https://wkspwsorlgwkuwjajsce.supabase.co"),
    ).not.toThrow();
  });
});
