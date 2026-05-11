"use client";

import { useEffect } from "react";

/**
 * Theme syncer that's always mounted at the root layout.
 *
 * Why this exists, post-Wave-10:
 *
 *   - The landing-side `<ThemeToggle />` was the only piece holding the
 *     `(prefers-color-scheme: dark)` matchMedia listener. On `/app/*`
 *     pages the toggle is not rendered, so when a phone user flipped their
 *     OS between light + dark while in Auto mode, the in-app pages did not
 *     follow.
 *
 *   - On every page (landing OR app) the first paint had no `data-theme`
 *     attribute on `<html>`. React hydration was the first time the
 *     attribute got set, which caused a single-frame flash of dark when
 *     the saved/auto-resolved preference was light.
 *
 * Fix shape:
 *
 *   1. `src/app/layout.tsx` ships a tiny *synchronous* script that runs
 *      before React hydrates. It reads `localStorage["t2q-theme"]` +
 *      `matchMedia`, then sets `<html data-theme>` so the first paint is
 *      already the right colour. That kills the flash.
 *
 *   2. This component then mounts on the client and registers ONE place
 *      that listens for:
 *        - OS-level light/dark changes while the saved mode is "auto"
 *        - `storage` events (another tab toggled the theme)
 *        - `t2q-theme-changed` custom events fired by `<ThemeToggle />`
 *          when the same tab cycles the toggle
 *      All three converge on `applyMode()`, which re-reads localStorage
 *      and writes the resolved value back to `<html data-theme>`.
 *
 * Renders nothing. Side-effect only. Single mount = no work duplication.
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

function readMode(): Mode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isMode(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

function applyMode(mode: Mode) {
  const eff: Effective = mode === "auto" ? resolveAuto() : mode;
  document.documentElement.dataset.theme = eff;
}

export function ThemeBoot() {
  useEffect(() => {
    // Idempotent re-apply on mount — the pre-hydration script in
    // `layout.tsx` already painted the right colour, but this guards
    // against the rare case where the script fails (e.g. CSP).
    applyMode(readMode());

    const mql = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

    function onOsChange() {
      const mode = readMode();
      if (mode === "auto") applyMode("auto");
    }

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) applyMode(readMode());
    }

    function onThemeChanged() {
      applyMode(readMode());
    }

    mql?.addEventListener("change", onOsChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("t2q-theme-changed", onThemeChanged);

    return () => {
      mql?.removeEventListener("change", onOsChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("t2q-theme-changed", onThemeChanged);
    };
  }, []);

  return null;
}
