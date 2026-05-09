import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client modules BEFORE importing the unit under test.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: vi.fn(),
}));

import { searchMaterials, type MaterialSearchHit } from "./materialSearch";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockUserClient(rpcImpl: ReturnType<typeof vi.fn>) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    rpc: rpcImpl,
  });
}

function mockAdminClient(rpcImpl: ReturnType<typeof vi.fn>) {
  (adminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    rpc: rpcImpl,
  });
}

const sampleHit: MaterialSearchHit = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: null,
  name: "GIB Aqualine 13mm 2400x1200",
  brand: "GIB",
  category: "plasterboard",
  unit: "sheet",
  price: 75,
  attributes: { product_type: "GIB Aqualine", thickness: "13mm" },
  match_source: "direct_global",
  match_score: 0.85,
  tier_rank: 3,
};

describe("searchMaterials", () => {
  it("returns [] for empty query without calling the RPC", async () => {
    const rpc = vi.fn();
    mockUserClient(rpc);

    expect(await searchMaterials({ query: "" })).toEqual([]);
    expect(await searchMaterials({ query: "   " })).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with all six parameters using safe defaults", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockUserClient(rpc);

    await searchMaterials({ query: "h4 post" });

    expect(rpc).toHaveBeenCalledWith("search_materials", {
      p_query: "h4 post",
      p_country: "NZ",
      p_category: null,
      p_brand: null,
      p_supplier: null,
      p_limit: 25,
    });
  });

  it("passes through category, brand, supplier, limit when supplied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockUserClient(rpc);

    await searchMaterials({
      query: "gib aqualine 13mm",
      category: "plasterboard",
      brand: "GIB",
      supplier: "PlaceMakers",
      limit: 10,
    });

    expect(rpc).toHaveBeenCalledWith("search_materials", {
      p_query: "gib aqualine 13mm",
      p_country: "NZ",
      p_category: "plasterboard",
      p_brand: "GIB",
      p_supplier: "PlaceMakers",
      p_limit: 10,
    });
  });

  it("returns typed hits", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [sampleHit], error: null });
    mockUserClient(rpc);

    const result = await searchMaterials({ query: "gib aqua" });
    expect(result).toEqual([sampleHit]);
    // Type narrows: callers can rely on these fields.
    expect(result[0].match_source).toBe("direct_global");
  });

  it("returns [] when RPC returns null data (e.g., zero matches)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    mockUserClient(rpc);

    expect(await searchMaterials({ query: "nothing matches" })).toEqual([]);
  });

  it("throws on RPC error with the underlying message", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "permission denied" } });
    mockUserClient(rpc);

    await expect(searchMaterials({ query: "x" })).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("uses adminClient when asAdmin: true (bypasses RLS)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockAdminClient(rpc);

    await searchMaterials({ query: "x", asAdmin: true });

    expect(adminClient).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses authenticated session when asAdmin is omitted/false", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockUserClient(rpc);

    await searchMaterials({ query: "x" });

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(adminClient).not.toHaveBeenCalled();
  });
});
