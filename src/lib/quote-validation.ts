import type { QuoteData, QuoteStatus } from "./quote-types";

export type SendValidationError =
  | "client_name_missing"
  | "client_email_missing"
  | "client_email_invalid"
  | "no_line_items"
  | "total_zero"
  | "already_accepted";

export type SendValidationResult =
  | { ok: true; resolvedEmail: string }
  | { ok: false; error: SendValidationError };

const PLACEHOLDER_NAMES = new Set(["", "to be confirmed", "tbc", "tbd"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const SEND_ERROR_MESSAGES: Record<SendValidationError, string> = {
  client_name_missing: "Add a client name before sending.",
  client_email_missing: "Add the client's email address before sending.",
  client_email_invalid: "The client email doesn't look valid.",
  no_line_items: "Add at least one line item before sending.",
  total_zero: "Quote total must be greater than zero.",
  already_accepted: "This quote has already been accepted.",
};
