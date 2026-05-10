"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Sparkle } from "@phosphor-icons/react";

/**
 * 3-state theme switch: AUTO ↔ LIGHT ↔ DARK.
 *
 * Self-contained: no provider, no context, no `src/lib/theme.tsx`. The
 * resolved theme is applied to `document.documentElement.dataset.theme`,
 * which the [data-theme="light"] CSS overrides in `globals.css` respond
 * to. With mode === "auto", the toggle subscribes to the OS-level
 * `(prefers-color-scheme: dark)` media query so the page tracks the
 * system in real time.
 *
 * Persistence:
 *   - localStorage["t2q-theme"] = "auto" | "light" | "dark"
 *   - Default for users with no saved preference: "auto"
 *   - Backwards compatible: pre-existing saved values "dark" or "light"
 *     still load correctly.
 *
 * Cycle order: auto → light → dark → auto.
 *
 * SSR notes:
 *   - Component is `"use client"`. SSR + first client render emit the
 *     same defaults ("auto" mode, "dark" effective). The mount effect
 *     then reads localStorage + matchMedia and applies the real value.
 *   - This means a user whose saved/auto-resolved theme is LIGHT will
 *     see ~one frame of dark before the effect runs. Eliminating this
 *     flash needs a pre-hydration script in `layout.tsx`, which is out
 *     of scope for this wave.
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

function applyTheme(effective: Effective) {
  document.documentElement.dataset.theme = effective;
}

export function ThemeToggle() {
  // SSR-safe initial values. Real values hydrate via the mount effect.
  const [mode, setMode] = useState<Mode>("auto");
  const [effective, setEffective] = useState<Effective>("dark");
  const [hydrated, setHydrated] = useState(false);

  // Mount: read saved mode, resolve, apply, mark hydrated.
  useEffect(() => {
    let savedMode: Mode = "auto";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (isMode(raw)) savedMode = raw;
    } catch {
      // localStorage blocked (private mode, strict cookie blocking) —
      // fall through to "auto"
    }
    const eff: Effective = savedMode === "auto" ? resolveAuto() : savedMode;
    setMode(savedMode);
    setEffective(eff);
    applyTheme(eff);
    setHydrated(true);
  }, []);

  // After hydrate: any mode change persists + re-applies effective.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage write blocked — keep in-memory state only
    }
    const eff: Effective = mode === "auto" ? resolveAuto() : mode;
    setEffective(eff);
    applyTheme(eff);
  }, [mode, hydrated]);

  // While in auto mode, follow live OS preference changes.
  useEffect(() => {
    if (!hydrated || mode !== "auto") return;
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const eff: Effective = e.matches ? "dark" : "light";
      setEffective(eff);
      applyTheme(eff);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode, hydrated]);

  function cycle() {
    setMode((prev) =>
      prev === "auto" ? "light" : prev === "light" ? "dark" : "auto",
    );
  }

  // Knob slot index — 0 (auto), 1 (light), 2 (dark).
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
