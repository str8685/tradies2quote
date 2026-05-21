"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "../../_components/landing/Logo";

/**
 * App-only splash / loading screen — soft-serif "Stowe" aesthetic.
 *
 * Replaces the shared landing `LoadingScreen` on /app entry so the app
 * can have its own calm, refined splash (serif wordmark, muted tagline,
 * thin gradient progress line + breathing dots) without touching the
 * marketing landing's brutalist tape-measure splash, which lives in the
 * off-limits `_components/landing/` directory.
 *
 * Behaviour mirrors LoadingScreen: server-renders VISIBLE so it's the
 * first paint on /app entry, holds for `holdMs` while the progress line
 * fills, then fades out. Skips entirely (hides immediately) if the user
 * saw it for this `storageKey` within the last 6h (sessionStorage). Uses
 * the shared `.t2q-splash-*` CSS animation classes from globals.css.
 */
const DEFAULT_STORAGE_KEY = "t2q-app-splash-shown";
const DEFAULT_HOLD_MS = 2200;
const FADE_MS = 600;
const SKIP_WINDOW_MS = 6 * 3600 * 1000;

interface Props {
  storageKey?: string;
  tagline?: string;
  holdMs?: number;
}

export default function AppSplash({
  storageKey = DEFAULT_STORAGE_KEY,
  tagline = "Voice in. Quote out.",
  holdMs = DEFAULT_HOLD_MS,
}: Props = {}) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);

  // Skip the forced hold if shown within the last 6h.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const last = Number(sessionStorage.getItem(storageKey) ?? 0);
        if (Date.now() - last <= SKIP_WINDOW_MS) setVisible(false);
      } catch {
        /* sessionStorage unavailable — keep the splash visible. */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  // Drive the progress line 0 → 1, then mark seen + start the fade.
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

  // Fade-out + delayed unmount.
  useEffect(() => {
    if (visible) return;
    const fade = setTimeout(() => setFadingOut(true), 0);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(t);
    };
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={`t2q-splash-wrap fixed inset-0 z-[100] grid place-items-center${
        fadingOut ? " is-fading-out" : ""
      }`}
      data-testid="app-splash"
      style={{
        background:
          "radial-gradient(70% 55% at 50% 18%, rgba(255,95,21,0.16) 0%, transparent 60%)," +
          "radial-gradient(80% 60% at 50% 110%, rgba(255,234,0,0.06) 0%, transparent 60%)," +
          "linear-gradient(180deg, #0E0E10 0%, #0A0A0A 60%)",
      }}
    >
      <div className="relative flex flex-col items-center px-8 text-center">
        <div className="t2q-splash-logo text-white">
          <LogoMark size={72} />
        </div>

        <div
          className="t2q-splash-title t2q-serif mt-6 text-4xl text-white sm:text-5xl"
          style={{ fontWeight: 500 }}
        >
          Tradies<span className="text-brand">2</span>Quote
        </div>

        <div className="t2q-splash-tagline mt-3 text-sm text-ink-300">
          {tagline}
        </div>

        {/* Thin gradient progress line — fills with `progress`. */}
        <div className="t2q-splash-tape mt-9 h-[3px] w-56 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: "linear-gradient(90deg, #FF5F15 0%, #FFEA00 100%)",
              transition: "width 120ms linear",
            }}
          />
        </div>

        {/* Breathing dots. */}
        <div
          className="t2q-splash-caption mt-6 flex items-center gap-1.5"
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="t2q-loading-caption inline-block h-1.5 w-1.5 rounded-full bg-brand"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
