import type { QuoteProfile } from "./quote-types";

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
