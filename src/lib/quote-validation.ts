import type { QuoteData, QuoteLineItem, QuoteStatus } from "./quote-types";
import { round2 } from "./quote-defaults";

export type SendValidationError =
  | "client_name_missing"
  | "client_email_missing"
  | "client_email_invalid"
  | "client_phone_missing"
  | "client_phone_invalid"
  | "no_line_items"
  | "total_zero"
  | "already_accepted"
  // Wave 45 — takeoff safety gate.
  | "takeoff_blocked"
  | "takeoff_unconfirmed";

export type SendValidationResult =
  | { ok: true; resolvedEmail: string }
  | { ok: false; error: SendValidationError; reasons?: string[] };

export type SmsSendValidationResult =
  | { ok: true; resolvedPhone: string }
  | { ok: false; error: SendValidationError; reasons?: string[] };

/**
 * Wave 45 — pre-send takeoff safety assessment.
 *
 * Reads the calculation-risk signals already carried on each line
 * (`takeoff_status`) plus the frozen evaluator verdict
 * (`quote_data.takeoff_evaluation`) and decides whether a quote may be
 * sent.
 *
 *   - HARD BLOCK (can_send=false): any `blocked` line OR evaluator
 *     `fail`. These cannot be sent by any path and cannot be overridden
 *     — the underlying number is missing or almost certainly wrong.
 *   - WARN (requires_acknowledgement=true): any `needs_review` /
 *     `assumed` line OR evaluator `caution`. Sendable, but only after an
 *     explicit acknowledgement so uncertainty is never hidden.
 *
 * Legacy quotes with no takeoff signals assess as fully sendable — the
 * absence of data is never treated as a block.
 */
export type TakeoffSafetyAssessment = {
  can_send: boolean;
  block_reasons: string[];
  warning_reasons: string[];
  requires_acknowledgement: boolean;
};

function lineLabels(items: QuoteLineItem[], max = 3): string {
  const names = items
    .map((it) => it.description?.trim())
    .filter((d): d is string => !!d);
  const shown = names.slice(0, max).join(", ");
  const extra = names.length > max ? ` +${names.length - max} more` : "";
  return shown ? `${shown}${extra}` : `${items.length} line(s)`;
}

export function assessQuoteTakeoffSafety(
  quote_data: QuoteData | null,
): TakeoffSafetyAssessment {
  const block_reasons: string[] = [];
  const warning_reasons: string[] = [];

  const items: QuoteLineItem[] = Array.isArray(quote_data?.line_items)
    ? quote_data!.line_items
    : [];

  const blocked = items.filter((it) => it.takeoff_status === "blocked");
  const needsReview = items.filter(
    (it) => it.takeoff_status === "needs_review",
  );
  const assumed = items.filter((it) => it.takeoff_status === "assumed");

  if (blocked.length > 0) {
    block_reasons.push(
      `${blocked.length} line(s) couldn't be calculated and need more info: ${lineLabels(blocked)}.`,
    );
  }

  const evaluation = quote_data?.takeoff_evaluation ?? null;
  if (evaluation?.status === "fail") {
    for (const r of evaluation.reasons) block_reasons.push(r);
    if (evaluation.reasons.length === 0) {
      block_reasons.push("Automated check flagged the takeoff as unreliable.");
    }
  }

  // PHASE 4 — supplier-import source fidelity (HARD BLOCK, no override).
  // Re-checked LIVE against the current quote_data, never the frozen
  // import-time status, so a quote the tradie has since corrected is no
  // longer blocked. A quote that claims to mirror a supplier quote must
  // still match it: every supplier-sourced line's live total must equal
  // its printed source, and the printed subtotal must equal the sum of the
  // sourced lines (a gap = a dropped/duplicated line). Lines the tradie
  // ADDED (no source_line_total) are ignored here so legitimate additions
  // don't false-block.
  const SUPPLIER_TOL = 0.02;
  const sourcedLines = items.filter((it) => it.source_line_total != null);
  if (sourcedLines.length > 0) {
    const changed = sourcedLines.filter((it) => {
      const live = round2(
        (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      );
      return Math.abs(live - (it.source_line_total as number)) > SUPPLIER_TOL;
    });
    if (changed.length > 0) {
      block_reasons.push(
        `${changed.length} line(s) no longer match the supplier quote: ${lineLabels(changed)}. Snap to the supplier value or correct the price.`,
      );
    }
    const supplierSubtotal = quote_data?.supplier_source?.subtotal ?? null;
    if (supplierSubtotal != null) {
      const sourcedSum = round2(
        sourcedLines.reduce((s, it) => s + (it.source_line_total as number), 0),
      );
      if (Math.abs(sourcedSum - supplierSubtotal) > SUPPLIER_TOL) {
        block_reasons.push(
          "The supplier subtotal doesn't match the imported lines — a line may be missing or duplicated. Re-scan or fix before sending.",
        );
      }
    }
  }

  // PHASE 7 — an AI-supplied material quantity must never enter the send
  // path unconfirmed. The tradie can confirm it, edit it (→ user-supplied),
  // or replace it with a calculator result. Until then it's a HARD block:
  // the AI never gets to put a quantity on a sent quote unchecked.
  const unconfirmedAiQty = items.filter(
    (it) =>
      it.type === "material" &&
      it.quantity_source === "ai" &&
      it.quantity_confirmed !== true,
  );
  if (unconfirmedAiQty.length > 0) {
    block_reasons.push(
      `${unconfirmedAiQty.length} material line(s) use an AI-estimated quantity that must be confirmed before sending: ${lineLabels(unconfirmedAiQty)}.`,
    );
  }

  if (needsReview.length > 0) {
    warning_reasons.push(
      `${needsReview.length} line(s) flagged for review: ${lineLabels(needsReview)}.`,
    );
  }
  if (assumed.length > 0) {
    warning_reasons.push(
      `${assumed.length} line(s) used default assumptions: ${lineLabels(assumed)}.`,
    );
  }
  if (evaluation?.status === "caution") {
    for (const r of evaluation.reasons) warning_reasons.push(r);
    if (evaluation.reasons.length === 0) {
      warning_reasons.push("Automated check flagged the takeoff for review.");
    }
  }

  const can_send = block_reasons.length === 0;
  return {
    can_send,
    block_reasons,
    warning_reasons,
    // Only ask for an acknowledgement when the quote is otherwise
    // sendable — a hard block supersedes the warning path.
    requires_acknowledgement: can_send && warning_reasons.length > 0,
  };
}

const PLACEHOLDER_NAMES = new Set(["", "to be confirmed", "tbc", "tbd"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-ish: leading +, 8–15 digits. Twilio rejects anything else outright.
const PHONE_E164_RE = /^\+\d{8,15}$/;

export function validateQuoteForSending(args: {
  status: QuoteStatus | string;
  total_amount: number | null;
  quote_data: QuoteData | null;
  /** Set true once the operator has acknowledged caution-level warnings. */
  acknowledged?: boolean;
}): SendValidationResult {
  const { status, total_amount, quote_data, acknowledged } = args;
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
  const safety = assessQuoteTakeoffSafety(quote_data);
  if (!safety.can_send) {
    return { ok: false, error: "takeoff_blocked", reasons: safety.block_reasons };
  }
  if (safety.requires_acknowledgement && !acknowledged) {
    return {
      ok: false,
      error: "takeoff_unconfirmed",
      reasons: safety.warning_reasons,
    };
  }
  return { ok: true, resolvedEmail: email };
}

export function validateQuoteForSmsSending(args: {
  status: QuoteStatus | string;
  total_amount: number | null;
  quote_data: QuoteData | null;
  /** Set true once the operator has acknowledged caution-level warnings. */
  acknowledged?: boolean;
}): SmsSendValidationResult {
  const { status, total_amount, quote_data, acknowledged } = args;
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
  const safety = assessQuoteTakeoffSafety(quote_data);
  if (!safety.can_send) {
    return { ok: false, error: "takeoff_blocked", reasons: safety.block_reasons };
  }
  if (safety.requires_acknowledgement && !acknowledged) {
    return {
      ok: false,
      error: "takeoff_unconfirmed",
      reasons: safety.warning_reasons,
    };
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
  takeoff_blocked:
    "Some quantities couldn't be calculated or look wrong. Fix the flagged lines before sending.",
  takeoff_unconfirmed:
    "This quote has assumptions or flagged quantities. Review and confirm them before sending.",
};
