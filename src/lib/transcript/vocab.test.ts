import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVocabSet, loadUserVocab } from "./vocab";

describe("buildVocabSet", () => {
  it("merges global + user sources and tags provenance", () => {
    const set = buildVocabSet({
      supplierNames: ["Tauranga Timber Co"],
      materialNames: ["Ecoply Barrier", "Custom Batten Profile"],
      userHistoryTerms: [{ name: "Resene Lumbersider", type: "brand" }],
    });
    const byCanon = (c: string) => set.entries.find((e) => e.canonical === c);
    expect(byCanon("Tauranga Timber Co")?.source).toBe("supplier");
    expect(byCanon("Ecoply Barrier")?.source).toBe("materials_library");
    expect(byCanon("Resene Lumbersider")?.source).toBe("user_history");
    // global glossary still present
    expect(byCanon("PlaceMakers")).toBeDefined();
  });

  it("dedupes by canonical (global wins) and drops too-short terms", () => {
    const set = buildVocabSet({
      supplierNames: ["bunnings", "ab"], // "ab" too short, "bunnings" collides w/ global
      materialNames: [],
    });
    const bunnings = set.entries.filter((e) => e.canonical.toLowerCase() === "bunnings");
    expect(bunnings).toHaveLength(1);
    expect(bunnings[0].source).toBe("global"); // global kept on collision
    expect(set.entries.some((e) => e.canonical === "ab")).toBe(false);
  });
});

// ── loadUserVocab with a tiny chainable Supabase mock ──────────────────────
function makeClient(tables: {
  materials?: unknown[];
  tradie_memories?: unknown[];
  quotes?: unknown[];
}) {
  function chain(rows: unknown[] | undefined) {
    const c: Record<string, unknown> = {};
    const ret = () => c;
    c.select = ret;
    c.eq = ret;
    c.in = ret;
    c.not = ret;
    c.order = ret;
    c.limit = () => Promise.resolve({ data: rows ?? [], error: null });
    (c as { then: unknown }).then = (onF: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows ?? [], error: null }).then(onF);
    return c;
  }
  const client = {
    from(table: string) {
      return chain((tables as Record<string, unknown[]>)[table]);
    },
  };
  return client as unknown as SupabaseClient;
}

describe("loadUserVocab", () => {
  it("returns at least the global glossary for an empty user", async () => {
    const set = await loadUserVocab(makeClient({}), "u1");
    expect(set.entries.some((e) => e.canonical === "GIB")).toBe(true);
  });

  it("pulls supplier + material names and Tradie Brain terms", async () => {
    const set = await loadUserVocab(
      makeClient({
        materials: [
          { name: "Goldenedge H1.2 90x45", supplier: "Tumu", usage_count: 9 },
        ],
        tradie_memories: [
          { memory_type: "preferred_supplier", value: { supplier: "Local Yard Ltd" } },
          { memory_type: "preferred_material", value: { name: "Shadowclad" } },
        ],
      }),
      "u1",
    );
    expect(set.entries.some((e) => e.canonical === "Goldenedge H1.2 90x45")).toBe(true);
    expect(set.entries.some((e) => e.canonical === "Local Yard Ltd")).toBe(true);
    expect(set.entries.some((e) => e.canonical === "Shadowclad")).toBe(true);
  });

  it("returns global glossary (never throws) for a missing user id", async () => {
    const set = await loadUserVocab(makeClient({}), "");
    expect(set.entries.length).toBeGreaterThan(0);
  });
});
