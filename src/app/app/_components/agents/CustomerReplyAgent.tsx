"use client";

import { useState } from "react";
import {
  ChatCircle,
  CheckCircle,
  Warning,
  PaperPlaneTilt,
  Spinner,
} from "@phosphor-icons/react";
import { CopyButton } from "./CopyButton";
import type {
  CustomerIntent,
  CustomerReplyResult,
} from "@/lib/agents/customer-reply";

/**
 * Customer Reply Agent — paste a customer message, get a draft reply.
 *
 * Real backend: POSTs to `/api/agents/customer-reply` which calls
 * Anthropic Claude. Detects intent (price push-back, timing, scope
 * change, accept, reject, invoice ask, general) and drafts a reply
 * the tradie can copy and send themselves. Never sends.
 *
 * States: empty → submitting → result | error.
 */
interface Props {
  /** Optional quote context to improve the reply quality. */
  quote?: {
    client_name?: string | null;
    job_summary?: string | null;
    total?: number | null;
    currency?: string | null;
    status?: string | null;
  } | null;
  businessName?: string | null;
}

const INTENT_LABELS: Record<CustomerIntent, string> = {
  wants_cheaper_price: "Wants cheaper price",
  asks_for_timing: "Asking about timing",
  asks_for_scope_change: "Wants scope change",
  accepts_quote: "Accepting the quote",
  rejects_quote: "Rejecting the quote",
  asks_for_invoice: "Asking for invoice",
  general_question: "General question",
};

export function CustomerReplyAgent({ quote, businessName }: Props) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CustomerReplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = message.trim().length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/customer-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerMessage: message,
          quote: quote ?? null,
          businessName: businessName ?? null,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; result: CustomerReplyResult }
        | { error: string };
      if (!res.ok || !("ok" in json)) {
        setError(("error" in json && json.error) || `Request failed (${res.status})`);
      } else {
        setResult(json.result);
      }
    } catch (err) {
      setError((err as Error).message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      data-testid="customer-reply-agent"
      className="t2q-card-pro p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
          <ChatCircle size={20} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Customer Reply Agent
          </h2>
          <p className="mt-1 text-sm text-ink-300">
            Paste a customer message. We&apos;ll detect what they&apos;re asking and draft a
            reply for you to send manually.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Customer message
          </span>
          <textarea
            data-testid="customer-reply-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Hi mate, that quote came in a bit higher than we hoped — any wiggle room?"'
            rows={6}
            maxLength={8000}
            className="mt-2 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-brand focus:outline-none"
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {message.trim().length} / 8000
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="customer-reply-submit"
            className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-4 font-display text-sm uppercase tracking-tight text-ink-900 transition-colors hover:bg-hivis disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400"
          >
            {submitting ? (
              <>
                <Spinner size={14} weight="bold" className="animate-spin" />
                Drafting…
              </>
            ) : (
              <>
                <PaperPlaneTilt size={14} weight="bold" />
                Draft reply
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          data-testid="customer-reply-error"
          className="mt-5 rounded-sm border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200"
        >
          <Warning size={14} weight="bold" className="mr-1 inline-block" />
          {error}
        </div>
      )}

      {result && (
        <div data-testid="customer-reply-result" className="mt-5 space-y-4">
          <div className="rounded-sm border border-ink-600 bg-ink-900/60 p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
              <CheckCircle size={12} weight="bold" className="text-brand" />
              Detected intent
            </div>
            <p className="mt-1 font-display text-base uppercase tracking-tight text-white">
              {INTENT_LABELS[result.intent]}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                · {Math.round(result.confidence * 100)}% confidence
              </span>
            </p>
            {result.reasoning && (
              <p className="mt-2 text-sm text-ink-300">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  {"// why · "}
                </span>
                {result.reasoning}
              </p>
            )}
          </div>

          <div className="rounded-sm border border-ink-600 bg-ink-900/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                Reply draft
              </span>
              <CopyButton
                text={result.replyDraft}
                testId="customer-reply-copy"
                label="Copy reply"
              />
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-100">
              {result.replyDraft}
            </pre>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-ink-500">
              {"// review before you send · we never send for you"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
