import type { QuoteProfile } from "./quote-types";

/**
 * Wave 14.4 — client-name placeholder handling.
 *
 * The AI quote-generation pipeline writes "To be confirmed" into
 * `quote_data.client.name` whenever the voice transcript doesn't
 * mention a client. We don't want that placeholder leaking into the
 * UI — tradies found it confusing ("why does it say to be confirmed
 * on every quote?"). Display surfaces filter it out via these
 * helpers; the AI prompt itself is unchanged (do-not-touch list).
 */
const PLACEHOLDER_NAMES = new Set(["", "to be confirmed", "tbc", "tbd"]);

export function isPlaceholderClientName(name?: string | null): boolean {
  return PLACEHOLDER_NAMES.has((name ?? "").trim().toLowerCase());
}

/** Returns the name if real, or `fallback` (default "—") when it's a placeholder. */
export function displayClientName(
  name?: string | null,
  fallback = "—",
): string {
  return isPlaceholderClientName(name) ? fallback : (name as string);
}

export const NZ_DEFAULTS: QuoteProfile = {
  business_name: null,
  country: "NZ",
  default_labour_rate: 75,
  default_markup_pct: 20,
  tax_label: "GST",
  tax_rate: 15,
  currency: "NZD",
};

const CURRENCY_LOCALE: Record<string, string> = {
  NZD: "en-NZ",
  AUD: "en-AU",
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-CA",
};

export function formatCurrency(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-NZ";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function quoteNumber(id: string, createdAt: string | Date): string {
  const year = new Date(createdAt).getFullYear();
  const short = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `Q-${year}-${short}`;
}

export function formatIssueDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function validUntilDate(createdAt: string | Date, days = 30): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + days);
  return d;
}

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * The single source of truth for quote totals.
 *
 * Every total displayed or persisted (AI generation, the save action, and
 * the live editor) must run through this so the numbers can never drift
 * apart. The rule is SUM-OF-ROUNDED: each line is rounded to cents the
 * same way it is shown to the tradie (`line_total`), then the rounded
 * lines are summed. Summing the raw products and rounding once at the end
 * (round-of-sum) produces a subtotal that the visible line items don't add
 * up to — that mismatch was the "numbers don't match the total" bug.
 *
 * `materials_subtotal` deliberately includes "other" line items (markup
 * applies to both), matching the AI prompt contract and the eval suite.
 */
export function computeQuoteTotals(
  lineItems: ReadonlyArray<{
    type: string;
    quantity: number;
    unit_price: number;
  }>,
  markupPct: number,
  taxRate: number,
) {
  let materials_subtotal = 0;
  let labour_subtotal = 0;
  for (const it of lineItems) {
    const line_total = round2(
      (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    );
    if (it.type === "labour") labour_subtotal += line_total;
    else materials_subtotal += line_total;
  }
  materials_subtotal = round2(materials_subtotal);
  labour_subtotal = round2(labour_subtotal);
  const markup_amount = round2(materials_subtotal * ((Number(markupPct) || 0) / 100));
  const subtotal_before_tax = round2(
    materials_subtotal + markup_amount + labour_subtotal,
  );
  const tax_amount = round2(subtotal_before_tax * ((Number(taxRate) || 0) / 100));
  const total = round2(subtotal_before_tax + tax_amount);
  return {
    materials_subtotal,
    labour_subtotal,
    markup_amount,
    subtotal_before_tax,
    tax_amount,
    total,
  };
}
