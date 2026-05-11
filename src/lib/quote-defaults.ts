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
