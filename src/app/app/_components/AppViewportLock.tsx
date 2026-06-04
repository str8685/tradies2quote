"use client";

import { useEffect } from "react";

/**
 * Wave 39 — keyboard / visualViewport fallback for the locked /app shell.
 *
 * The shell height is CSS-first: globals.css sets `--app-height: 100dvh` and
 * the `.t2q-app-canvas` shell uses `height: var(--app-height, 100dvh)`. `dvh`
 * already tracks the dynamic viewport (URL-bar show/hide) with ZERO JS, so
 * normal scrolling never touches this listener.
 *
 * The one case CSS can't cover is the on-screen keyboard: `dvh` ignores it, so
 * on iOS a focused input can sit hidden behind the keyboard. This listener
 * overrides `--app-height` with the live `visualViewport` height ONLY while the
 * keyboard is actually open (the viewport shrinks by a large margin), and
 * clears the override the instant it closes so the shell snaps straight back to
 * the jank-free CSS `100dvh`.
 *
 * Deliberately tiny + shell-level only:
 *   - sets an inline CSS var on <html>, never touches React state (no re-render,
 *     no hydration surface — the component renders null).
 *   - the 160px threshold distinguishes a keyboard (~260–340px) from a URL-bar
 *     collapse (~60–100px), so it never resizes the shell mid-scroll.
 */
export function AppViewportLock() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // very old browsers — CSS 100dvh fallback is fine.

    const root = document.documentElement;
    const KEYBOARD_MIN_PX = 160;

    const apply = () => {
      const gap = window.innerHeight - vv.height;
      if (gap > KEYBOARD_MIN_PX) {
        // Keyboard open — shrink the shell to the visible area.
        root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
      } else {
        // No keyboard — fall back to the CSS default (100dvh).
        root.style.removeProperty("--app-height");
      }
    };

    apply();
    vv.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--app-height");
    };
  }, []);

  return null;
}
