"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

/**
 * Single-button theme control.
 *
 * Default (no saved preference) is AUTO: it follows the device's light/dark
 * setting via `prefers-color-scheme`, so the site darkens at night on its
 * own — no action needed from the visitor. Tapping the button sets an
 * explicit light/dark preference for anyone who wants to override; the icon
 * reflects what's actually on screen (sun = light, moon = dark).
 *
 * The real `data-theme` write lives in `src/app/_components/ThemeBoot.tsx`
 * (mounted at the root layout) so OS-level theme changes are followed even
 * when this button isn't on screen. On tap we persist the choice and fire
 * `t2q-theme-changed` so ThemeBoot re-applies the theme in the same tab
 * (the native `storage` event only reaches other tabs). We also write
 * `data-theme` here for instant, no-lag feedback.
 *
 * Replaces the old 3-state segmented switch (auto / light / dark) — the
 * owner wanted one icon that just handles day/night automatically.
 */
const STORAGE_KEY = "t2q-theme";
type Mode = "auto" | "light" | "dark";
type Effective = "light" | "dark";

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
    return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto";
  } catch {
    return "auto";
  }
}

function readEffective(mode: Mode): Effective {
  if (typeof window === "undefined") return "dark";
  // Prefer what the boot script already put on screen.
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === "light" || fromDom === "dark") return fromDom;
  return mode === "auto" ? resolveAuto() : mode;
}

export function ThemeToggle() {
  // SSR + first client render both show the sun (hydrated === false) so
  // there's no hydration mismatch; the effect then corrects to the real
  // resolved theme.
  const [hydrated, setHydrated] = useState(false);
  const [effective, setEffective] = useState<Effective>("dark");

  useEffect(() => {
    const t = setTimeout(() => {
      setEffective(readEffective(readSavedMode()));
      setHydrated(true);
    }, 0);

    // Follow OS changes while mounted so the icon stays accurate (e.g. the
    // phone flips to dark at night). ThemeBoot re-applies data-theme; we
    // just mirror its decision into the icon.
    if (!window.matchMedia) return () => clearTimeout(t);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setEffective(readEffective(readSavedMode()));
    mql.addEventListener("change", handler);
    return () => {
      clearTimeout(t);
      mql.removeEventListener("change", handler);
    };
  }, []);

  const toggle = useCallback(() => {
    // Flip to the opposite of what's currently on screen and persist it as
    // an explicit preference.
    const current = readEffective(readSavedMode());
    const next: Effective = current === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked — still works for this session.
    }
    document.documentElement.dataset.theme = next;
    setEffective(next);
    window.dispatchEvent(new CustomEvent("t2q-theme-changed"));
  }, []);

  const showMoon = hydrated && effective === "dark";
  const label = showMoon
    ? "Dark mode — tap for light"
    : "Light mode — tap for dark";

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-effective={effective}
      onClick={toggle}
      aria-label={label}
      title="Theme follows your device automatically (dark at night). Tap to switch."
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-800 transition-colors hover:border-ink-500"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand">
        {showMoon ? (
          <Moon size={15} weight="fill" className="text-ink-900" />
        ) : (
          <Sun size={15} weight="fill" className="text-ink-900" />
        )}
      </span>
    </button>
  );
}
