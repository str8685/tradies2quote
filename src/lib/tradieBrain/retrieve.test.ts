import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRelevantMemories } from "./retrieve";
import type { MemoryType, TradieMemory } from "./types";

type Recorded = { kind: "select" | "update"; filters: Array<[string, string, unknown]> };

const NOW = new Date().toISOString();
let n = 0;
function row(p: Partial<TradieMemory> & { memory_type: MemoryType; memory_key: string }): TradieMemory {
  n += 1;
  return {
    id: `m${n}`,
    user_id: "u1",
    value: {},
    strength: 1,
    source: "manual_pref",
    provenance: {},
    status: "active",
    first_seen_at: NOW,
    last_seen_at: NOW,
    last_used_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...p,
  };
}

function makeClient(rows: TradieMemory[]) {
  const calls: Recorded[] = [];
  function chainFor(rec: Recorded) {
    const chain = {
      select() {
        rec.kind = "select";
        return chain;
      },
      update() {
        rec.kind = "update";
        return chain;
      },
      eq(c: string, v: unknown) {
        rec.filters.push(["eq", c, v]);
        return chain;
      },
      in(c: string, v: unknown) {
        rec.filters.push(["in", c, v]);
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      then(onF: (v: unknown) => unknown) {
        const data = rec.kind === "select" ? rows : null;
        return Promise.resolve({ data, error: null }).then(onF);
      },
    };
    return chain;
  }
  const client = {
    from() {
      const rec: Recorded = { kind: "select", filters: [] };
      calls.push(rec);
      return chainFor(rec);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("getRelevantMemories", () => {
  it("reads, ranks for the surface, and returns ranked memories", async () => {
    const { client } = makeClient([
      row({ memory_type: "preferred_material", memory_key: "90x45 framing" }),
      row({ memory_type: "tone_preference", memory_key: "friendly" }),
    ]);
    const out = await getRelevantMemories(client, "u1", {
      surface: "material_price_suggestion",
      materialDescriptions: ["90x45 framing"],
    });
    // tone_preference is irrelevant to a price suggestion → dropped
    expect(out.map((m) => m.memory_type)).toEqual(["preferred_material"]);
    expect(out[0].confidence).toBeDefined();
  });

  it("stamps last_used_at only when asked", async () => {
    const { client, calls } = makeClient([
      row({ memory_type: "preferred_material", memory_key: "90x45 framing" }),
    ]);
    await getRelevantMemories(client, "u1", {}, { markUsed: true });
    expect(calls.some((c) => c.kind === "update")).toBe(true);
  });

  it("returns [] for a missing user without touching the DB", async () => {
    const { client, calls } = makeClient([]);
    expect(await getRelevantMemories(client, "")).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
