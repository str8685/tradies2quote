"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Warning, X } from "@phosphor-icons/react/dist/ssr";

/**
 * Lightweight, dismissible beta safety reminder.
 *
 * Shows once per browser session on the first /app load, then stays
 * dismissed for the rest of the session (sessionStorage — no DB, no server
 * flag). Mounted in the /app layout, which persists across client
 * navigation, so it does NOT re-pop on every route change. Versioned key so
 * a meaningful beta update can re-surface it later.
 *
 * Renders nothing on the server / first client paint (visible starts false),
 * then the effect decides — so there's no hydration mismatch and no flash
 * for users who already dismissed it.
 */
const STORAGE_KEY = "t2q-beta-notice-dismissed-v1";

export function BetaNoticeBanner() {
  const [visible, setVisible] = useState(false);

  // Decide visibility after mount (deferred via setTimeout, mirroring
  // AppSplash) so we never set state directly in the effect body and there's
  // no hydration mismatch — server + first client paint render nothing.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
      } catch {
        // sessionStorage unavailable (private mode etc.) — show it; it just
        // won't persist dismissal, the safe default for a reminder.
        setVisible(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore — nothing to persist to */
    }
  }

  return (
    <div
      data-testid="beta-review-notice"
      className="border-b border-hivis/30 bg-hivis/[0.07] px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-xs text-ink-200">
          <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-hivis" />
          <span className="min-w-0">
            <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis">
              {"// beta"}
            </span>
            You&apos;re on the Tradies2Quote beta — the app flags the risky
            stuff, but you&apos;re the final check. Review every quote
            (materials, quantities, prices) before you send it.
          </span>
        </p>
        <Link
          href="/app/beta"
          data-testid="beta-review-link"
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-brand hover:text-white"
        >
          Read before sending quotes →
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss beta notice"
          data-testid="beta-review-dismiss"
          className="shrink-0 rounded-sm p-0.5 text-ink-400 hover:text-white"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
