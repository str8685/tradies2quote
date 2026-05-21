// ─────────────────────────────────────────────────────────────────────────
// Scan document classification.
//
// The drawing scanner and the supplier-quote importer are different tools. A
// printed supplier quote photographed into the drawing scanner reads back as
// a priced materials list, which the deck/takeoff path then hallucinates
// over (roofing on a deck, 222 m³ of concrete, etc.). This module decides
// what the image actually is so the UI can redirect a misfiled supplier
// quote to the importer.
//
// The model returns its own `document_type`; this code is the deterministic
// backstop that catches a misfiled quote even when the model mislabels it.
// ─────────────────────────────────────────────────────────────────────────

export type ScanDocumentType = "drawing" | "supplier_quote" | "other";

/**
 * Heuristic: does this scanned text read like a printed supplier quote?
 * Conservative on purpose — requires merchant vocabulary AND several
 * 2-decimal money amounts, so a dimension-heavy hand-drawn plan (which has
 * decimals like "8.82m" but none of the quote words) won't trip it.
 */
export function looksLikeSupplierQuote(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const hasQuoteWords =
    /\b(estimate|invoice|subtotal|unit price|extended|gst no|customer o\/n)\b/.test(
      t,
    ) || /\bquote\b[^\n]{0,20}\b(no|number|#|\d{4,})\b/.test(t);
  const priceCount = (text.match(/\d+\.\d{2}\b/g) ?? []).length;
  return hasQuoteWords && priceCount >= 4;
}

/**
 * Combine the model's classification with the deterministic backstop.
 * Supplier-quote wins from either source; otherwise fall back to the
 * model's value, defaulting to "drawing".
 */
export function resolveDocumentType(
  modelValue: unknown,
  extractedText: string,
): ScanDocumentType {
  const model: ScanDocumentType =
    modelValue === "supplier_quote" || modelValue === "other"
      ? modelValue
      : "drawing";
  if (model === "supplier_quote") return "supplier_quote";
  if (looksLikeSupplierQuote(extractedText)) return "supplier_quote";
  return model;
}
