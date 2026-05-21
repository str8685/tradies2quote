"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChatCircleText,
  EnvelopeSimple,
  FloppyDisk,
  Warning,
} from "@phosphor-icons/react";
import type { QuoteStatus } from "@/lib/quote-types";

/**
 * Wave 19.10 — sticky bottom action bar.
 *
 * Replaces the end-of-page "Save changes" row + the inline Send
 * button. Always visible on mobile (fixed at the bottom, above the
 * `<MobileBottomNav>`). On md+ it lays out as a normal inline strip
 * so it doesn't squat across the desktop viewport.
 *
 * Layout (left → right):
 *   - DRAFT status pill (matches the existing `<StatusPill>` palette).
 *   - "Save changes" GHOST button (high-frequency action — listed first).
 *   - "Send quote" PRIMARY brand-orange button (lower-frequency, terminal).
 *
 * Send action POSTs to `/api/quotes/{quoteId}/send`. Logic mirrors
 * `SendQuoteButton.handleSend` but lives here so the bar is
 * self-contained. The inline `<SendQuoteButton>` is rendered with
 * `hideSendButton` so its trigger stays off the page — its link
 * affordances (PDF, public link, copy) keep their inline home for
 * sent/viewed/accepted states.
 *
 * Mobile geometry:
 *   - Sits flush on top of `<MobileBottomNav>`. That nav is 57px
 *     (a 56px tile + 1px border-top) plus its own safe-area
 *     padding-bottom, so this bar's `bottom` mirrors the exact same
 *     `max(env(safe-area-inset-bottom) - 24px, 4px)` formula — the
 *     two then read as one connected bottom unit on every device.
 *   - `min-h-[56px]` per the spec.
 *   - z-50 + blur backdrop + ink-950/85 bg so scrolled content
 *     remains legible behind the bar.
 */
type Props = {
  quoteId: string;
  status: QuoteStatus;
  isPending: boolean;
  onSave: () => void | Promise<void>;
  /**
   * Async hook so the Send button can call the editor's save before
   * firing /api/quotes/{id}/send. Returns true on success.
   */
  onSaveBeforeSend: () => Promise<boolean>;
};

type SendState = "idle" | "saving" | "generating" | "sending" | "sent" | "error";

const ERROR_COPY: Record<string, string> = {
  client_name_missing: "Add a client name before sending.",
  client_email_missing: "Add the client's email address before sending.",
  client_email_invalid: "The client email doesn't look valid.",
  client_phone_missing: "Add the client's phone number before sending an SMS.",
  client_phone_invalid: "The client phone number doesn't look valid. Use +64...",
  no_line_items: "Add at least one line item before sending.",
  total_zero: "Quote total must be greater than zero.",
  already_accepted: "This quote has already been accepted.",
  pdf_generation_failed: "Could not generate the PDF.",
  pdf_upload_failed: "Could not save the PDF.",
  email_not_configured: "Email isn't configured. Ask your admin to set RESEND_API_KEY.",
  email_from_not_configured: "Email sender isn't configured. Set RESEND_FROM_EMAIL.",
  sms_not_configured: "SMS isn't configured. Set TWILIO_ACCOUNT_SID.",
  sms_token_not_configured: "SMS isn't configured. Set TWILIO_AUTH_TOKEN.",
  sms_from_not_configured: "SMS isn't configured. Set TWILIO_FROM_NUMBER.",
  update_failed: "Message sent but the quote status couldn't update.",
  takeoff_blocked: "Fix the flagged takeoff lines before sending.",
  takeoff_unconfirmed: "Review and confirm the flagged quantities before sending.",
};

const STATUS_PILL: Record<QuoteStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-hivis/40 bg-hivis/10 text-hivis" },
  sent: { label: "Sent", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  viewed: { label: "Viewed", cls: "border-hivis/40 bg-hivis/10 text-hivis" },
  accepted: { label: "Accepted", cls: "border-brand/40 bg-brand/10 text-brand" },
  scheduled: { label: "Scheduled", cls: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
  in_progress: { label: "In progress", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  completed: { label: "Completed", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  declined: { label: "Declined", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  expired: { label: "Expired", cls: "border-ink-600 bg-ink-800 text-ink-400" },
};

export function StickyActionBar({
  quoteId,
  status,
  isPending,
  onSave,
  onSaveBeforeSend,
}: Props) {
  const router = useRouter();
  const [sendState, setSendState] = useState<SendState>("idle");
  const [activeChannel, setActiveChannel] = useState<"email" | "sms">("email");
  const [errorMessage, setErrorMessage] = useState("");
  // Wave 45 — takeoff safety gate (mirrors SendQuoteButton).
  const [confirmReasons, setConfirmReasons] = useState<string[] | null>(null);
  const [blockReasons, setBlockReasons] = useState<string[] | null>(null);

  const isAccepted = status === "accepted";
  const isSentOrViewed = status === "sent" || status === "viewed";
  const sendBusy =
    sendState === "saving" ||
    sendState === "generating" ||
    sendState === "sending";

  async function sendVia(channel: "email" | "sms", acknowledged = false) {
    setActiveChannel(channel);
    setErrorMessage("");
    setBlockReasons(null);
    if (!acknowledged) setConfirmReasons(null);
    setSendState("saving");
    const saved = await onSaveBeforeSend();
    if (!saved) {
      setErrorMessage("Could not save your latest edits.");
      setSendState("error");
      return;
    }
    setSendState("generating");
    try {
      const endpoint =
        channel === "sms"
          ? `/api/quotes/${quoteId}/sms`
          : `/api/quotes/${quoteId}/send`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acknowledged }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          reasons?: string[];
        };
        const code = data.error ?? "send_failed";
        if (code === "takeoff_unconfirmed") {
          setConfirmReasons(data.reasons ?? []);
          setSendState("idle");
          return;
        }
        if (code === "takeoff_blocked") {
          setBlockReasons(data.reasons ?? []);
          setErrorMessage(
            data.message ?? ERROR_COPY[code] ?? "Fix the flagged lines before sending.",
          );
          setSendState("error");
          return;
        }
        setErrorMessage(
          data.message ?? ERROR_COPY[code] ?? "Could not send the quote.",
        );
        setSendState("error");
        return;
      }
      setConfirmReasons(null);
      setSendState("sent");
      router.refresh();
    } catch {
      setErrorMessage("Network error. Please try again.");
      setSendState("error");
    }
  }

  const handleSend = () => sendVia("email");
  const handleSendSms = () => sendVia("sms");

  const pill = STATUS_PILL[status] ?? STATUS_PILL.draft;

  return (
    <>
      {/* Inline error / sent message — anchored ABOVE the bar so it
          doesn't clip into the action row on a narrow phone.
          Wave 36 — solid backgrounds (was bg-red-500/10 + bg-brand/10
          which are mostly transparent and blended into the cream
          light-mode page behind, making the banner look like it was
          overlapping the metadata grid). Solid red / solid brand reads
          as a real banner on both themes and never bleeds. */}
      {(sendState === "error" || sendState === "sent") && (
        <div
          aria-live="polite"
          className="fixed inset-x-0 bottom-[180px] z-50 mx-auto max-w-3xl px-4 sm:static sm:bottom-auto sm:max-w-none sm:px-0"
        >
          <p
            data-testid={
              sendState === "error" ? "sticky-send-error" : "sticky-send-ok"
            }
            className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] shadow-lg ${
              sendState === "error"
                ? "border-red-600 bg-red-600 text-white"
                : "border-brand bg-brand text-ink-900"
            }`}
          >
            {sendState === "error"
              ? errorMessage
              : activeChannel === "sms"
                ? "// sms sent"
                : "// quote sent"}
          </p>
        </div>
      )}

      {blockReasons && blockReasons.length > 0 && (
        <div
          aria-live="polite"
          className="fixed inset-x-0 bottom-[180px] z-50 mx-auto max-w-3xl px-4 sm:static sm:bottom-auto sm:max-w-none sm:px-0 sm:mb-2"
        >
          <div
            data-testid="sticky-send-blocked"
            className="rounded-sm border border-red-500/60 bg-ink-950 p-3 shadow-lg"
          >
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-red-300">
              <Warning size={14} weight="fill" />
              {"// can't send yet"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-ink-100">
              {blockReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-red-300">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {confirmReasons && (
        <div
          aria-live="polite"
          className="fixed inset-x-0 bottom-[180px] z-50 mx-auto max-w-3xl px-4 sm:static sm:bottom-auto sm:max-w-none sm:px-0 sm:mb-2"
        >
          <div
            data-testid="sticky-send-confirm"
            className="rounded-sm border border-hivis/60 bg-ink-950 p-3 shadow-lg"
          >
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
              <Warning size={14} weight="fill" />
              {"// confirm before sending"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-ink-100">
              {confirmReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-hivis">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                data-testid="sticky-send-confirm-button"
                onClick={() => sendVia(activeChannel, true)}
                className="t2q-btn-primary-pro min-h-[44px] !px-4 !text-[11px]"
              >
                Confirm &amp; send {activeChannel === "sms" ? "text" : "email"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReasons(null)}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 hover:text-ink-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        data-testid="sticky-action-bar"
        className={[
          // Soft-serif refresh — the bottom nav is now a FLOATING rounded
          // pill (`.t2q-bottomnav-bar`, ~62px tall, sitting a thumb's width
          // off the screen edges). The old `bottom: 57px + safe-area`
          // formula assumed the previous edge-anchored 57px strip, so this
          // bar ended up sitting ON TOP of the pill. Now it floats just
          // ABOVE the pill: `bottom` clears the pill (~62px) + a gap, and
          // it gets the same rounded/bordered/blurred treatment so the two
          // read as one intentional floating cluster, not overlapping bars.
          "fixed left-3 right-3 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)_+_4.5rem)] z-50 rounded-2xl border border-white/10 bg-ink-900/95 backdrop-blur-md shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
          // min height 56 per the spec — leaves room for 44-px buttons.
          "min-h-[56px]",
          // On sm+ become a normal inline strip, no fixed positioning.
          "sm:static sm:left-auto sm:right-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 sm:justify-between sm:px-0 sm:py-4 sm:border-t sm:border-ink-700">
          {/* Status pill hidden on mobile — the same pill is rendered
              inside the page above, and the third action button (SMS)
              left no horizontal room. Shows again from sm: upward. */}
          <span
            data-testid="sticky-status-pill"
            className={`hidden sm:inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${pill.cls}`}
          >
            {pill.label}
          </span>

          {/* Mobile: short labels ALWAYS visible next to each icon so
              the tradie reads "Save / Email / Text" at a glance instead
              of decoding 3 similar-looking icons. Earlier icon-only
              treatment hit a clarity problem (user feedback: "tradies
              don't know what's what"). Labels are short — "Text"
              instead of "SMS" because that's what NZ tradies actually
              call it. min-h-[44px] keeps the iOS tap-target spec. */}
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:flex-none sm:gap-2">
            <button
              type="button"
              data-testid="sticky-save-changes"
              onClick={onSave}
              disabled={isPending || isAccepted}
              title={isAccepted ? "Quote already accepted." : "Save changes"}
              className="t2q-btn-ghost-pro min-h-[44px] flex-1 !px-2 sm:flex-none sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FloppyDisk size={16} weight="bold" className="shrink-0" />
              <span>{isPending ? "Saving" : "Save"}</span>
              <span className="hidden sm:inline">{isPending ? "…" : " changes"}</span>
            </button>

            {!isAccepted && (
              <>
                <button
                  type="button"
                  data-testid="sticky-send-button"
                  onClick={handleSend}
                  disabled={sendBusy || isPending}
                  title={
                    sendBusy && activeChannel === "email"
                      ? "Sending email…"
                      : isSentOrViewed
                        ? "Resend email"
                        : "Send email"
                  }
                  className="t2q-btn-primary-pro min-h-[44px] flex-1 !px-2 sm:flex-none sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <EnvelopeSimple size={16} weight="bold" className="shrink-0" />
                  <span>
                    {sendBusy && activeChannel === "email"
                      ? "Sending"
                      : isSentOrViewed
                        ? "Resend"
                        : "Email"}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="sticky-send-sms-button"
                  onClick={handleSendSms}
                  disabled={sendBusy || isPending}
                  aria-label={
                    sendBusy && activeChannel === "sms"
                      ? "Sending text"
                      : isSentOrViewed
                        ? "Resend text"
                        : "Send text"
                  }
                  title={
                    sendBusy && activeChannel === "sms"
                      ? "Sending text…"
                      : isSentOrViewed
                        ? "Resend text"
                        : "Send text"
                  }
                  className="t2q-btn-ghost-pro min-h-[44px] flex-1 !px-2 sm:flex-none sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChatCircleText size={16} weight="bold" className="shrink-0" />
                  <span>
                    {sendBusy && activeChannel === "sms"
                      ? "Sending"
                      : isSentOrViewed
                        ? "Resend"
                        : "Text"}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
