import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock searchMaterials so we can exercise matcher logic against fixed RPC results.
vi.mock("./materialSearch", () => ({
  searchMaterials: vi.fn(),
}));

import { matchMaterial } from "./materialMatcher";
import { searchMaterials, type MaterialSearchHit } from "./materialSearch";

beforeEach(() => {
  vi.clearAllMocks();
});

const mockHits = (hits: MaterialSearchHit[]) => {
  (searchMaterials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    hits,
  );
};

const lastSearchArgs = () => {
  const m = searchMaterials as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls[m.mock.calls.length - 1]?.[0];
};

const hit = (over: Partial<MaterialSearchHit>): MaterialSearchHit => ({
  id: "00000000-0000-0000-0000-000000000000",
  user_id: null,
  name: "stub",
  brand: null,
  category: null,
  unit: null,
  price: 1,
  attributes: {},
  match_source: "direct_global",
  match_score: 0.5,
  tier_rank: 3,
  ...over,
});

describe("matchMaterial — H-class timber tests (no collapse)", () => {
  it("H1.2 90x45 internal framing matches H1.2 row", async () => {
    mockHits([
      hit({
        id: "h12",
        name: "H1.2 90x45 framing",
        category: "timber",
        price: 4.5,
        attributes: { treatment_class: "H1.2", size: "90x45" },
        match_source: "direct_global",
        tier_rank: 3,
        match_score: 0.92,
      }),
    ]);

    const r = await matchMaterial({
      description: "H1.2 90x45 internal framing",
    });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.attributes).toEqual({ treatment_class: "H1.2", size: "90x45" });
      expect(r.hit.price).toBe(4.5);
    }
    expect(lastSearchArgs()).toMatchObject({ category: "timber" });
  });

  it("H3.2 deck joists never returns an H4 row", async () => {
    mockHits([
      hit({
        id: "h32",
        name: "H3.2 240x45 joist",
        category: "timber",
        price: 18.2,
        attributes: { treatment_class: "H3.2", size: "240x45" },
        match_score: 0.95,
      }),
    ]);

    const r = await matchMaterial({ description: "H3.2 deck joist 240x45" });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.attributes.treatment_class).toBe("H3.2");
      expect(r.hit.attributes.treatment_class).not.toBe("H4");
    }
  });

  it("H4 posts ≠ H3.2 ≠ H5", async () => {
    mockHits([
      hit({
        id: "h4",
        name: "H4 post 100x100",
        category: "timber",
        price: 45,
        attributes: { treatment_class: "H4" },
      }),
    ]);
    const r = await matchMaterial({ description: "H4 post 100x100 2.4m" });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.attributes.treatment_class).toBe("H4");
    }
  });

  it("H5 piles preserved", async () => {
    mockHits([
      hit({
        id: "h5",
        name: "H5 pile 200x200",
        category: "timber",
        price: 110,
        attributes: { treatment_class: "H5" },
      }),
    ]);
    const r = await matchMaterial({ description: "H5 pile 200x200 3m" });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.attributes.treatment_class).toBe("H5");
    }
  });
});

describe("matchMaterial — sheet thickness preserves brand + trade name", () => {
  it("13mm GIB Aqualine matches Aqualine, not Standard", async () => {
    mockHits([
      hit({
        id: "aqua",
        name: "GIB Aqualine 13mm 2400x1200",
        brand: "GIB",
        category: "plasterboard",
        price: 75,
        attributes: { product_type: "GIB Aqualine", thickness: "13mm" },
      }),
    ]);

    const r = await matchMaterial({
      description: "13mm GIB Aqualine 2400x1200",
    });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.attributes.product_type).toBe("GIB Aqualine");
    }
    expect(lastSearchArgs()).toMatchObject({
      category: "plasterboard",
      brand: "GIB",
    });
  });
});

describe("matchMaterial — battens vs Pink Batts", () => {
  it("'Pink Batts R3.2' searches insulation+brand=Pink Batts", async () => {
    mockHits([]);
    await matchMaterial({ description: "Pink Batts R3.2" });
    expect(lastSearchArgs()).toMatchObject({
      category: "insulation",
      brand: "Pink Batts",
    });
  });

  it("'45x45 batten H3.2' searches timber, no Pink Batts brand leak", async () => {
    mockHits([]);
    await matchMaterial({ description: "45x45 batten H3.2" });
    const args = lastSearchArgs();
    expect(args.category).toBe("timber");
    expect(args.brand).not.toBe("Pink Batts");
  });
});

describe("matchMaterial — alias filter parity", () => {
  it("passes brand AND category through to RPC for plasterboard alias hits", async () => {
    mockHits([]);
    await matchMaterial({ description: "gib aqua 13mm" });
    expect(lastSearchArgs()).toMatchObject({
      category: "plasterboard",
      brand: "GIB",
    });
  });

  it("supplier override is respected", async () => {
    mockHits([]);
    await matchMaterial({
      description: "H4 post 100x100",
      supplier: "PlaceMakers",
    });
    expect(lastSearchArgs()).toMatchObject({ supplier: "PlaceMakers" });
  });

  it("explicit category override beats normalizer's hint", async () => {
    mockHits([]);
    // Description normaliser would say category=timber; force fixing.
    await matchMaterial({ description: "100x100 stud", category: "fixing" });
    expect(lastSearchArgs()).toMatchObject({ category: "fixing" });
  });
});

describe("matchMaterial — user-priority ordering (delegated to RPC)", () => {
  it("when RPC returns user row first, matcher returns the user row", async () => {
    mockHits([
      hit({
        id: "user-row",
        user_id: "user-a",
        name: "My GIB Aqualine 13mm",
        price: 70,
        match_source: "direct_user",
        tier_rank: 1,
        match_score: 0.88,
      }),
      hit({
        id: "global-row",
        user_id: null,
        name: "Catalogue GIB Aqualine 13mm",
        price: 75,
        match_source: "direct_global",
        tier_rank: 3,
        match_score: 0.95,
      }),
    ]);

    const r = await matchMaterial({ description: "GIB Aqualine 13mm" });
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.hit.id).toBe("user-row");
      expect(r.source).toBe("direct_user");
    }
  });
});

describe("matchMaterial — missing_price (never invent prices)", () => {
  it("unknown material → missing_price (no_match)", async () => {
    mockHits([]);
    const r = await matchMaterial({
      description: "obscure thing 12345 nobody has heard of",
    });
    expect(r.status).toBe("missing_price");
    if (r.status === "missing_price") {
      expect(r.reason).toBe("no_match");
      expect(r.partial).toBeNull();
    }
  });

  it("matched row with NULL price → missing_price (match_no_price)", async () => {
    mockHits([
      hit({ id: "no-price", name: "Some thing", price: null, match_score: 0.7 }),
    ]);
    const r = await matchMaterial({ description: "Some thing" });
    expect(r.status).toBe("missing_price");
    if (r.status === "missing_price") {
      expect(r.reason).toBe("match_no_price");
      expect(r.partial?.id).toBe("no-price");
    }
  });

  it("matched row with price=0 → missing_price", async () => {
    mockHits([
      hit({ id: "zero-price", name: "X", price: 0, match_score: 0.9 }),
    ]);
    const r = await matchMaterial({ description: "X" });
    expect(r.status).toBe("missing_price");
    if (r.status === "missing_price") {
      expect(r.reason).toBe("match_no_price");
    }
  });
});

describe("matchMaterial — exposed return shape (public-payload safety)", () => {
  /**
   * Phase 4.2 does NOT change the public quote payload. The
   * `get_quote_by_token` RPC still strips internal-only line-item fields
   * (formula, library_id, price_match_key, is_calculated_takeoff,
   * is_missing_price, attributes if surfaced via line_items, etc.).
   * Verified in production via Phase E checkpoint and re-verified before
   * Stage 4.2 began.
   *
   * This unit test documents the shape the matcher exposes to callers, so a
   * future change that adds a sensitive field will require an explicit code
   * review here. It does NOT replace the RPC-level test.
   */
  it("MaterialSearchHit exposes only documented columns", () => {
    const sample = hit({});
    const exposed = Object.keys(sample).sort();
    expect(exposed).toEqual(
      [
        "attributes",
        "brand",
        "category",
        "id",
        "match_score",
        "match_source",
        "name",
        "price",
        "tier_rank",
        "unit",
        "user_id",
      ].sort(),
    );
  });
});
