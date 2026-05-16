import type { QuoteData, QuoteStatus } from "./quote-types";

export type SendValidationError =
  | "client_name_missing"
  | "client_email_missing"
  | "client_email_invalid"
  | "client_phone_missing"
  | "client_phone_invalid"
  | "no_line_items"
  | "total_zero"
  | "already_accepted";

export type SendValidationResult =
  | { ok: true; resolvedEmail: string }
  | { ok: false; error: SendValidationError };

export type SmsSendValidationResult =
  | { ok: true; resolvedPhone: string }
  | { ok: false; error: SendValidationError };

const PLACEHOLDER_NAMES = new Set(["", "to be confirmed", "tbc", "tbd"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-ish: leading +, 8–15 digits. Twilio rejects anything else outright.
const PHONE_E164_RE = /^\+\d{8,15}$/;

export function validateQuoteForSending(args: {
  status: QuoteStatus | string;
  total_amount: number | null;
  quote_data: QuoteData | null;
}): SendValidationResult {
  const { status, total_amount, quote_data } = args;
  if (status === "accepted") {
    return { ok: false, error: "already_accepted" };
  }
  if (!quote_data) {
    return { ok: false, error: "no_line_items" };
  }
  const name = (quote_data.client?.name ?? "").trim();
  if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) {
    return { ok: false, error: "client_name_missing" };
  }
  let email = (quote_data.client?.email ?? "").trim();
  // Legacy: older quotes had a single client.contact field with an email or phone.
  if (!email) {
    const legacy = (quote_data.client?.contact ?? "").trim();
    if (legacy && EMAIL_RE.test(legacy)) {
      email = legacy;
    }
  }
  if (!email) {
    return { ok: false, error: "client_email_missing" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "client_email_invalid" };
  }
  const items = Array.isArray(quote_data.line_items)
    ? quote_data.line_items
    : [];
  if (items.length === 0) {
    return { ok: false, error: "no_line_items" };
  }
  const total = Number(total_amount ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "total_zero" };
  }
  return { ok: true, resolvedEmail: email };
}

export function validateQuoteForSmsSending(args: {
  status: QuoteStatus | string;
  total_amount: number | null;
  quote_data: QuoteData | null;
}): SmsSendValidationResult {
  const { status, total_amount, quote_data } = args;
  if (status === "accepted") {
    return { ok: false, error: "already_accepted" };
  }
  if (!quote_data) {
    return { ok: false, error: "no_line_items" };
  }
  const name = (quote_data.client?.name ?? "").trim();
  if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) {
    return { ok: false, error: "client_name_missing" };
  }
  const phone = normalizePhone(quote_data.client?.phone ?? "");
  if (!phone) {
    return { ok: false, error: "client_phone_missing" };
  }
  if (!PHONE_E164_RE.test(phone)) {
    return { ok: false, error: "client_phone_invalid" };
  }
  const items = Array.isArray(quote_data.line_items)
    ? quote_data.line_items
    : [];
  if (items.length === 0) {
    return { ok: false, error: "no_line_items" };
  }
  const total = Number(total_amount ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "total_zero" };
  }
  return { ok: true, resolvedPhone: phone };
}

/**
 * Strips spaces/dashes/parens and converts a NZ-style "021..." or "0..."
 * national number to E.164 (+64...). Anything already starting with "+"
 * is left alone after whitespace stripping. Returns "" if input is empty.
 *
 * Also fixes the most common NZ data-entry bug: typing the country code
 * AND the leading national 0 ("+64 022 504 4457" → "+640225044457").
 * Twilio rejects that — the leading 0 is the national-format prefix, not
 * part of the subscriber number, so the country-code form must drop it.
 */
export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (!stripped) return "";
  // "+640225044457" → "+6422504457". Has to run BEFORE the generic
  // "starts with +" pass-through below.
  if (stripped.startsWith("+640")) return `+64${stripped.slice(4)}`;
  if (stripped.startsWith("+")) return stripped;
  // NZ national format: leading 0 → +64. Best-effort only; tradies
  // outside NZ should enter +country themselves.
  if (stripped.startsWith("0")) return `+64${stripped.slice(1)}`;
  return stripped;
}

export const SEND_ERROR_MESSAGES: Record<SendValidationError, string> = {
  client_name_missing: "Add a client name before sending.",
  client_email_missing: "Add the client's email address before sending.",
  client_email_invalid: "The client email doesn't look valid.",
  client_phone_missing: "Add the client's phone number before sending an SMS.",
  client_phone_invalid: "The client phone number doesn't look valid. Use a full international number (+64...).",
  no_line_items: "Add at least one line item before sending.",
  total_zero: "Quote total must be greater than zero.",
  already_accepted: "This quote has already been accepted.",
};
