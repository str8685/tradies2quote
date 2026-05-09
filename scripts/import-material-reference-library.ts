/**
 * Stage 4.8 — Mitre 10 reference-library import.
 *
 * Imports Mitre_10_Full_Material_Catalogue.csv into the materials table on
 * the Supabase development branch ONLY. The CSV is treated as a reference
 * library for matching, aliases, and attributes — never as verified pricing.
 *
 * HARD RULES:
 *   - Est_Price from the CSV is NEVER copied to default_unit_price.
 *   - default_unit_price is NULL on every imported row.
 *   - All imported rows are tagged in attributes JSON:
 *       source       = "kimi_material_library"
 *       verified     = false
 *       is_priced    = false
 *   - price_source = 'csv_import' (existing CHECK-allowed value; semantically
 *     correct: row imported from CSV without a verified price). If you want
 *     'none' literally, relax the materials_price_source_chk constraint on
 *     the dev branch first.
 *   - On match, search_materials returns these rows like any other; because
 *     default_unit_price IS NULL, materialMatcher classifies them as
 *     status="missing_price" with reason="match_no_price". The TRADIE sees
 *     the line is recognised but must enter the price themselves. Stage 4
 *     intent preserved: never invent supplier prices.
 *
 * Idempotent: deterministic UUID per (supplier, product, unit). Re-running
 * the import is a no-op.
 *
 * Usage (writes only to the Supabase dev branch — never production):
 *
 *   1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 *   2. `npx tsx --env-file=.env.development.local scripts/import-material-reference-library.ts`
 *
 * Or, for the path used in this branch's QA pass, the same data is applied
 * via Supabase MCP `apply_migration` from a SQL representation that the
 * `materialsToInsertSql()` helper produces.
 */

import "server-only";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCTION_PROJECT_REF = "guiovuqccbzlbacaxepd";
const SUPPLIER = "Mitre 10";
const SOURCE_TAG = "kimi_material_library";

// =============================================================================
// CSV row → category mapping (CSV uses uppercase headings)
// =============================================================================

const CATEGORY_MAP: Record<string, string> = {
  "TIMBER & WOOD": "timber",
  "PLASTERBOARD & LININGS": "plasterboard",
  INSULATION: "insulation",
  "FASTENERS & HARDWARE": "fixing",
  "ROOFING & GUTTERS": "roofing",
  "CONCRETE & CEMENT": "concrete",
};

// =============================================================================
// Types
// =============================================================================

export type CsvRow = {
  Category: string;
  Product: string;
  Unit: string;
  /** Captured for parsing only; NEVER written to default_unit_price. */
  Est_Price: string;
  Notes: string;
};

export type ImportedMaterial = {
  id: string;
  user_id: null;
  country: "NZ";
  category: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  supplier: typeof SUPPLIER;
  unit: string;
  /** Always null — Est_Price is intentionally ignored. */
  default_unit_price: null;
  gst_included: boolean;
  active: boolean;
  attributes: Record<string, unknown>;
  /** 'csv_import' — there is no 'none' value in the CHECK constraint. */
  price_source: "csv_import";
  /** Reference rows have no validated price → confidence is low. */
  price_confidence: "low";
};

// =============================================================================
// CSV parsing — handles quoted fields containing commas (the CSV doesn't
// currently use them but we guard for future rows).
// =============================================================================

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const idx = (col: string) => header.indexOf(col);
  const cat = idx("Category");
  const prod = idx("Product");
  const unit = idx("Unit");
  const price = idx("Est_Price");
  const notes = idx("Notes");
  if (cat < 0 || prod < 0 || unit < 0) {
    throw new Error("CSV missing required columns Category/Product/Unit");
  }
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    rows.push({
      Category: cells[cat] ?? "",
      Product: cells[prod] ?? "",
      Unit: cells[unit] ?? "",
      Est_Price: price >= 0 ? cells[price] ?? "" : "",
      Notes: notes >= 0 ? cells[notes] ?? "" : "",
    });
  }
  return rows;
}

// =============================================================================
// Attribute parsing — turn "H1.2 Framing Timber 90x35mm" / "GIB Standard
// 2400x1200x10mm" / "Pink Batts R1.8 Ceiling 1160x580x75mm" / "Threaded
// Rod M20 x 2m" into structured attributes.
// =============================================================================

const TREATMENT_RE = /\bH(\d(?:\.\d)?)\b/i;
// 2-number size like "90x45" — allow trailing "mm" or end of word, but not
// another "x" (which would make this a 3-number pattern, handled separately).
const TWO_NUMBER_RE = /\b(\d{2,4})\s*x\s*(\d{2,4})(?!\s*x)(?:mm)?\b/i;
const THREE_NUMBER_RE = /\b(\d{2,4})\s*x\s*(\d{2,4})\s*x\s*(\d{1,4})\s*(mm)?\b/i; // 2400x1200x10
const STANDALONE_THICKNESS_RE = /\b(\d{1,3})\s*mm\b/i;
const R_VALUE_RE = /\bR\s*(\d(?:\.\d)?)\b/i;
const PER_LENGTH_M_RE = /\bper\s+(\d+(?:\.\d+)?)\s*m\b/i; // unit "per 2.4m"
const STAR_LENGTH_M_RE = /\b(\d+(?:\.\d+)?)\s*m\b\s*$/i; // "Threaded Rod M20 x 2m" trailing length
const SCREW_GAUGE_RE = /\b(\d{1,3})\s*g\b/i; // 10g, 14g

const KNOWN_BRANDS: Array<[RegExp, string]> = [
  [/\bgib\b/i, "GIB"],
  [/\bpink\s*batts?\b/i, "Pink Batts"],
  [/\bjames\s*hardie\b/i, "James Hardie"],
  [/\bcolor[s​]?steel\b|\bcolour[s​]?steel\b/i, "Colorsteel"],
  [/\bresene\b/i, "Resene"],
];

const FINISH_RE = /\b(stainless|galvani[sz]ed|zinc|hot\s*dip|brass)\b/i;

const FIXING_TYPE_RE =
  /\b(screws?|nails?|bolts?|nuts?|washers?|hangers?|brackets?|clips?|saddles?|rivets?|coach\s*screws?|threaded\s*rods?|joist\s*hangers?|hold\s*?downs?)\b/i;

export type ParsedAttributes = {
  treatment_class?: string;
  size?: string;
  width_mm?: number;
  height_mm?: number;
  thickness_mm?: number;
  sheet_size?: string;
  length_m?: number;
  r_value?: string;
  brand?: string;
  finish?: string;
  fixing_type?: string;
  screw_gauge?: string;
  notes?: string;
  /** Canonical CSV trace fields (always present) */
  source: typeof SOURCE_TAG;
  verified: false;
  is_priced: false;
};

export function parseProductAttributes(
  product: string,
  unit: string,
  notes: string,
): ParsedAttributes {
  const attrs: ParsedAttributes = {
    source: SOURCE_TAG,
    verified: false,
    is_priced: false,
  };
  const haystack = `${product} ${notes}`.trim();

  // Treatment class — preserve exactly (H1, H1.2, H3, H3.2, H4, H5).
  const t = haystack.match(TREATMENT_RE);
  if (t) attrs.treatment_class = `H${t[1]}`;

  // 3-number sheet pattern (e.g. "2400x1200x10mm") — wins over 2-number
  // because the third number is the thickness.
  const three = haystack.match(THREE_NUMBER_RE);
  if (three) {
    attrs.sheet_size = `${three[1]}x${three[2]}`;
    attrs.width_mm = parseInt(three[1], 10);
    attrs.height_mm = parseInt(three[2], 10);
    attrs.thickness_mm = parseInt(three[3], 10);
  } else {
    // 2-number size (e.g. "90x45")
    const two = haystack.match(TWO_NUMBER_RE);
    if (two) {
      attrs.size = `${two[1]}x${two[2]}`;
      attrs.width_mm = parseInt(two[1], 10);
      attrs.height_mm = parseInt(two[2], 10);
    }
    // Standalone thickness (e.g. "10mm" near the end of the product name)
    const th = haystack.match(STANDALONE_THICKNESS_RE);
    if (th) {
      const t_mm = parseInt(th[1], 10);
      // Only set if NOT already taken by the 3-number pattern's thickness
      // and the value isn't one of the 2-number dimensions.
      if (
        !attrs.thickness_mm &&
        t_mm !== attrs.width_mm &&
        t_mm !== attrs.height_mm
      ) {
        attrs.thickness_mm = t_mm;
      }
    }
  }

  // R-value (insulation)
  const r = haystack.match(R_VALUE_RE);
  if (r) attrs.r_value = `R${r[1]}`;

  // Length in metres — first try unit field "per 2.4m", then trailing in product
  const perL = unit.match(PER_LENGTH_M_RE);
  if (perL) attrs.length_m = parseFloat(perL[1]);
  else {
    const trailingL = product.match(STAR_LENGTH_M_RE);
    if (trailingL) attrs.length_m = parseFloat(trailingL[1]);
  }

  // Brand
  for (const [re, label] of KNOWN_BRANDS) {
    if (re.test(haystack)) {
      attrs.brand = label;
      break;
    }
  }

  // Finish
  const f = haystack.match(FINISH_RE);
  if (f) attrs.finish = f[1].toLowerCase().replace(/\s+/g, "_");

  // Fixing type (only meaningful for fastener category)
  const fx = haystack.match(FIXING_TYPE_RE);
  if (fx) attrs.fixing_type = fx[0].toLowerCase().replace(/\s+/g, "_");

  // Screw gauge
  const g = haystack.match(SCREW_GAUGE_RE);
  if (g) attrs.screw_gauge = `${g[1]}g`;

  // Free-text notes (preserved verbatim if present and non-trivial)
  if (notes && notes.trim().length > 1) {
    attrs.notes = notes.trim();
  }

  return attrs;
}

// =============================================================================
// Deterministic UUID per (supplier, product, unit) — gives idempotency
// without requiring a UNIQUE constraint on the materials table.
// =============================================================================

export function deterministicId(
  supplier: string,
  product: string,
  unit: string,
): string {
  const key = `mitre10:${supplier.trim().toLowerCase()}:${product.trim().toLowerCase()}:${unit.trim().toLowerCase()}`;
  const h = createHash("sha1").update(key).digest("hex");
  // Take first 32 hex digits, force UUID v4 layout (version=4, variant=8/9/a/b)
  const v4 = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  return v4;
}

// =============================================================================
// CSV row → ImportedMaterial. Skips rows with empty product or unsupported
// category. Returns null for skipped rows; caller deduplicates by id.
// =============================================================================

export function csvRowToMaterial(row: CsvRow): ImportedMaterial | null {
  const product = (row.Product ?? "").trim();
  if (!product) return null;
  const csvCategory = (row.Category ?? "").trim();
  const category = CATEGORY_MAP[csvCategory.toUpperCase()];
  if (!category) return null;
  const unit = (row.Unit ?? "").trim() || "each";

  const attrs = parseProductAttributes(product, unit, row.Notes ?? "");

  // Push the verbatim CSV category onto attributes for traceability — useful
  // for showing the tradie which Mitre 10 aisle a row came from.
  (attrs as Record<string, unknown>).csv_category = csvCategory;

  // Brand bubbled up to the dedicated column too (so brand-filtered searches
  // still work — Phase 4.7 lesson).
  const brand = attrs.brand ?? null;

  // CRITICAL — Est_Price is NEVER read into default_unit_price.
  // If the CSV had been edited by mistake to map prices, we still drop them.
  void row.Est_Price;

  return {
    id: deterministicId(SUPPLIER, product, unit),
    user_id: null,
    country: "NZ",
    category,
    name: product,
    normalized_name: product.toLowerCase(),
    brand,
    supplier: SUPPLIER,
    unit,
    default_unit_price: null,
    gst_included: true,
    active: true,
    attributes: attrs as Record<string, unknown>,
    price_source: "csv_import",
    price_confidence: "low",
  };
}

export type ImportSummary = {
  rowsRead: number;
  rowsImportedCandidates: number;
  duplicatesSkipped: number;
  unsupportedCategorySkipped: number;
  emptyProductSkipped: number;
  examples: ImportedMaterial[];
};

export function csvToMaterials(rows: CsvRow[]): {
  materials: ImportedMaterial[];
  summary: ImportSummary;
} {
  const seen = new Set<string>();
  const materials: ImportedMaterial[] = [];
  let unsupported = 0;
  let empty = 0;
  let dupes = 0;

  for (const row of rows) {
    const product = (row.Product ?? "").trim();
    if (!product) {
      empty++;
      continue;
    }
    const csvCategory = (row.Category ?? "").trim();
    if (!CATEGORY_MAP[csvCategory.toUpperCase()]) {
      unsupported++;
      continue;
    }
    const m = csvRowToMaterial(row);
    if (!m) continue;
    if (seen.has(m.id)) {
      dupes++;
      continue;
    }
    seen.add(m.id);
    materials.push(m);
  }

  return {
    materials,
    summary: {
      rowsRead: rows.length,
      rowsImportedCandidates: materials.length,
      duplicatesSkipped: dupes,
      unsupportedCategorySkipped: unsupported,
      emptyProductSkipped: empty,
      examples: materials.slice(0, 5),
    },
  };
}

// =============================================================================
// SQL representation — for applying the import via Supabase MCP
// `apply_migration` rather than via the raw client. The script chunks into
// 200-row batches so each emitted SQL stays well within Postgres limits.
// =============================================================================

function sqlEscape(v: string): string {
  return v.replace(/'/g, "''");
}

function jsonbLiteral(obj: Record<string, unknown>): string {
  return `'${sqlEscape(JSON.stringify(obj))}'::jsonb`;
}

export function materialsToInsertSql(
  materials: ImportedMaterial[],
  batchSize = 200,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < materials.length; i += batchSize) {
    const batch = materials.slice(i, i + batchSize);
    const values = batch.map((m) => {
      return `('${m.id}', null, '${m.country}', '${sqlEscape(m.category)}', '${sqlEscape(m.name)}', '${sqlEscape(m.normalized_name)}', '${sqlEscape(m.unit)}', null, ${m.gst_included}, ${jsonbLiteral(m.attributes)}, ${m.active}, '${m.price_source}', '${m.price_confidence}', '${sqlEscape(m.supplier)}', ${m.brand ? `'${sqlEscape(m.brand)}'` : "null"})`;
    });
    out.push(
      `insert into public.materials (
        id, user_id, country, category, name, normalized_name,
        unit, default_unit_price, gst_included, attributes, active,
        price_source, price_confidence, supplier, brand
      ) values\n${values.join(",\n")}\non conflict (id) do nothing;`,
    );
  }
  return out;
}

// =============================================================================
// Live Supabase upsert (alternate path — for direct execution with a
// service-role key). Same idempotency contract.
// =============================================================================

export async function applyImport(
  supabase: SupabaseClient,
  materials: ImportedMaterial[],
  batchSize = 500,
): Promise<{ ok: number; total: number }> {
  let ok = 0;
  for (let i = 0; i < materials.length; i += batchSize) {
    const batch = materials.slice(i, i + batchSize);
    const { error } = await supabase
      .from("materials")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Import batch failed: ${error.message}`);
    ok += batch.length;
  }
  return { ok, total: materials.length };
}

// =============================================================================
// Production guard — refuses to write against the production project ref.
// =============================================================================

export function assertNotProduction(supabaseUrl: string): void {
  const isProductionUrl = supabaseUrl.includes(PRODUCTION_PROJECT_REF);
  const hasAllowFlag = process.argv.includes("--allow-production");
  const hasAllowEnv = process.env.T2Q_ALLOW_PROD_IMPORT === "1";

  if (isProductionUrl && !(hasAllowFlag && hasAllowEnv)) {
    throw new Error(
      "Production import blocked. Set T2Q_ALLOW_PROD_IMPORT=1 and pass --allow-production.",
    );
  }
}

// =============================================================================
// Convenience reader for the canonical CSV path (or override via arg).
// =============================================================================

export function readCsvFile(path: string): CsvRow[] {
  const text = readFileSync(path, "utf8");
  return parseCsv(text);
}

// =============================================================================
// CLI runner — Stage 4 production cutover (Phase D).
// =============================================================================
//
// SAFETY contract enforced by runImport:
//   - default_unit_price is always null
//   - price_source is always 'csv_import'
//   - attributes.source is always 'kimi_material_library' (SOURCE_TAG)
//   - attributes.verified is always false
//   - attributes.is_priced is always false
//   - assertNotProduction enforces the double gate (T2Q_ALLOW_PROD_IMPORT=1
//     AND --allow-production) when the URL targets the production project.
//
// Dependency injection via `apply` and `csvRows` makes this fully testable
// without a real Supabase client or the canonical CSV file.

export type RunImportOptions = {
  supabaseUrl: string | undefined;
  serviceKey: string | undefined;
  /** Provide rows directly (test path), OR a CSV path (CLI path). */
  csvRows?: CsvRow[];
  csvPath?: string;
  dryRun: boolean;
  /** Test seam: bypass the real Supabase upsert. */
  apply?: (
    materials: ImportedMaterial[],
  ) => Promise<{ ok: number; total: number }>;
  /** Test seam: suppress logs in tests. Defaults to console.log. */
  log?: (...args: unknown[]) => void;
};

export type RunImportResult = {
  summary: ImportSummary;
  materials: ImportedMaterial[];
  result?: { ok: number; total: number };
  dryRun: boolean;
};

export async function runImport(
  options: RunImportOptions,
): Promise<RunImportResult> {
  const log = options.log ?? console.log;

  if (!options.supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required (set it in env before running).",
    );
  }
  if (!options.serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required (set it in env before running).",
    );
  }

  // Production guard fires FIRST — before any CSV is read or rows are
  // parsed. Both gates required for production URLs. See assertNotProduction.
  assertNotProduction(options.supabaseUrl);

  const rows =
    options.csvRows ??
    readCsvFile(options.csvPath ?? "Mitre_10_Full_Material_Catalogue.csv");
  const { materials, summary } = csvToMaterials(rows);

  // Compact, key-free summary. Never logs the service-role key, and never
  // logs raw CSV row data with prices — only counts and a 5-row example
  // preview that explicitly shows price-related fields are null/false.
  log("import summary:", {
    rowsRead: summary.rowsRead,
    rowsImportedCandidates: summary.rowsImportedCandidates,
    duplicatesSkipped: summary.duplicatesSkipped,
    unsupportedCategorySkipped: summary.unsupportedCategorySkipped,
    emptyProductSkipped: summary.emptyProductSkipped,
    dryRun: options.dryRun,
  });
  log(
    "first 5 examples (no prices):",
    summary.examples.map((m) => ({
      id: m.id,
      name: m.name,
      supplier: m.supplier,
      price_source: m.price_source,
      default_unit_price: m.default_unit_price,
      attributes_summary: {
        source: (m.attributes as Record<string, unknown>).source,
        verified: (m.attributes as Record<string, unknown>).verified,
        is_priced: (m.attributes as Record<string, unknown>).is_priced,
      },
    })),
  );

  if (options.dryRun) {
    log("DRY RUN — nothing was written.");
    return { summary, materials, dryRun: true };
  }

  // Defence-in-depth: refuse to call apply if any row has a price-shaped
  // value or a wrong source tag. csvRowToMaterial sets these correctly by
  // construction, so this assert should never fire in the normal flow —
  // it guards future regressions if anyone edits csvRowToMaterial.
  for (const m of materials) {
    if (m.default_unit_price !== null) {
      throw new Error(
        `Refusing to write row ${m.id}: default_unit_price is not null`,
      );
    }
    const attrs = m.attributes as Record<string, unknown>;
    if (attrs.is_priced !== false) {
      throw new Error(
        `Refusing to write row ${m.id}: attributes.is_priced is not false`,
      );
    }
    if (attrs.verified !== false) {
      throw new Error(
        `Refusing to write row ${m.id}: attributes.verified is not false`,
      );
    }
    if (attrs.source !== SOURCE_TAG) {
      throw new Error(
        `Refusing to write row ${m.id}: attributes.source is not '${SOURCE_TAG}'`,
      );
    }
    if (m.price_source !== "csv_import") {
      throw new Error(
        `Refusing to write row ${m.id}: price_source is not 'csv_import'`,
      );
    }
    if (m.supplier !== SUPPLIER) {
      throw new Error(
        `Refusing to write row ${m.id}: supplier is not '${SUPPLIER}'`,
      );
    }
  }

  let apply = options.apply;
  if (!apply) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(options.supabaseUrl, options.serviceKey, {
      auth: { persistSession: false },
    });
    apply = (mats) => applyImport(supabase, mats, 500);
  }

  const result = await apply(materials);
  log("import done:", result);
  return { summary, materials, result, dryRun: false };
}

// =============================================================================
// CLI entry — runs ONLY when this file is the entrypoint (not when imported).
// =============================================================================

async function main(): Promise<void> {
  const csvPath =
    process.argv.slice(2).find((a) => a.endsWith(".csv")) ??
    "Mitre_10_Full_Material_Catalogue.csv";
  const dryRun = process.argv.includes("--dry-run");

  await runImport({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    csvPath,
    dryRun,
  });
}

function isCliEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const entryFile = realpathSync(process.argv[1]);
    return thisFile === entryFile;
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("import failed:", message);
    process.exit(1);
  });
}
