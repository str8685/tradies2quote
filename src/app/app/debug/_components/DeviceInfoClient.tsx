"use client";

import { useEffect, useState } from "react";

/**
 * Browser / device / theme info shown on `/app/debug`. Client-only
 * because almost everything here comes from `window`, `navigator`,
 * `matchMedia`, or `localStorage`. The parent server page is the one
 * that enforces the owner gate, so this component itself contains no
 * authorization logic.
 *
 * No secrets, no network calls. Pure feature detection + DOM reads.
 */
type Snapshot = {
  userAgent: string;
  language: string;
  viewport: string;
  pixelRatio: string;
  cookieEnabled: string;
  storedTheme: string;
  resolvedTheme: string;
  prefersColorScheme: string;
  prefersReducedMotion: string;
  prefersContrast: string;
  pwaStandalone: string;
  installPromptHistory: string;
  serviceWorker: string;
  onLine: string;
};

const PLACEHOLDER: Snapshot = {
  userAgent: "—",
  language: "—",
  viewport: "—",
  pixelRatio: "—",
  cookieEnabled: "—",
  storedTheme: "—",
  resolvedTheme: "—",
  prefersColorScheme: "—",
  prefersReducedMotion: "—",
  prefersContrast: "—",
  pwaStandalone: "—",
  installPromptHistory: "—",
  serviceWorker: "—",
  onLine: "—",
};

export function DeviceInfoClient() {
  const [snap, setSnap] = useState<Snapshot>(PLACEHOLDER);

  useEffect(() => {
    function readStorage(key: string): string {
      try {
        return window.localStorage.getItem(key) ?? "—";
      } catch {
        return "blocked";
      }
    }
    const matches = (q: string) =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(q).matches
        : false;
    setSnap({
      userAgent: navigator.userAgent || "—",
      language: navigator.language || "—",
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      pixelRatio: String(window.devicePixelRatio ?? 1),
      cookieEnabled: navigator.cookieEnabled ? "yes" : "no",
      storedTheme: readStorage("t2q-theme"),
      resolvedTheme:
        document.documentElement.dataset.theme ?? "—",
      prefersColorScheme: matches("(prefers-color-scheme: dark)")
        ? "dark"
        : "light",
      prefersReducedMotion: matches("(prefers-reduced-motion: reduce)")
        ? "reduce"
        : "no preference",
      prefersContrast: matches("(prefers-contrast: more)")
        ? "more"
        : "no preference",
      pwaStandalone:
        matches("(display-mode: standalone)") ||
        (typeof navigator !== "undefined" &&
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true)
          ? "installed (standalone)"
          : "browser tab",
      installPromptHistory: readStorage("t2q-install-prompt-seen"),
      serviceWorker:
        "serviceWorker" in navigator ? "available" : "not supported",
      onLine: navigator.onLine ? "online" : "offline",
    });
  }, []);

  return (
    <section
      aria-label="Device"
      data-testid="debug-device"
      className="t2q-premium-card-static p-5 sm:p-7"
    >
      <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
        Device.
      </h2>
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Viewport" value={snap.viewport} />
        <Row label="Pixel ratio" value={snap.pixelRatio} />
        <Row label="Theme (stored)" value={snap.storedTheme} />
        <Row label="Theme (resolved)" value={snap.resolvedTheme} />
        <Row label="OS prefers" value={snap.prefersColorScheme} />
        <Row label="Reduced motion" value={snap.prefersReducedMotion} />
        <Row label="High contrast" value={snap.prefersContrast} />
        <Row label="PWA" value={snap.pwaStandalone} />
        <Row label="Service worker" value={snap.serviceWorker} />
        <Row label="Network" value={snap.onLine} />
        <Row label="Cookies" value={snap.cookieEnabled} />
        <Row label="Language" value={snap.language} />
        <Row
          label="User agent"
          value={snap.userAgent}
          full
        />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 border-b border-ink-700/40 pb-3 last:border-b-0 sm:border-b-0 sm:pb-0 ${full ? "sm:col-span-2" : ""}`}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
        {label}
      </dt>
      <dd className="font-mono text-xs text-white break-all">{value}</dd>
    </div>
  );
}
