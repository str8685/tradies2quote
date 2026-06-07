"use client";

// Willa draft review — READ-ONLY panel (v1). Shows the drafted customer message
// with reason + suggested channel, and Copy / Dismiss. Deliberately has NO send
// wiring: customer messages require review and are never sent by this system.
// The tradie copies the text and sends it themselves from their own SMS/email.

import { useState } from "react";
import { ChatText, Copy, Check, X } from "@phosphor-icons/react";

interface Props {
  channel: "sms" | "email" | "none";
  message: string;
  reason: string;
}

export function WillaDraftReview({ channel, message, reason }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  if (!message) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/15"
        aria-expanded={open}
      >
        <ChatText size={14} weight="bold" />
        {open ? "Hide Willa draft" : "Review Willa draft"}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">
              {"// draft · "}
              {channel === "none" ? "no channel" : channel}
              {" · review before sending"}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Dismiss draft"
              className="text-ink-400 hover:text-white"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          {reason ? <p className="mt-2 text-xs text-ink-300">{reason}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white">{message}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-brand/40 hover:text-brand"
          >
            {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
