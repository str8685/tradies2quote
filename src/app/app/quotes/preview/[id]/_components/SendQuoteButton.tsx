"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  ChatCircleText,
  Check,
  Copy,
  EnvelopeSimple,
  FileText,
} from "@phosphor-icons/react/dist/ssr";
import type { QuoteStatus } from "@/lib/quote-types";

type Props = {
  quoteId: string;
  status: QuoteStatus;
  publicToken: string | null;
  hasPdf: boolean;
  onSaveBeforeSend?: () => Promise<boolean>;
  /**
   * Wave 19.10 — when true, the inline Send button is suppressed so
   * the StickyActionBar can own the primary send action. Link / PDF
   * affordances (status pill, public link, copy) still render so the
   * operator can manage a sent quote without the duplicate trigger.
   */
  hideSendButton?: boolean;
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

export function SendQuoteButton({
  quoteId,
  status,
  publicToken,
  hasPdf,
  onSaveBeforeSend,
  hideSendButton = false,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<SendState>("idle");
  const [activeChannel, setActiveChannel] = useState<"email" | "sms">("email");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copyOk, setCopyOk] = useState(false);

  const acceptUrl =
    publicToken && typeof window !== "undefined"
      ? `${window.location.origin}/quote/${publicToken}`
      : null;

  async function sendVia(channel: "email" | "sms") {
    setActiveChannel(channel);
    setErrorMessage("");
    if (onSaveBeforeSend) {
      setState("saving");
      const saved = await onSaveBeforeSend();
      if (!saved) {
        setErrorMessage("Could not save your latest edits.");
        setState("error");
        return;
      }
    }
    setState("generating");
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
        setErrorMessage(data.message ?? ERROR_COPY[code] ?? "Could not send the quote.");
        setState("error");
        return;
      }
      setState("sent");
      router.refresh();
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  }

  const handleSend = () => sendVia("email");
  const handleSendSms = () => sendVia("sms");

  async function copyAcceptLink() {
    if (!acceptUrl) return;
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // Clipboard API blocked (insecure context / denied permission) —
      // open the link in a new tab so the operator can still grab it.
      window.open(acceptUrl, "_blank", "noopener,noreferrer");
    }
  }

  const isAccepted = status === "accepted";
  const isSentOrViewed = status === "sent" || status === "viewed";

  return (
    <div data-testid="send-quote" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} />
        {hasPdf && (
          // Wave 36 — link to the in-app PDF wrapper page (back button +
          // iframe) instead of the raw binary route. Same-tab navigation
          // so the browser's back button + the wrapper's "Back to quote"
          // header both work; was target="_blank" which on iOS Safari
          // showed the native PDF viewer with no obvious way back.
          <Link
            href={`/app/quotes/preview/${quoteId}/pdf`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
          >
            <FileText size={12} weight="bold" />
            View PDF
          </Link>
        )}
        {publicToken && acceptUrl && (
          <>
            <a
              href={acceptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
            >
              <ArrowSquareOut size={12} weight="bold" />
              Public link
            </a>
            <button
              type="button"
              onClick={copyAcceptLink}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
            >
              {copyOk ? <Check size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
              {copyOk ? "Copied" : "Copy link"}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {state === "error" && (
          <p
            data-testid="send-error"
            // Wave 36 — solid background. Transparent 10%-alpha shells
            // were invisible on the cream light-mode page.
            className="rounded-sm border border-red-600 bg-red-600 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white shadow"
          >
            {errorMessage}
          </p>
        )}
        {state === "sent" && (
          <p className="rounded-sm border border-brand bg-brand px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-900 shadow">
            {activeChannel === "sms" ? "// sms sent" : "// quote sent"}
          </p>
        )}
        {!isAccepted && !hideSendButton && (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              data-testid="send-button"
              onClick={handleSend}
              disabled={
                state === "saving" ||
                state === "generating" ||
                state === "sending"
              }
              className="t2q-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <EnvelopeSimple size={18} weight="bold" />
              {state !== "idle" && state !== "error" && state !== "sent" && activeChannel === "email"
                ? state === "saving"
                  ? "Saving edits…"
                  : state === "generating"
                    ? "Generating PDF…"
                    : "Sending email…"
                : isSentOrViewed
                  ? "Resend email"
                  : "Send email"}
            </button>
            <button
              type="button"
              data-testid="send-sms-button"
              onClick={handleSendSms}
              disabled={
                state === "saving" ||
                state === "generating" ||
                state === "sending"
              }
              className="t2q-btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChatCircleText size={18} weight="bold" />
              {state !== "idle" && state !== "error" && state !== "sent" && activeChannel === "sms"
                ? state === "saving"
                  ? "Saving edits…"
                  : state === "generating"
                    ? "Generating PDF…"
                    : "Sending SMS…"
                : isSentOrViewed
                  ? "Resend SMS"
                  : "Send SMS"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: QuoteStatus }) {
  const map: Record<QuoteStatus, { label: string; color: string }> = {
    draft: { label: "Draft", color: "border-ink-600 bg-ink-800 text-ink-300" },
    sent: { label: "Sent", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
    viewed: { label: "Viewed", color: "border-hivis/40 bg-hivis/10 text-hivis" },
    accepted: { label: "Accepted", color: "border-brand/40 bg-brand/10 text-brand" },
    // Wave 13 — lifecycle stages past acceptance.
    scheduled: { label: "Scheduled", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
    in_progress: { label: "In progress", color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    completed: { label: "Completed", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
    declined: { label: "Declined", color: "border-red-500/40 bg-red-500/10 text-red-300" },
    expired: { label: "Expired", color: "border-ink-600 bg-ink-800 text-ink-400" },
  };
  const { label, color } = map[status] ?? map.draft;
  return (
    <span
      data-testid="status-pill"
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${color}`}
    >
      {label}
    </span>
  );
}
