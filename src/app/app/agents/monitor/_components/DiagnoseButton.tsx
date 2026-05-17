"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Lightning,
  X,
} from "@phosphor-icons/react/dist/ssr";

/**
 * "Diagnose" button shown on the monitor page for runs that failed or
 * are stuck. Clicking opens a side-sheet that POSTs to
 * /api/agents/diagnose with the run id and renders the markdown analysis
 * Claude returns. PII-safe by design — only the run row + that run's
 * events leave the browser; user emails / quote data never enter the
 * prompt.
 *
 * Markdown is rendered with a hand-rolled minimal converter (bold +
 * paragraphs + line breaks) — Claude's triage output uses a tiny
 * subset of markdown so a full markdown lib would be overkill for
 * one panel.
 */
type Props = {
  runId: string;
};

type State = "idle" | "loading" | "ready" | "error";

export function DiagnoseButton({ runId }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [diagnosis, setDiagnosis] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function diagnose() {
    setState("loading");
    setErrorMsg("");
    setDiagnosis("");
    try {
      const res = await fetch("/api/agents/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        diagnosis?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.diagnosis) {
        setErrorMsg(data.message ?? "Diagnose failed.");
        setState("error");
        return;
      }
      setDiagnosis(data.diagnosis);
      setState("ready");
    } catch {
      setErrorMsg("Network error talking to /api/agents/diagnose.");
      setState("error");
    }
  }

  function openPanel() {
    setOpen(true);
    if (state === "idle") void diagnose();
  }

  function closePanel() {
    setOpen(false);
  }

  async function copyDiagnosis() {
    try {
      await navigator.clipboard.writeText(diagnosis);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — soft-fail; user can still select + copy.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        data-testid={`monitor-run-diagnose-${runId}`}
        className="inline-flex items-center gap-1.5 rounded-sm border border-brand/40 bg-brand/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-brand hover:border-brand hover:bg-brand hover:text-ink-900"
      >
        <Lightning size={12} weight="bold" />
        Diagnose
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Run diagnosis"
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/70 backdrop-blur-sm"
          onClick={closePanel}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-ink-700 bg-ink-950 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-ink-700 bg-ink-950 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
                  {"// triage"}
                </p>
                <h2 className="mt-0.5 font-display text-base uppercase tracking-tight text-white sm:text-lg">
                  Diagnose run
                </h2>
                <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                  run {runId.slice(-8)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close diagnose panel"
                className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-400 hover:text-white"
              >
                <X size={18} weight="bold" />
              </button>
            </header>

            <div
              data-testid={`diagnose-body-${runId}`}
              className="flex-1 overflow-y-auto px-5 py-5"
            >
              {state === "loading" && (
                <div className="flex items-center gap-2 text-sm text-ink-300">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand"
                  />
                  Claude is reading the run + events…
                </div>
              )}

              {state === "error" && (
                <p
                  data-testid={`diagnose-error-${runId}`}
                  className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {errorMsg}
                </p>
              )}

              {state === "ready" && (
                <div
                  data-testid={`diagnose-text-${runId}`}
                  className="prose-diagnose"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: renderTriageMarkdown(diagnosis),
                  }}
                />
              )}
            </div>

            {(state === "ready" || state === "error") && (
              <footer className="flex items-center justify-between gap-2 border-t border-ink-700 bg-ink-950 px-5 py-3">
                <button
                  type="button"
                  onClick={diagnose}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
                >
                  Re-run
                </button>
                {state === "ready" && (
                  <button
                    type="button"
                    onClick={copyDiagnosis}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:border-brand hover:text-brand"
                  >
                    {copied ? (
                      <Check size={12} weight="bold" />
                    ) : (
                      <Copy size={12} weight="bold" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Minimal markdown → HTML for Claude's triage output. Claude emits a
 * known subset (paragraphs, **bold**, blank lines for breaks) — full
 * markdown libs add bundle weight for no extra value here. HTML is
 * escaped first to prevent XSS, then the small set of formatting rules
 * is applied.
 */
function renderTriageMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const withBold = escaped.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="text-white font-display uppercase tracking-tight">$1</strong>',
  );
  const paragraphs = withBold
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p class="text-sm text-ink-200 leading-relaxed mb-3 last:mb-0">${p.replace(
          /\n/g,
          "<br/>",
        )}</p>`,
    )
    .join("");
  return paragraphs;
}
