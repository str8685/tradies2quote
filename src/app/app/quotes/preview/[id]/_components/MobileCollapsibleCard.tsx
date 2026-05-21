"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

/**
 * Wave 19.10 — mobile-collapsible section wrapper.
 *
 * Below md:
 *   - Renders a flat summary row (44-px+ tap target) with a chevron.
 *   - Body (children — typically an existing `t2q-card-pro` section) is
 *     hidden until the user taps the row open.
 *   - State persists in sessionStorage so a reload keeps the operator
 *     where they were.
 *
 * md+ :
 *   - The summary row is hidden via `md:hidden`. Children render
 *     directly as the always-visible card they already are.
 *
 * Crucially this component is NOT itself a `t2q-card-pro`. The children
 * keep their existing card styling, so wrapping legacy sections does
 * not create card-in-card visuals. On mobile we render one flat
 * summary bar, then either zero or one card below it.
 *
 * SSR-safe: starts closed on first render. The client effect hydrates
 * from sessionStorage after mount.
 */
interface Props {
  /** Stable id used as the sessionStorage key + aria-controls anchor. */
  sectionId: string;
  /** Big section title — matches the Photo/Plan + Takeoff panel headers. */
  title: string;
  /** Single-line detail rendered small under the title on mobile. */
  summary: string;
  /** Visible-on-mobile-only children. */
  children: ReactNode;
}

const STORAGE_PREFIX = "t2q-collapse-";

export function MobileCollapsibleCard({
  sectionId,
  title,
  summary,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  // Hydrate from sessionStorage after mount. Wrap the setState in a
  // 0-ms timer so it lives inside a subscribed callback (matches the
  // pattern in LoadingScreen / OnboardingTourGate for the React 19
  // `react-hooks/set-state-in-effect` rule).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = sessionStorage.getItem(`${STORAGE_PREFIX}${sectionId}`);
        if (v === "open") setOpen(true);
      } catch {
        /* sessionStorage unavailable — stay collapsed. */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [sectionId]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(
          `${STORAGE_PREFIX}${sectionId}`,
          next ? "open" : "closed",
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div data-testid={`mc-${sectionId}`} data-open={open ? "true" : "false"}>
      {/* Mobile summary row. Hidden on md+ where the children's own
          card surfaces the section header inline. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`mc-body-${sectionId}`}
        data-testid={`mc-toggle-${sectionId}`}
        className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-sm border border-ink-700 border-l-4 border-l-brand bg-ink-900/60 px-4 py-3.5 text-left transition-colors hover:border-ink-500 md:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl uppercase tracking-tight text-white">
            {title}
          </span>
          <span
            data-testid={`mc-summary-${sectionId}`}
            className="mt-1 block truncate font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400"
          >
            {summary}
          </span>
        </span>
        <CaretDown
          size={18}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-brand" : "text-ink-300"}`}
        />
      </button>

      <div
        id={`mc-body-${sectionId}`}
        // Mobile: hidden until `open`. md+: always block. The small
        // top margin only applies on mobile when the section opens
        // so the existing card sits comfortably below the summary.
        className={`${open ? "mt-3" : "hidden"} md:!mt-0 md:!block`}
      >
        {children}
      </div>
    </div>
  );
}
