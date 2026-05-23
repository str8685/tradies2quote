"use client";

import { useState, useTransition } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { acknowledgeExtraction } from "../actions";

/**
 * Owner-only "mark handled" control for a flagged extraction. Calls the
 * server action, which stamps `extraction_reviewed_at` and revalidates the
 * queue so the row drops out of the default view.
 */
export function AcknowledgeButton({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");

  function handle() {
    setError("");
    startTransition(async () => {
      const r = await acknowledgeExtraction(quoteId);
      if ("error" in r) setError(r.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={isPending}
        data-testid="extraction-mark-handled"
        className="inline-flex items-center gap-1 rounded-sm border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-200 hover:border-brand/50 hover:text-white disabled:opacity-50"
      >
        <Check size={10} weight="bold" />
        {isPending ? "saving…" : "mark handled"}
      </button>
      {error && <span className="text-[10px] text-red-300">{error}</span>}
    </span>
  );
}
