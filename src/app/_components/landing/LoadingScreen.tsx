"use client";

import { useEffect, useRef, useState } from "react";
import TapeProgress from "./TapeProgress";
import { LogoMark } from "./Logo";

/**
 * Brand splash / loading screen.
 *
 * Shows on first visit each session, holds for ~1.7s while the tape-measure
 * progress bar fills 0 → 1m, then fades out. Skips entirely if the user
 * has already seen the splash for the given `storageKey` within the
 * last 6 hours (sessionStorage).
 *
 * Wave 13.2 — `storageKey` and `label` props added so the same splash
 * component can be mounted twice: once on the marketing landing
 * (`t2q-splash-shown`, default) and once on the owner app entry
 * (`t2q-app-splash-shown`). Each has its own session-skip state so a
 * tradie who saw the landing splash still sees the app splash on
 * first dashboard visit.
 *
 * Wave 17 — perf — framer-motion was the only /app-side use of that
 * library; removing it from this file drops the entire framer-motion
 * chunk off every /app/* page's bundle. The entrance + exit animations
 * are now driven by CSS classes defined in `globals.css`
 * (`.t2q-splash-*`), which are pure transform + opacity (GPU-cheap)
 * and respect `prefers-reduced-motion`. The visible/exit sequence is
 * still controlled by React state — when the tape hits 100mm we flip
 * `setFadingOut(true)` (CSS handles the opacity drop), then unmount
 * after FADE_MS via setTimeout so the markup leaves the DOM cleanly.
 *
 * The hero logo image is now rendered via `next/image` with `priority`
 * so the browser preloads it during HTML parsing — this image is the
 * LCP element of the splash screen and the priority hint saves ~50ms
 * of paint time on mobile.
 *
 * Ported from `landing-export/components/LoadingScreen.jsx`. We seed
 * `visible` on the client only — the first server-rendered HTML never
 * shows the splash, which avoids a hydration mismatch on
 * `sessionStorage` (which doesn't exist on the server).
 */
const DEFAULT_STORAGE_KEY = "t2q-splash-shown";
const DEFAULT_HOLD_MS = 1700;
const FADE_MS = 600;

interface Props {
  /** sessionStorage key — distinguish landing splash from app splash. */
  storageKey?: string;
  /** Optional override for the tape-measure caption. */
  tapeLabel?: string;
  /**
   * Wave 14.2 — how long the tape-measure fills from 0 → 100mm before
   * the splash fades. Default is 1.7s (landing splash, snappy). The
   * /app layout passes 5000ms so the tradie sees the full animation
   * once per session on dashboard entry.
   */
  holdMs?: number;
}

export default function LoadingScreen({
  storageKey = DEFAULT_STORAGE_KEY,
  tapeLabel = "// site setup",
  holdMs = DEFAULT_HOLD_MS,
}: Props = {}) {
  // Wave 15.2 — server-renders VISIBLE so the splash is the very first
  // thing painted on /app entry. The earlier `useState(false)` shape
  // caused a one-frame flash of the dashboard before the client-side
  // effect set visible=true. Now the effect's job is the opposite: if
  // the session-storage skip window applies, hide IMMEDIATELY so
  // repeat visits within 6h don't get the forced 5s wait.
  const [visible, setVisible] = useState(true);
  // Wave 17 — explicit fade-out + unmount states replace framer-motion's
  // <AnimatePresence>. `mounted` keeps the splash in the DOM through
  // the fade; we clear it FADE_MS after `visible` flips false.
  const [mounted, setMounted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    // Wrap in a 0-ms timer so the setState lives inside a subscribed
    // callback (React 19 `react-hooks/set-state-in-effect`).
    const t = setTimeout(() => {
      try {
        const last = Number(sessionStorage.getItem(storageKey) ?? 0);
        // Shown within the last 6h → skip. The brief fade-out is the
        // right UX hint that something was about to happen but isn't
        // needed.
        if (Date.now() - last <= 6 * 3600 * 1000) setVisible(false);
      } catch {
        // sessionStorage unavailable — keep the splash visible.
      }
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    if (!visible) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - startRef.current) / holdMs);
      setProgress(k);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        try {
          sessionStorage.setItem(storageKey, String(Date.now()));
        } catch {
          /* ignore */
        }
        setTimeout(() => setVisible(false), 120);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, storageKey, holdMs]);

  // Wave 17 — drives the CSS fade-out class + delayed unmount. Replaces
  // framer-motion's <AnimatePresence exit>.
  useEffect(() => {
    if (visible) return;
    setFadingOut(true);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={`t2q-splash-wrap fixed inset-0 z-[100] bg-ink-950 grid place-items-center${
        fadingOut ? " is-fading-out" : ""
      }`}
      data-testid="loading-screen"
    >
      <div className="absolute inset-0 t2q-grid-bg opacity-40" />
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand/15 blur-3xl animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-hivis/10 blur-3xl animate-blob-slow" />

      <div className="relative flex flex-col items-center px-6">
        {/* Wave 19.8 — splash logo swapped from the legacy
            logo-mark.png (which sat in a white pill on the dark
            splash) to the new T2Q SVG LogoMark. The SVG inherits
            text-white from the wrapper for the T and Q glyphs and
            the brand-orange 2 is hardcoded in the SVG, so we no
            longer need the white pill or the brand-glow shadow —
            it reads clean on the dark splash bg. Dropping the
            next/image import too; SVG is inlined into the document
            so no separate request and no LCP cost. */}
        <div className="t2q-splash-logo text-white">
          <LogoMark size={96} />
        </div>

        <div className="t2q-splash-title mt-6 font-display text-2xl sm:text-3xl uppercase tracking-tighter text-white text-center leading-[0.9]">
          TRADIES<span className="text-brand">2</span>QUOTE
        </div>

        <div className="t2q-splash-tagline mt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-brand">
          voice · quote · invoice · paid
        </div>

        {/* Wave 16.2 — tape fade-in delay removed.
            Previously delay:0.7 caused the tape to appear ~700ms
            after mount, by which time `progress` had already
            counted up to ~14% — so the orange fill + 0→100mm
            readout looked like they "jumped in" already partly
            filled. Now the tape mounts at progress=0 alongside
            the logo, so the orange and the numbers visibly count
            up together from zero. */}
        <div className="t2q-splash-tape mt-10">
          <TapeProgress
            progress={progress}
            width={340}
            height={36}
            label={tapeLabel}
          />
        </div>

        <div className="t2q-splash-caption mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">
          measuring up · loading the tools
        </div>
      </div>
    </div>
  );
}
