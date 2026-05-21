// ─────────────────────────────────────────────────────────────────────────
// Supplier-quote extraction — pure parser / normaliser.
//
// The AI (Claude vision) reads a photo of a NZ building-merchant quote and
// returns loose JSON. This module is the deterministic boundary: it turns
// that JSON into a typed, sanitised `SupplierQuoteExtraction` the rest of
// the app can trust. The AI extracts; this code normalises; the human
// reviews; `importSupplierQuoteItems` writes. The AI is never the source
// of truth for a price.
//
// No zod (CLAUDE.md says avoid deps) — the `parse*` helper is zod-shaped:
// it returns `{ ok, value }` / `{ ok, errors }` so call sites branch the
// same way as the takeoff schemas.
// ─────────────────────────────────────────────────────────────────────────

export type ExtractedSupplierItem = {
  /** Product description as printed on the quote. */
  name: string;
  /** Normalised unit (each, m, m², sheet, length, bag, …). */
  unit: string;
  /** Unit price as shown (GST handling is decided at review time). Null = not found. */
  price: number | null;
  /** Supplier SKU / product code if printed. */
  sku: string | null;
  /** Line quantity in the printed unit — used when building a quote 1:1. */
  quantity: number | null;
  /**
   * Piece count when the line shows a "N/length" breakdown (e.g. "19/4.8m"
   * → 19 pieces). When present it's authoritative: the supplier already did
   * the stock-length maths, so we don't re-round.
   */
  pieces: number | null;
  /**
   * The line total EXACTLY as printed on the supplier quote. Read-only
   * SOURCE value — the validation layer reconciles this against the
   * recomputed `quantity × price`. Never used to overwrite a price. Null
   * when the quote doesn't print a per-line total.
   */
  source_line_total: number | null;
  /**
   * The raw text the model read this row off, for provenance / "show me
   * where this came from" in review. Null when unavailable.
   */
  raw_text: string | null;
  /** [0,1] — the model's confidence in this row (lower when derived/unclear). */
  confidence: number;
};

export type SupplierQuoteExtraction = {
  supplier: string | null;
  /** Quote / order number as printed, for the review header. */
  quote_number: string | null;
  currency: string | null;
  /** true = displayed unit prices INCLUDE GST, false = exclude, null = unclear. */
  gst_inclusive: boolean | null;
  items: ExtractedSupplierItem[];
  /**
   * Document-level totals EXACTLY as printed. Read-only SOURCE values the
   * validation layer reconciles against the recomputed figures. Null when
   * the quote doesn't print that summary line.
   */
  subtotal: number | null;
  gst: number | null;
  total: number | null;
  /** Things the tradie should double-check (smudged numbers, ambiguous units). */
  notes: string[];
};

export type ParseResult =
  | { ok: true; value: SupplierQuoteExtraction }
  | { ok: false; errors: string[] };

// Common NZ-merchant unit spellings → canonical form.
const UNIT_ALIASES: Record<string, string> = {
  ea: "each",
  each: "each",
  unit: "each",
  no: "each",
  "no.": "each",
  pcs: "each",
  pc: "each",
  m: "m",
  lm: "m",
  lin: "m",
  "lin m": "m",
  lineal: "m",
  m2: "m²",
  "m^2": "m²",
  sqm: "m²",
  "sq m": "m²",
  m3: "m³",
  "m^3": "m³",
  cum: "m³",
  sheet: "sheet",
  sht: "sheet",
  length: "length",
  lgth: "length",
  len: "length",
  bag: "bag",
  box: "box",
  roll: "roll",
  pair: "pair",
  kg: "kg",
  l: "L",
  litre: "L",
  ltr: "L",
};

export function normaliseUnit(raw: unknown): string {
  if (typeof raw !== "string") return "each";
  const t = raw.trim().toLowerCase();
  if (!t) return "each";
  return UNIT_ALIASES[t] ?? t;
}

/** Coerce a price-ish value to a number, tolerating "$1,234.50" strings. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clampConfidence(v: unknown): number {
  const n = toNumber(v);
  if (n === null) return 0.6;
  return Math.max(0, Math.min(1, n));
}

/**
 * Parse + sanitise the raw model JSON. Always returns ok:true with a
 * (possibly empty) item list unless the payload isn't even an object —
 * the caller decides what to do with zero items.
 */
export function parseSupplierQuoteExtraction(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["extraction must be an object"] };
  }
  const obj = raw as Record<string, unknown>;

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const seen = new Set<string>();
  const items: ExtractedSupplierItem[] = [];
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) continue;
    const r = it as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue; // a row with no name is useless
    const unit = normaliseUnit(r.unit);
    const priceRaw = toNumber(r.price);
    const price =
      priceRaw === null ? null : Math.max(0, Math.round(priceRaw * 100) / 100);
    const sku =
      typeof r.sku === "string" && r.sku.trim() ? r.sku.trim() : null;
    const qtyRaw = toNumber(r.quantity);
    const quantity = qtyRaw === null ? null : Math.max(0, qtyRaw);
    const piecesRaw = toNumber(r.pieces);
    const pieces =
      piecesRaw === null || piecesRaw <= 0 ? null : Math.round(piecesRaw);
    const sltRaw = toNumber(r.line_total);
    const source_line_total =
      sltRaw === null ? null : Math.round(sltRaw * 100) / 100;
    const raw_text =
      typeof r.raw_text === "string" && r.raw_text.trim()
        ? r.raw_text.trim()
        : null;
    const confidence = clampConfidence(r.confidence);

    // Dedupe identical name+unit rows the model may have read twice.
    const key = `${name.toLowerCase()}|${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      name,
      unit,
      price,
      sku,
      quantity,
      pieces,
      source_line_total,
      raw_text,
      confidence,
    });
  }

  const supplier =
    typeof obj.supplier === "string" && obj.supplier.trim()
      ? obj.supplier.trim()
      : null;
  const quote_number =
    typeof obj.quote_number === "string" && obj.quote_number.trim()
      ? obj.quote_number.trim()
      : null;
  const currency =
    typeof obj.currency === "string" && obj.currency.trim()
      ? obj.currency.trim()
      : null;
  const gst_inclusive =
    typeof obj.gst_inclusive === "boolean" ? obj.gst_inclusive : null;
  const subtotal = toNumber(obj.subtotal);
  const gst = toNumber(obj.gst);
  const total = toNumber(obj.total);
  const notes = Array.isArray(obj.notes)
    ? obj.notes.filter((s): s is string => typeof s === "string")
    : [];

  return {
    ok: true,
    value: {
      supplier,
      quote_number,
      currency,
      gst_inclusive,
      items,
      subtotal,
      gst,
      total,
      notes,
    },
  };
}

/**
 * Convert a displayed price to the ex-GST value we store in the library.
 * Mirrors the supplier-capture form's convention (default_unit_price is
 * always ex-GST). `rate` is the GST fraction (NZ = 0.15).
 */
export function toExGst(
  price: number,
  inclusive: boolean,
  rate = 0.15,
): number {
  const ex = inclusive ? price / (1 + rate) : price;
  return Math.round(ex * 100) / 100;
}
