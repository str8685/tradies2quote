import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readMemories, markUsed } from "./store";
import { selectRelevant } from "./rank";
import type { RankedMemory, RetrievalContext } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — retrieval orchestrator (I/O).
//
// Reads the user's active memories, ranks them DETERMINISTICALLY for the given
// context (rank.ts), stamps last_used_at on what it surfaced, and returns the
// ranked list. This is the single entry point a future AI consumer would call;
// in v1 only the owner debug view uses it (to preview what a consumer would
// get). It returns CONTEXT — never an action, total, or message.
// ─────────────────────────────────────────────────────────────────────────

export async function getRelevantMemories(
  supabase: SupabaseClient,
  userId: string,
  context: RetrievalContext = {},
  opts: { markUsed?: boolean } = {},
): Promise<RankedMemory[]> {
  if (!userId) return [];
  const all = await readMemories(supabase, userId, { status: "active" });
  const ranked = selectRelevant(all, context);
  if (opts.markUsed && ranked.length > 0) {
    await markUsed(
      supabase,
      userId,
      ranked.map((m) => m.id),
    );
  }
  return ranked;
}
