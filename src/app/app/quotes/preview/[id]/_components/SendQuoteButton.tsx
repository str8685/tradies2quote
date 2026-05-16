"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
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
  no_line_items: "Add at least one line item before sending.",
  total_zero: "Quote total must be greater than zero.",
  already_accepted: "This quote has already been accepted.",
  pdf_generation_failed: "Could not generate the PDF.",
  pdf_upload_failed: "Could not save the PDF.",
  email_not_configured: "Email isn't configured. Ask your admin to set RESEND_API_KEY.",
  email_from_not_configured: "Email sender isn't configured. Set RESEND_FROM_EMAIL.",
  update_failed: "Email sent but the quote status couldn't update.",
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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copyOk, setCopyOk] = useState(false);

  const acceptUrl =
    publicToken && typeof window !== "undefined"
      ? `${window.location.origin}/quote/${publicToken}`
      : null;

  async function handleSend() {
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
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: "POST",
      });
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
          <a
            href={`/api/quotes/${quoteId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
          >
            <FileText size={12} weight="bold" />
            View PDF
          </a>
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
            {"// quote sent"}
          </p>
        )}
        {!isAccepted && !hideSendButton && (
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
            {state === "saving"
              ? "Saving edits…"
              : state === "generating"
                ? "Generating PDF…"
                : state === "sending"
                  ? "Sending email…"
                  : isSentOrViewed
                    ? "Resend quote"
                    : "Send quote"}
          </button>
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
