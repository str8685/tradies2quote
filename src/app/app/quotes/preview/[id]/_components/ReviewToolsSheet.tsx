"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { X, Wrench } from "@phosphor-icons/react";

/**
 * Wave 19.10 — Review Tools wrapper.
 *
 * Below md:
 *   - Renders a single "Open review tools" button. Tapping it opens
 *     a bottom sheet containing every panel (Quote Review, Compliance,
 *     Voice Cleanup, Follow-up, Transcript, Compliance Review).
 *
 * md+ :
 *   - Renders children inline as they were in the previous layout.
 *
 * The bottom sheet uses a fixed overlay + slide-up panel. Esc and
 * backdrop click close. Body scroll is locked while the sheet is
 * open so the operator can scroll the sheet's own content without
 * the page underneath drifting.
 */
interface Props {
  /** Mounted-only-when-mobile-open. The same node also renders inline
   *  on md+ via the CSS-only branch. */
  children: ReactNode;
}

export function ReviewToolsSheet({ children }: Props) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onBackdropKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      {/* Mobile trigger — replaces the entire review tools card below md. */}
      <button
        type="button"
        data-testid="open-review-tools"
        onClick={() => setOpen(true)}
        className="mt-8 flex w-full min-h-[56px] items-center justify-between gap-3 rounded-sm border border-brand/40 bg-brand/5 px-4 py-3 text-left transition-colors hover:bg-brand/10 md:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
            <Wrench size={18} weight="bold" />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-base uppercase tracking-tight text-white">
              Review tools
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
              {"// tap to open · 6 panels inside"}
            </span>
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
          Open
        </span>
      </button>

      {/* Desktop inline — keeps the existing layout. */}
      <section
        data-testid="review-tools-inline"
        className="mt-8 hidden rounded-sm border border-brand/40 bg-brand/5 p-4 sm:p-5 md:block"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="t2q-section-label !text-brand">{"// review tools"}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-200">
            Quote-bound agents.
          </p>
        </div>
        {children}
      </section>

      {/* Mobile bottom sheet — only renders when open. */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review tools"
          data-testid="review-tools-sheet"
          tabIndex={-1}
          onKeyDown={onBackdropKey}
          className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="t2q-card flex max-h-[90vh] w-full flex-col rounded-b-none rounded-t-md border-b-0 border-brand/40 bg-ink-950 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
                  <Wrench size={16} weight="bold" />
                </span>
                <span className="font-display text-base uppercase tracking-tight text-white">
                  Review tools
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close review tools"
                data-testid="close-review-tools"
                className="grid h-11 w-11 place-items-center rounded-sm border border-ink-700 text-ink-300 hover:border-brand hover:text-brand"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
