import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readMemories, markUsed, writeMemories } from "./store";
import type { MemoryObservation } from "./types";

// ── Minimal chainable Supabase mock ───────────────────────────────────────
// Records every operation (kind + filters + payload) so tests can assert that
// EVERY query is pinned to the caller's user_id (the no-leakage guarantee),
// and resolves to configurable data/errors.

type Filter = [op: "eq" | "in", col: string, val: unknown];
type Recorded = {
  table: string;
  kind: "select" | "update" | "insert" | "delete";
  payload?: unknown;
  filters: Filter[];
};

function makeClient(cfg: {
  selectData?: unknown[];
  failInsert?: boolean;
  failUpdate?: boolean;
  failSelect?: boolean;
} = {}) {
  const calls: Recorded[] = [];

  function builder(rec: Recorded) {
    const result = () => {
      if (rec.kind === "select") {
        return cfg.failSelect
          ? { data: null, error: { message: "boom" } }
          : { data: cfg.selectData ?? [], error: null };
      }
      if (rec.kind === "insert") {
        return cfg.failInsert
          ? { data: null, error: { message: "boom" } }
          : { data: null, error: null };
      }
      if (rec.kind === "update") {
        return cfg.failUpdate
          ? { data: null, error: { message: "boom" } }
          : { data: null, error: null };
      }
      return { data: null, error: null };
    };
    const chain = {
      select(_c?: string) {
        rec.kind = "select";
        return chain;
      },
      update(payload: unknown) {
        rec.kind = "update";
        rec.payload = payload;
        return chain;
      },
      insert(payload: unknown) {
        rec.kind = "insert";
        rec.payload = payload;
        return chain;
      },
      delete() {
        rec.kind = "delete";
        return chain;
      },
      eq(col: string, val: unknown) {
        rec.filters.push(["eq", col, val]);
        return chain;
      },
      in(col: string, val: unknown) {
        rec.filters.push(["in", col, val]);
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(result()).then(onF, onR);
      },
    };
    return chain;
  }

  const client = {
    from(table: string) {
      const rec: Recorded = { table, kind: "select", filters: [] };
      calls.push(rec);
      return builder(rec);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function hasUserFilter(rec: Recorded, userId: string): boolean {
  return rec.filters.some(
    ([op, col, val]) => op === "eq" && col === "user_id" && val === userId,
  );
}

const matObs: MemoryObservation = {
  type: "preferred_material",
  key: "90x45 framing",
  value: { name: "90x45 framing", unit: "LM", unit_price: 6.5 },
  source: "manual_pref",
};

describe("writeMemories", () => {
  it("inserts a brand-new fact pinned to the caller's user_id", async () => {
    const { client, calls } = makeClient({ selectData: [] });
    const res = await writeMemories(client, "u1", [matObs]);
    expect(res).toEqual({ written: 1, failed: 0 });

    const insert = calls.find((c) => c.kind === "insert");
    expect(insert).toBeDefined();
    expect((insert!.payload as { user_id: string }).user_id).toBe("u1");
  });

  it("consolidates an existing fact (UPDATE strength+1, no INSERT)", async () => {
    const { client, calls } = makeClient({
      selectData: [
        {
          id: "row1",
          memory_type: "preferred_material",
          memory_key: "90x45 framing",
          strength: 2,
          value: {},
        },
      ],
    });
    const res = await writeMemories(client, "u1", [matObs]);
    expect(res).toEqual({ written: 1, failed: 0 });

    expect(calls.some((c) => c.kind === "insert")).toBe(false);
    const update = calls.find((c) => c.kind === "update")!;
    expect((update.payload as { strength: number }).strength).toBe(3);
    // update is scoped to BOTH the row id and the user
    expect(update.filters).toContainEqual(["eq", "id", "row1"]);
    expect(hasUserFilter(update, "u1")).toBe(true);
  });

  it("never leaks across users — every query pins user_id", async () => {
    const { client, calls } = makeClient({ selectData: [] });
    await writeMemories(client, "u1", [matObs]);
    const reads = calls.filter((c) => c.kind === "select");
    expect(reads.length).toBeGreaterThan(0);
    for (const r of reads) expect(hasUserFilter(r, "u1")).toBe(true);
    // the insert carries user_id in its payload (RLS WITH CHECK enforces it)
    const insert = calls.find((c) => c.kind === "insert")!;
    expect((insert.payload as { user_id: string }).user_id).toBe("u1");
  });

  it("soft-fails (counts, never throws) when a write errors", async () => {
    const { client } = makeClient({ selectData: [], failInsert: true });
    const res = await writeMemories(client, "u1", [matObs]);
    expect(res).toEqual({ written: 0, failed: 1 });
  });

  it("collapses duplicate keys within one batch into a single write", async () => {
    const { client, calls } = makeClient({ selectData: [] });
    const res = await writeMemories(client, "u1", [
      matObs,
      { ...matObs, value: { ...matObs.value, unit_price: 7.0 } },
    ]);
    expect(res).toEqual({ written: 1, failed: 0 });
    expect(calls.filter((c) => c.kind === "insert")).toHaveLength(1);
  });

  it("returns zero for empty input or missing user", async () => {
    const { client } = makeClient();
    expect(await writeMemories(client, "", [matObs])).toEqual({ written: 0, failed: 0 });
    expect(await writeMemories(client, "u1", [])).toEqual({ written: 0, failed: 0 });
  });
});

describe("readMemories", () => {
  it("reads active memories scoped to the user", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const { client, calls } = makeClient({ selectData: rows });
    const out = await readMemories(client, "u1");
    expect(out).toEqual(rows);
    const read = calls.find((c) => c.kind === "select")!;
    expect(hasUserFilter(read, "u1")).toBe(true);
    expect(read.filters).toContainEqual(["eq", "status", "active"]);
  });

  it("returns [] (never throws) on error", async () => {
    const { client } = makeClient({ failSelect: true });
    expect(await readMemories(client, "u1")).toEqual([]);
  });
});

describe("markUsed", () => {
  it("stamps last_used_at scoped to user + ids, best-effort", async () => {
    const { client, calls } = makeClient();
    await markUsed(client, "u1", ["a", "b"]);
    const upd = calls.find((c) => c.kind === "update")!;
    expect(hasUserFilter(upd, "u1")).toBe(true);
    expect(upd.filters).toContainEqual(["in", "id", ["a", "b"]]);
  });

  it("no-ops on empty ids", async () => {
    const { client, calls } = makeClient();
    await markUsed(client, "u1", []);
    expect(calls).toHaveLength(0);
  });
});

describe("console noise", () => {
  it("does not blow up the test reporter on soft failures", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = makeClient({ failSelect: true, failInsert: true });
    await writeMemories(client, "u1", [matObs]);
    spy.mockRestore();
    expect(true).toBe(true);
  });
});
