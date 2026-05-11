"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun, Sparkle } from "@phosphor-icons/react";

/**
 * 3-state theme switch: AUTO ↔ LIGHT ↔ DARK.
 *
 * The actual `data-theme` write lives in `src/app/_components/ThemeBoot.tsx`
 * (mounted at the root layout), so OS-level theme changes are followed
 * even when this toggle is not on screen — that fixed the bug where the
 * /app pages would not switch with the phone's light/dark setting.
 *
 * Persistence:
 *   - localStorage["t2q-theme"] = "auto" | "light" | "dark"
 *   - Default for users with no saved preference: "auto"
 *
 * Cycle order: auto → light → dark → auto.
 *
 * On click this component:
 *   1. Writes the new mode to localStorage.
 *   2. Fires `t2q-theme-changed` so `<ThemeBoot />` re-applies the
 *      resolved theme in the same tab (the native `storage` event only
 *      reaches other tabs).
 *
 * `data-theme` is also written here as an instant-feedback shortcut so the
 * UI never lags a frame behind the click.
 */
const STORAGE_KEY = "t2q-theme";
type Mode = "auto" | "light" | "dark";
type Effective = "light" | "dark";

function isMode(v: unknown): v is Mode {
  return v === "auto" || v === "light" || v === "dark";
}

function resolveAuto(): Effective {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readSavedMode(): Mode {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isMode(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

function readEffective(mode: Mode): Effective {
  if (typeof window === "undefined") return "dark";
  // Prefer the value the boot script already wrote — it's the source of
  // truth for what's actually on screen right now.
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === "light" || fromDom === "dark") return fromDom;
  return mode === "auto" ? resolveAuto() : mode;
}

export function ThemeToggle() {
  // The pre-hydration script in `layout.tsx` already wrote the right
  // `data-theme`, so we can read it back synchronously on mount. We still
  // start with "auto" on the server render to match the SSR HTML.
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [effective, setEffective] = useState<Effective>("dark");

  useEffect(() => {
    const saved = readSavedMode();
    setMode(saved);
    setEffective(readEffective(saved));
    setHydrated(true);

    // While this toggle is mounted, also follow OS changes locally so the
    // displayed `effective` label stays accurate. ThemeBoot already
    // re-applies `data-theme`; we just mirror its decision into our own
    // state so the (auto · currently …) label updates.
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setEffective(readEffective(readSavedMode()));
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const cycle = useCallback(() => {
    setMode((prev) => {
      const next: Mode =
        prev === "auto" ? "light" : prev === "light" ? "dark" : "auto";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage blocked — UI still works, just won't persist.
      }
      const eff: Effective = next === "auto" ? resolveAuto() : next;
      // Instant UI feedback for the same tab — ThemeBoot will also apply
      // via the custom event below, but writing here first avoids a frame
      // gap.
      document.documentElement.dataset.theme = eff;
      setEffective(eff);
      // Tell ThemeBoot (same tab) to re-sync.
      window.dispatchEvent(new CustomEvent("t2q-theme-changed"));
      return next;
    });
  }, []);

  const idx = mode === "auto" ? 0 : mode === "light" ? 1 : 2;
  const label =
    mode === "auto"
      ? `Auto · currently ${effective}`
      : mode === "light"
        ? "Light"
        : "Dark";

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-mode={mode}
      data-effective={effective}
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to cycle.`}
      title={label}
      className="relative inline-flex items-center w-[96px] h-9 rounded-full bg-ink-800 border border-ink-700 px-1 transition-colors hover:border-ink-500"
    >
      {/* Sliding knob — sits over the active slot */}
      <span
        aria-hidden="true"
        className="absolute top-1 left-1 w-7 h-7 rounded-full bg-brand grid place-items-center transition-transform duration-300 ease-[cubic-bezier(.21,.6,.27,1)]"
        style={{
          transform: hydrated ? `translateX(${idx * 30}px)` : "translateX(0)",
        }}
      >
        {mode === "auto" ? (
          <Sparkle size={14} weight="fill" className="text-ink-900" />
        ) : mode === "light" ? (
          <Sun size={14} weight="fill" className="text-ink-900" />
        ) : (
          <Moon size={14} weight="fill" className="text-ink-900" />
        )}
      </span>

      {/* Slot icons — dim placeholders behind the knob */}
      <span
        className="relative z-10 flex-1 grid place-items-center"
        aria-hidden="true"
      >
        <Sparkle
          size={14}
          weight="fill"
          className={mode === "auto" ? "text-transparent" : "text-ink-400"}
        />
      </span>
      <span
        className="relative z-10 flex-1 grid place-items-center"
        aria-hidden="true"
      >
        <Sun
          size={14}
          weight="fill"
          className={mode === "light" ? "text-transparent" : "text-ink-400"}
        />
      </span>
      <span
        className="relative z-10 flex-1 grid place-items-center"
        aria-hidden="true"
      >
        <Moon
          size={14}
          weight="fill"
          className={mode === "dark" ? "text-transparent" : "text-ink-400"}
        />
      </span>
    </button>
  );
}
