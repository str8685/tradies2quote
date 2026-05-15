"use client";

import TapeProgress from "../landing/TapeProgress";

/**
 * Reusable full-screen "Claude is reading your transcript" loader.
 *
 * Visual only. Composes the existing landing `TapeProgress` measuring-tape
 * gauge into a centered full-bleed layout matching the screenshot from
 * the Emergent makeover. NOT mounted into `QuoteInputTabs` (which has
 * its own real processing state) — this component is exported for
 * future wiring or for use on a demo page.
 *
 * Props let callers control:
 *   - `progress`: 0–1 to drive the tape gauge in determinate mode. Omit
 *     for indeterminate sweep.
 *   - `label`: header eyebrow ("// reading transcript" by default).
 *   - `title`: large primary line.
 *   - `body`: secondary copy underneath.
 */
type Props = {
  progress?: number;
  label?: string;
  title?: string;
  body?: string;
  /** Only renders when true. Otherwise the component returns null so it
   *  can be conditionally mounted from a parent without `&&` noise. */
  open?: boolean;
};

export function TapeTranscriptLoader({
  progress,
  label = "// reading transcript",
  title = "// T2Q is reading your transcript…",
  body = "Cleaning the words, working out dimensions, flagging compliance risks. Takes ~10s.",
  open = true,
}: Props) {
  if (!open) return null;

  return (
    <div
      data-testid="tape-transcript-loader"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[90] grid place-items-center bg-ink-950"
    >
      <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-40 -right-32 h-[460px] w-[460px] rounded-full bg-brand/15 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-hivis/10 blur-3xl animate-blob-slow" />

      <div className="relative w-full max-w-2xl px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mb-6">
          {label}
        </div>

        <div className="mx-auto inline-block">
          <TapeProgress
            progress={progress}
            width={420}
            height={44}
            label={label}
          />
        </div>

        <h2 className="mt-10 font-display text-2xl sm:text-3xl uppercase tracking-tighter leading-[0.95]">
          {title}
        </h2>
        <p className="mt-4 mx-auto max-w-md text-sm sm:text-base text-ink-300 leading-relaxed">
          {body}
        </p>

        <div className="mt-8 inline-flex items-center gap-2 border border-ink-600 bg-ink-900/60 px-3 py-1.5 rounded-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-200">
            {"// demo · no real ai call"}
          </span>
        </div>
      </div>
    </div>
  );
}
