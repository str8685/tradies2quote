// ─────────────────────────────────────────────────────────────────────────
// Transcript vocabulary — types + curated GLOBAL tradie glossary.
//
// The controlled dictionary the transcript cleanup uses to fix supplier /
// brand / material / trade-term spellings. Two things power a correction:
//   - `canonical`: the one true spelling we'll output.
//   - `aliases`:   known mishears / variants (matched case-insensitively).
//
// Aliases are the ONLY thing that auto-applies (high confidence — they're an
// explicit, curated mapping). Anything else is handled by fuzzy MATCHING in
// glossaryCorrect.ts, which only ever FLAGS (never silently rewrites).
//
// Clean-room note: these are facts (brand spellings, supplier names) — not
// copyrighted manual content. We never ingest supplier catalogues.
// ─────────────────────────────────────────────────────────────────────────

export type VocabTermType = "supplier" | "brand" | "material" | "trade_term";

/** Where a vocab entry came from — surfaced in the correction audit log. */
export type VocabSource =
  | "global"
  | "supplier"
  | "materials_library"
  | "user_history";

export type VocabEntry = {
  /** The canonical spelling we output. */
  canonical: string;
  /** Known mishears / variants, matched case-insensitively. */
  aliases: string[];
  type: VocabTermType;
  source: VocabSource;
};

/** A merged, ready-to-use vocabulary for one user (global + their own terms). */
export type VocabSet = {
  entries: VocabEntry[];
};

function g(
  canonical: string,
  type: VocabTermType,
  aliases: string[] = [],
): VocabEntry {
  return { canonical, aliases, type, source: "global" };
}

// ── NZ suppliers ──────────────────────────────────────────────────────────
// Aliases are MISHEARS only — never a common English word and never a bare
// surname (which could be a real client name). "item" (→ITM), "carter",
// "bowen" are deliberately excluded for that reason.
const SUPPLIERS: VocabEntry[] = [
  g("PlaceMakers", "supplier", ["place makers", "placemakers", "plate makers", "play makers"]),
  g("Mitre 10", "supplier", ["mitre ten", "mitre10", "mitre-10"]),
  g("Bunnings", "supplier", ["bunings", "bunnigs"]),
  g("ITM", "supplier", ["i.t.m"]),
  g("Carters", "supplier", ["carter's", "cartas"]),
  g("Bowens", "supplier", ["bowen's", "boans"]),
  g("Mico", "supplier", ["mico plumbing"]),
  g("Plumbing World", "supplier", ["plumbingworld"]),
  g("Tumu", "supplier", ["tumu itm"]),
  g("NZ Panels", "supplier", ["nz panels"]),
];

// ── Brands / product ranges ───────────────────────────────────────────────
// NOTE: "jib"/"gyp"→GIB and "pink bats"→Pink Batts are intentionally left to
// the CONTEXT-GUARDED regex pass in transcriptCleanup.ts (they require a
// nearby plasterboard / insulation word). The aliases here are unambiguous
// proper-noun mishears that are safe to auto-apply without context.
const BRANDS: VocabEntry[] = [
  g("GIB", "brand", ["gibb"]),
  g("James Hardie", "brand", ["james hardy", "james hardies", "hardie's"]),
  g("HardiePlank", "brand", ["hardiplank", "hardie plank", "hardy plank"]),
  g("HardieFlex", "brand", ["hardiflex", "hardie flex", "hardy flex"]),
  g("Ecoply", "brand", ["eco ply", "eco-ply"]),
  g("Triboard", "brand", ["tri board", "tri-board"]),
  g("MiTek", "brand", ["mitek"]),
  g("Resene", "brand", ["reseen", "rezene"]),
  g("Dulux", "brand", ["dewlux", "doolux"]),
  g("Marley", "brand", ["marlee"]),
  g("Coloursteel", "brand", ["colour steel", "color steel", "colorsteel"]),
  g("Colorbond", "brand", ["colour bond", "color bond"]),
  // James Hardie cladding ranges — distinctive proper nouns. Aliases are
  // unambiguous mishears only (never a real English word like "linear").
  g("Linea", "brand", ["linea weatherboard"]),
  g("Axon", "brand", ["axon panel"]),
  g("Stria", "brand", ["stria cladding"]),
  g("RAB", "brand", ["rab board"]),
  g("Shadowclad", "brand", ["shadow clad"]),
  g("Pinex", "brand", []),
  g("Customwood", "brand", ["custom wood"]),
  // Structural connectors / fixings brands.
  g("Lumberlok", "brand", ["lumber lock", "lumberlock"]),
  g("Pryda", "brand", ["prida"]),
  g("Paslode", "brand", ["pas load"]),
  // Building wrap / insulation / membranes.
  g("Tyvek", "brand", ["tie vek", "tivek"]),
  g("Thermakraft", "brand", ["therma kraft", "thermacraft"]),
  g("Expol", "brand", ["ex pol"]),
  g("Earthwool", "brand", ["earth wool"]),
  g("Knauf", "brand", []),
  // Roofing.
  g("Dimondek", "brand", ["diamond deck", "dimond deck"]),
  g("Metrotile", "brand", ["metro tile"]),
  // Sealants / adhesives.
  g("Bostik", "brand", []),
  g("Selleys", "brand", ["sellys"]),
];

// ── Common NZ trade terms ─────────────────────────────────────────────────
// Aliases are MISSPELLINGS of the SAME word form only — never a correctly
// spelled plural (mapping "studs"→"stud" would corrupt meaning), and never a
// real English word ("barer", "sprouting", "noggin"). Canonical-casing is NOT
// auto-applied for trade terms (they're lowercase words), so these power
// alias fixes + ASR hints + fuzzy flagging.
const TRADE_TERMS: VocabEntry[] = [
  g("dwang", "trade_term", ["dwong", "dwhang"]),
  g("nog", "trade_term", ["nogg"]),
  g("stud", "trade_term", []),
  g("bearer", "trade_term", []),
  g("joist", "trade_term", ["joyst", "joice"]),
  g("rafter", "trade_term", ["rafta"]),
  g("purlin", "trade_term", ["pearlin", "perlin"]),
  g("batten", "trade_term", ["batton"]),
  g("weatherboard", "trade_term", ["weather board", "wetherboard"]),
  g("fascia", "trade_term", ["facia", "fashia"]),
  g("soffit", "trade_term", ["sofit", "soffix"]),
  g("spouting", "trade_term", ["spoutin"]),
  g("macrocarpa", "trade_term", ["macro carpa", "macrocapa", "macracarpa"]),
  g("rimu", "trade_term", ["reemu"]),
  g("kwila", "trade_term", ["quila", "kwilla", "kweela"]),
  g("flashing", "trade_term", ["flashin"]),
  // Interior linings + trims — distinctive enough not to clash with common words.
  g("architrave", "trade_term", ["archi trave", "arkitrave"]),
  g("skirting", "trade_term", ["skerting"]),
  g("scotia", "trade_term", ["scocia", "scosha"]),
  g("lintel", "trade_term", ["lintol"]),
  g("villaboard", "trade_term", ["villa board"]),
  g("plasterboard", "trade_term", ["plaster board"]),
  g("particleboard", "trade_term", ["particle board"]),
  // Cladding / exterior carcass.
  g("plywood", "trade_term", ["ply wood"]),
  g("cladding", "trade_term", []),
  g("sarking", "trade_term", []),
  g("bargeboard", "trade_term", ["barge board"]),
  g("subfloor", "trade_term", ["sub floor"]),
  g("downpipe", "trade_term", ["down pipe"]),
];

/** The curated global glossary (suppliers + brands + trade terms). */
export const GLOBAL_GLOSSARY: VocabEntry[] = [
  ...SUPPLIERS,
  ...BRANDS,
  ...TRADE_TERMS,
];
