"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, X } from "@phosphor-icons/react/dist/ssr";

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
      className="border-b border-white/[0.06] bg-ink-950/92 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand"
        >
          <ShieldCheck size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
              Beta review
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-ink-600 sm:inline-block" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
              Human approval required
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-200">
            Tradies2Quote is in beta. Treat AI-generated scopes, quantities,
            materials, and prices as draft recommendations, and review each
            quote before sending it to a client.
          </p>
        </div>
        <Link
          href="/app/beta"
          data-testid="beta-review-link"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-200 transition-colors hover:border-brand/40 hover:text-brand sm:inline-flex"
        >
          Beta guide
          <ArrowRight size={12} weight="bold" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss beta notice"
          data-testid="beta-review-dismiss"
          className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
      <div className="mx-auto mt-2 max-w-5xl pl-12 sm:hidden">
        <Link
          href="/app/beta"
          data-testid="beta-review-link-mobile"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-brand hover:text-white"
        >
          Open beta guide
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
