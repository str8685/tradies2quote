import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "../owner";
import type { QuoteData } from "../quote-types";
import type { QuoteEditDiff } from "../quoteEditDiff";
import {
  deriveMemoriesFromQuoteSave,
  deriveMemoryFromAcceptedPrice,
} from "./derive";
import { writeMemories, type WriteResult } from "./store";

// ─────────────────────────────────────────────────────────────────────────
// Tradie Brain — ingestion entry points (server-side).
//
// v1 gating: OWNER-ONLY, NO env flag. That's the "collect silently while
// dark" decision — memories accumulate for the owner the moment this deploys,
// while staying invisible to every other user. (The TRADIE_BRAIN_ENABLED flag
// gates future AI CONSUMPTION + widening to all users, not this collection.)
//
// Every call is wrapped + soft-failing: a memory write can NEVER undo or
// block the quote save that triggered it — the same contract as
// applyMaterialCorrections.
// ─────────────────────────────────────────────────────────────────────────

type AuthUserLike = { id: string; email?: string | null };

const NOOP: WriteResult = { written: 0, failed: 0 };

/** Teach Tradie Brain from a saved quote (+ its edit diff). Owner-only. */
export async function ingestFromQuoteSave(
  supabase: SupabaseClient,
  user: AuthUserLike,
  input: { quote: QuoteData; diff?: QuoteEditDiff | null; quoteId?: string | null },
): Promise<WriteResult> {
  try {
    if (!user?.id || !isOwnerEmail(user.email)) return NOOP;
    const observations = deriveMemoriesFromQuoteSave(input);
    if (observations.length === 0) return NOOP;
    return await writeMemories(supabase, user.id, observations);
  } catch (e) {
    console.warn("[tradie-brain] ingestFromQuoteSave threw (non-fatal)", e);
    return NOOP;
  }
}

/** Teach Tradie Brain from an accepted Suggest-a-Price result. Owner-only. */
export async function ingestFromAcceptedPrice(
  supabase: SupabaseClient,
  user: AuthUserLike,
  input: { name: string; unit: string | null; price: number; quoteId?: string | null },
): Promise<WriteResult> {
  try {
    if (!user?.id || !isOwnerEmail(user.email)) return NOOP;
    const observations = deriveMemoryFromAcceptedPrice(input);
    if (observations.length === 0) return NOOP;
    return await writeMemories(supabase, user.id, observations);
  } catch (e) {
    console.warn("[tradie-brain] ingestFromAcceptedPrice threw (non-fatal)", e);
    return NOOP;
  }
}
