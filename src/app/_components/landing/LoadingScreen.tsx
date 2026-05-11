"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TapeProgress from "./TapeProgress";

/**
 * Brand splash / loading screen.
 *
 * Shows on first visit each session, holds for ~1.7s while the tape-measure
 * progress bar fills 0 → 1m, then fades out. Skips entirely if the user
 * has already seen it within the last 6 hours (sessionStorage).
 *
 * Ported from `landing-export/components/LoadingScreen.jsx`. We seed
 * `visible` on the client only — the first server-rendered HTML never
 * shows the splash, which avoids a hydration mismatch on
 * `sessionStorage` (which doesn't exist on the server).
 */
const STORAGE_KEY = "t2q-splash-shown";
const HOLD_MS = 1700;
const FADE_MS = 600;

export default function LoadingScreen() {
  // Server-side: hidden. Client-side: an effect decides whether to show.
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    // Wrap in a 0-ms timer so the setState lives inside a subscribed
    // callback (React 19 `react-hooks/set-state-in-effect`).
    const t = setTimeout(() => {
      try {
        const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
        if (Date.now() - last > 6 * 3600 * 1000) setVisible(true);
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - startRef.current) / HOLD_MS);
      setProgress(k);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        try {
          sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        setTimeout(() => setVisible(false), 120);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] bg-ink-950 grid place-items-center"
          data-testid="loading-screen"
        >
          <div className="absolute inset-0 t2q-grid-bg opacity-40" />
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand/15 blur-3xl animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-hivis/10 blur-3xl animate-blob-slow" />

          <div className="relative flex flex-col items-center px-6">
            {/* Wave 10.4 — splash now wears the new T2Q PNG mark.
                The mark sits inside a small white-pill card with a
                brand-orange glow shadow so the dark T/Q glyphs stay
                readable against the dark splash background, without
                turning into a hard white square. */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.55, ease: [0.21, 0.61, 0.27, 1] }}
              className="rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_48px_-12px_rgba(255,95,21,0.35)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="Tradies2Quote"
                width={160}
                height={136}
                className="block h-20 w-auto sm:h-24"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-6 font-display text-2xl sm:text-3xl uppercase tracking-tighter text-white text-center leading-[0.9]"
            >
              tradies<span className="text-brand">²</span>Quote
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-brand"
            >
              voice · quote · invoice · paid
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-10 origin-center"
            >
              <TapeProgress
                progress={progress}
                width={340}
                height={36}
                label="// site setup"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400"
            >
              measuring up · loading the tools
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
