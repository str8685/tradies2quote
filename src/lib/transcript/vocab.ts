import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteData } from "../quote-types";
import {
  GLOBAL_GLOSSARY,
  type VocabEntry,
  type VocabSet,
  type VocabSource,
  type VocabTermType,
} from "./glossary";

// ─────────────────────────────────────────────────────────────────────────
// Transcript vocabulary assembly.
//
// `buildVocabSet` (pure) merges the curated global glossary with a user's own
// terms (materials library, suppliers they buy from, Tradie Brain memories,
// recent quote line descriptions) into one deduped, capped VocabSet.
//
// `loadUserVocab` (I/O) gathers those sources from Supabase. It NEVER throws —
// on any failure it degrades to at least the global glossary, so transcription
// and cleanup keep working.
// ─────────────────────────────────────────────────────────────────────────

/** Total entry cap — keeps correction + hint building fast. */
const MAX_ENTRIES = 600;
/** Per-source caps so one big library can't crowd out the global terms. */
const MAX_MATERIALS = 300;
const MAX_RECENT_QUOTES = 10;

function lc(s: string): string {
  return s.trim().toLowerCase();
}

/** Names too short / generic to be useful (and risky) as vocab. */
function usableTerm(name: string): boolean {
  const t = name.trim();
  return t.length >= 3 && /[a-z]/i.test(t);
}

export type VocabSourceInput = {
  /** Curated global glossary (defaults to GLOBAL_GLOSSARY). */
  global?: VocabEntry[];
  /** Distinct supplier names the user buys from. */
  supplierNames?: string[];
  /** Material names from the user's library. */
  materialNames?: string[];
  /** Terms surfaced from the user's history (Tradie Brain, recent quotes). */
  userHistoryTerms?: Array<{ name: string; type?: VocabTermType }>;
};

function makeEntry(
  canonical: string,
  type: VocabTermType,
  source: VocabSource,
): VocabEntry {
  // The canonical (lowercased) is its own alias so an exact case-insensitive
  // hit normalises casing; we don't synthesise speculative aliases for
  // user-derived terms (that would risk wrong rewrites).
  return { canonical, aliases: [lc(canonical)], type, source };
}

/**
 * Merge all sources into one VocabSet. Deduped by lowercased canonical
 * (global wins — its curated aliases are richer); per-source + total caps
 * applied. Pure.
 */
export function buildVocabSet(input: VocabSourceInput): VocabSet {
  const byCanonical = new Map<string, VocabEntry>();

  const add = (entry: VocabEntry) => {
    if (!usableTerm(entry.canonical)) return;
    const key = lc(entry.canonical);
    const existing = byCanonical.get(key);
    if (existing) {
      // Merge aliases; keep the existing (higher-priority) canonical + source.
      const aliases = new Set([...existing.aliases, ...entry.aliases]);
      existing.aliases = [...aliases];
      return;
    }
    if (byCanonical.size >= MAX_ENTRIES) return;
    byCanonical.set(key, { ...entry, aliases: [...new Set(entry.aliases)] });
  };

  // Global first so its curated entries take priority on collisions.
  for (const e of input.global ?? GLOBAL_GLOSSARY) add(e);
  for (const s of input.supplierNames ?? []) {
    if (usableTerm(s)) add(makeEntry(s.trim(), "supplier", "supplier"));
  }
  for (const m of (input.materialNames ?? []).slice(0, MAX_MATERIALS)) {
    if (usableTerm(m)) add(makeEntry(m.trim(), "material", "materials_library"));
  }
  for (const h of input.userHistoryTerms ?? []) {
    if (usableTerm(h.name)) add(makeEntry(h.name.trim(), h.type ?? "material", "user_history"));
  }

  return { entries: [...byCanonical.values()] };
}

type TradieMemoryRow = {
  memory_type: string;
  value: Record<string, unknown> | null;
};

function memoryTermType(memoryType: string): VocabTermType | null {
  if (memoryType === "preferred_material") return "material";
  if (memoryType === "preferred_brand") return "brand";
  if (memoryType === "preferred_supplier") return "supplier";
  return null;
}

/**
 * Load a user's full vocabulary from Supabase. Never throws — returns at least
 * the global glossary. `includeRecentQuotes` is off for the latency-sensitive
 * transcribe path and on for server-side cleanup.
 */
export async function loadUserVocab(
  supabase: SupabaseClient,
  userId: string,
  opts: { includeRecentQuotes?: boolean } = {},
): Promise<VocabSet> {
  if (!userId) return buildVocabSet({});

  const supplierNames = new Set<string>();
  const materialNames: string[] = [];
  const userHistoryTerms: Array<{ name: string; type?: VocabTermType }> = [];

  // Materials library — names + suppliers, most-used first.
  try {
    const { data } = await supabase
      .from("materials")
      .select("name, supplier, usage_count")
      .eq("user_id", userId)
      .order("usage_count", { ascending: false })
      .limit(MAX_MATERIALS);
    for (const row of data ?? []) {
      const name = typeof row.name === "string" ? row.name : "";
      if (name) materialNames.push(name);
      const sup = typeof row.supplier === "string" ? row.supplier : "";
      if (sup) supplierNames.add(sup);
    }
  } catch (e) {
    console.warn("[transcript-vocab] materials read failed", e);
  }

  // Tradie Brain memories — preferred materials / brands / suppliers.
  try {
    const { data } = await supabase
      .from("tradie_memories")
      .select("memory_type, value")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("memory_type", ["preferred_material", "preferred_brand", "preferred_supplier"])
      .limit(200);
    for (const row of (data ?? []) as TradieMemoryRow[]) {
      const type = memoryTermType(row.memory_type);
      if (!type) continue;
      const v = row.value ?? {};
      const name =
        typeof v.name === "string"
          ? v.name
          : typeof v.supplier === "string"
            ? v.supplier
            : "";
      if (name) userHistoryTerms.push({ name, type });
    }
  } catch (e) {
    console.warn("[transcript-vocab] memories read failed", e);
  }

  // Recent quote line descriptions — patterns not yet in the library.
  if (opts.includeRecentQuotes) {
    try {
      const { data } = await supabase
        .from("quotes")
        .select("quote_data")
        .eq("user_id", userId)
        .not("quote_data", "is", null)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_QUOTES);
      for (const row of data ?? []) {
        const qd = (row.quote_data ?? null) as QuoteData | null;
        for (const it of qd?.line_items ?? []) {
          if (it.type === "material" && typeof it.description === "string") {
            userHistoryTerms.push({ name: it.description, type: "material" });
          }
        }
      }
    } catch (e) {
      console.warn("[transcript-vocab] recent quotes read failed", e);
    }
  }

  return buildVocabSet({
    supplierNames: [...supplierNames],
    materialNames,
    userHistoryTerms,
  });
}
