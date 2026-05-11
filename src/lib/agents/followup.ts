/**
 * Follow-up Agent — generates ready-to-copy follow-up messages.
 *
 * Pure function. Takes the quote's metadata (client name, quote number,
 * total, currency, status, days since sent) and returns 4 message
 * templates the tradie can copy and paste into their own email or SMS
 * tool. Never sends anything; never writes to the database.
 *
 * Safety:
 *   - No `fetch`, no Supabase, no Resend. Pure string templates.
 *   - The user must click Copy on a template before anything leaves
 *     the page — and even then it only enters the clipboard.
 */

import { formatCurrency } from "@/lib/quote-defaults";
import type { QuoteStatus } from "@/lib/quote-types";

export type FollowupKind =
  | "friendly-reminder"
  | "price-clarification"
  | "acceptance-nudge"
  | "missing-info";

export interface FollowupMessage {
  id: FollowupKind;
  label: string;
  body: string;
  /** Whether this template applies to the current quote state. */
  applies: boolean;
  /** Reason it doesn't apply, when applies=false. */
  whyNotApply?: string;
}

export interface FollowupContext {
  quoteNumber: string;
  clientName: string | null;
  total: number;
  currency: string;
  status: QuoteStatus;
  /** `quotes.sent_at` ISO string, or null if not sent yet. */
  sentAtIso: string | null;
  /** Owner business name from `profiles.business_name`, or null. */
  businessName: string | null;
}

/** Number of days since a date (rounded down). */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function signoff(business: string | null): string {
  return business ? `Thanks,\n${business}` : "Thanks";
}

function clientFirst(name: string | null): string {
  if (!name) return "there";
  const first = name.trim().split(/\s+/)[0];
  return first.length > 0 ? first : "there";
}

export function runFollowupAgent(ctx: FollowupContext): FollowupMessage[] {
  const days = daysSince(ctx.sentAtIso);
  const totalFmt = formatCurrency(ctx.total, ctx.currency);
  const c = clientFirst(ctx.clientName);
  const sig = signoff(ctx.businessName);
  const isSent = ctx.status !== "draft";

  const friendlyReminder: FollowupMessage = {
    id: "friendly-reminder",
    label: "Friendly reminder",
    applies: isSent,
    whyNotApply: isSent
      ? undefined
      : "Quote is still a draft — send it first, then this template makes sense.",
    body: [
      `Hi ${c},`,
      "",
      days !== null
        ? `Just a quick follow-up on quote ${ctx.quoteNumber} (${totalFmt}) we sent ${days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}.`
        : `Just a quick follow-up on quote ${ctx.quoteNumber} (${totalFmt}).`,
      "",
      "No pressure — just checking it landed and answering any questions if it helps.",
      "",
      sig,
    ].join("\n"),
  };

  const priceClarification: FollowupMessage = {
    id: "price-clarification",
    label: "Price clarification",
    applies: isSent,
    whyNotApply: isSent
      ? undefined
      : "Quote is still a draft — send it first.",
    body: [
      `Hi ${c},`,
      "",
      `Wanted to clarify a couple of things on quote ${ctx.quoteNumber} (${totalFmt}):`,
      "",
      "• Materials are quoted at today's supplier prices and may shift if the start date pushes past 30 days.",
      "• Labour is at our standard hourly rate — happy to break it down by line if useful.",
      "• Anything outside the listed scope would be quoted separately as a variation.",
      "",
      "Let me know if you'd like to adjust scope, change finish level, or split the work into stages.",
      "",
      sig,
    ].join("\n"),
  };

  const acceptanceNudge: FollowupMessage = {
    id: "acceptance-nudge",
    label: "Acceptance nudge",
    applies: isSent,
    whyNotApply: isSent
      ? undefined
      : "Quote is still a draft.",
    body: [
      `Hi ${c},`,
      "",
      `Quick one on quote ${ctx.quoteNumber} (${totalFmt}) — we've got a window opening up ${days !== null && days >= 14 ? "in the next 2–3 weeks" : "soon"} if you'd like to lock it in.`,
      "",
      "Once you accept the quote we can pencil you in and get materials ordered.",
      "",
      "Happy to chat through anything that's holding you up.",
      "",
      sig,
    ].join("\n"),
  };

  const missingInfo: FollowupMessage = {
    id: "missing-info",
    label: "Missing info request",
    applies: true,
    body: [
      `Hi ${c},`,
      "",
      `Before I finalise quote ${ctx.quoteNumber}, can I check a couple of things:`,
      "",
      "• Site access — are there gates, alarms, or tenants we need to plan around?",
      "• Preferred start date / finish-by date.",
      "• Anything specific on finish level (e.g. paint-ready vs decorator-finish).",
      "• Power and water on site — anything we should know?",
      "",
      "Once I've got those, I can lock the numbers in.",
      "",
      sig,
    ].join("\n"),
  };

  return [
    friendlyReminder,
    priceClarification,
    acceptanceNudge,
    missingInfo,
  ];
}
