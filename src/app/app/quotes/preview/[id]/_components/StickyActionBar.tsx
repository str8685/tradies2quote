"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChatCircleText,
  EnvelopeSimple,
  FloppyDisk,
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

  const isAccepted = status === "accepted";
  const isSentOrViewed = status === "sent" || status === "viewed";
  const sendBusy =
    sendState === "saving" ||
    sendState === "generating" ||
    sendState === "sending";

  async function sendVia(channel: "email" | "sms") {
    setActiveChannel(channel);
    setErrorMessage("");
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
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        const code = data.error ?? "send_failed";
        setErrorMessage(
          data.message ?? ERROR_COPY[code] ?? "Could not send the quote.",
        );
        setSendState("error");
        return;
      }
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
          className="fixed inset-x-0 bottom-[150px] z-50 mx-auto max-w-3xl px-4 sm:static sm:bottom-auto sm:max-w-none sm:px-0"
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

      <div
        data-testid="sticky-action-bar"
        className={[
          // Mobile fixed bar sitting flush on top of the bottom nav.
          // The nav is 57px (56px tile + 1px border) plus its own
          // safe-area padding-bottom, so `bottom` mirrors that exact
          // formula — no floating gap, no overlap, on any device.
          // Wave 36 — solid bg (was bg-ink-950/85). 85%-alpha was
          // letting page content show through on light mode, which
          // read as a floating translucent strip; solid + shadow now
          // reads as a locked-in toolbar.
          "fixed inset-x-0 bottom-[calc(57px_+_max(env(safe-area-inset-bottom)_-_24px,4px))] z-50 border-t border-ink-700/70 bg-ink-950 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.35)]",
          // min height 56 per the spec — leaves room for 44-px buttons.
          "min-h-[56px]",
          // On sm+ become a normal inline strip, no fixed positioning.
          "sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none",
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

          {/* Mobile: icon-only square 44px tap-targets so 3 actions
              + the status pill (when shown) ALWAYS fit on a 360px screen.
              Each button gets an aria-label for screen readers and a
              title for desktop hover; visible labels only appear from
              sm: upward. This is the definitive overflow fix — earlier
              attempts with mobile text labels kept getting clipped on
              narrow viewports when status text grew (e.g. "Resend"). */}
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <button
              type="button"
              data-testid="sticky-save-changes"
              onClick={onSave}
              disabled={isPending || isAccepted}
              aria-label={isPending ? "Saving" : "Save changes"}
              title={isAccepted ? "Quote already accepted." : isPending ? "Saving…" : "Save changes"}
              className="t2q-btn-ghost min-h-[44px] min-w-[44px] !px-0 sm:flex-none sm:min-w-0 sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FloppyDisk size={16} weight="bold" className="shrink-0" />
              <span className="hidden sm:inline">
                {isPending ? "Saving…" : "Save changes"}
              </span>
            </button>

            {!isAccepted && (
              <>
                <button
                  type="button"
                  data-testid="sticky-send-button"
                  onClick={handleSend}
                  disabled={sendBusy || isPending}
                  aria-label={
                    sendBusy && activeChannel === "email"
                      ? "Sending email"
                      : isSentOrViewed
                        ? "Resend email"
                        : "Send email"
                  }
                  title={
                    sendBusy && activeChannel === "email"
                      ? "Sending email…"
                      : isSentOrViewed
                        ? "Resend email"
                        : "Send email"
                  }
                  className="t2q-btn-primary min-h-[44px] min-w-[44px] !px-0 sm:flex-none sm:min-w-0 sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <EnvelopeSimple size={16} weight="bold" className="shrink-0" />
                  <span className="hidden sm:inline">
                    {sendBusy && activeChannel === "email"
                      ? sendState === "saving"
                        ? "Saving edits…"
                        : sendState === "generating"
                          ? "Generating PDF…"
                          : "Sending email…"
                      : isSentOrViewed
                        ? "Resend email"
                        : "Send email"}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="sticky-send-sms-button"
                  onClick={handleSendSms}
                  disabled={sendBusy || isPending}
                  aria-label={
                    sendBusy && activeChannel === "sms"
                      ? "Sending SMS"
                      : isSentOrViewed
                        ? "Resend SMS"
                        : "Send SMS"
                  }
                  title={
                    sendBusy && activeChannel === "sms"
                      ? "Sending SMS…"
                      : isSentOrViewed
                        ? "Resend SMS"
                        : "Send SMS"
                  }
                  className="t2q-btn-ghost min-h-[44px] min-w-[44px] !px-0 sm:flex-none sm:min-w-0 sm:!px-7 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChatCircleText size={16} weight="bold" className="shrink-0" />
                  <span className="hidden sm:inline">
                    {sendBusy && activeChannel === "sms"
                      ? sendState === "saving"
                        ? "Saving edits…"
                        : sendState === "generating"
                          ? "Generating PDF…"
                          : "Sending SMS…"
                      : isSentOrViewed
                        ? "Resend SMS"
                        : "Send SMS"}
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
