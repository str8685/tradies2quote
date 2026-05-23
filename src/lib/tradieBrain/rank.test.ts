import { describe, expect, it } from "vitest";
import { selectRelevant } from "./rank";
import type { MemoryType, TradieMemory } from "./types";

const NOW = Date.parse("2026-05-23T00:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

let seq = 0;
function mem(p: Partial<TradieMemory> & { memory_type: MemoryType; memory_key: string }): TradieMemory {
  seq += 1;
  return {
    id: `m${seq}`,
    user_id: "u1",
    value: {},
    strength: 1,
    source: "manual_pref",
    provenance: {},
    status: "active",
    first_seen_at: daysAgo(10),
    last_seen_at: daysAgo(10),
    last_used_at: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
    ...p,
  };
}

describe("selectRelevant — surface filtering", () => {
  it("drops memory types that don't belong to the surface", () => {
    const memories = [
      mem({ memory_type: "tone_preference", memory_key: "friendly" }),
      mem({ memory_type: "preferred_material", memory_key: "90x45 framing" }),
    ];
    const out = selectRelevant(
      memories,
      { surface: "material_price_suggestion" },
      NOW,
    );
    expect(out.map((m) => m.memory_type)).toEqual(["preferred_material"]);
  });

  it("treats all types as eligible when no surface is given", () => {
    const memories = [
      mem({ memory_type: "tone_preference", memory_key: "friendly" }),
      mem({ memory_type: "preferred_material", memory_key: "90x45 framing" }),
    ];
    const out = selectRelevant(memories, {}, NOW);
    expect(out).toHaveLength(2);
  });
});

describe("selectRelevant — retrieval by job type", () => {
  it("ranks the matching job_type_preference above the others", () => {
    const memories = [
      mem({ memory_type: "job_type_preference", memory_key: "bathroom", strength: 5 }),
      mem({ memory_type: "job_type_preference", memory_key: "deck", strength: 2 }),
    ];
    const out = selectRelevant(memories, { jobType: "Deck" }, NOW);
    expect(out[0].memory_key).toBe("deck");
  });
});

describe("selectRelevant — retrieval by material line", () => {
  it("keeps only material memories that overlap a line description", () => {
    const memories = [
      mem({ memory_type: "preferred_material", memory_key: "90x45 h3 2 framing" }),
      mem({ memory_type: "preferred_material", memory_key: "gib aqualine 13mm" }),
    ];
    const out = selectRelevant(
      memories,
      {
        surface: "material_price_suggestion",
        materialDescriptions: ["90x45 H3.2 framing timber"],
      },
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].memory_key).toBe("90x45 h3 2 framing");
  });
});

describe("selectRelevant — recency + strength", () => {
  it("ranks recent accepted behaviour above older generic history", () => {
    const stale = mem({
      memory_type: "preferred_material",
      memory_key: "old decking",
      strength: 3,
      last_seen_at: daysAgo(400),
    });
    const fresh = mem({
      memory_type: "preferred_material",
      memory_key: "new decking",
      strength: 3,
      last_seen_at: daysAgo(1),
    });
    const out = selectRelevant([stale, fresh], {}, NOW);
    expect(out[0].memory_key).toBe("new decking");
  });

  it("respects the limit", () => {
    const memories = Array.from({ length: 20 }, (_, i) =>
      mem({ memory_type: "preferred_material", memory_key: `mat ${i}` }),
    );
    expect(selectRelevant(memories, { limit: 5 }, NOW)).toHaveLength(5);
  });

  it("derives confidence from strength on the way out", () => {
    const out = selectRelevant(
      [mem({ memory_type: "pricing_habit", memory_key: "markup", strength: 4 })],
      {},
      NOW,
    );
    expect(out[0].confidence).toBe("high");
  });

  it("ignores archived memories", () => {
    const out = selectRelevant(
      [
        mem({
          memory_type: "preferred_material",
          memory_key: "archived one",
          status: "archived",
        }),
      ],
      {},
      NOW,
    );
    expect(out).toEqual([]);
  });
});
