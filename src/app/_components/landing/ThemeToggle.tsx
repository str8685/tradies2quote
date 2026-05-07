"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const STORAGE_KEY = "t2q-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as "dark" | "light" | null) ?? "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    setHydrated(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-pressed={theme === "light"}
      className="relative inline-flex items-center w-[58px] h-7 rounded-full bg-ink-800 border border-ink-700 px-0.5 transition-colors hover:border-ink-500"
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-brand transition-transform duration-200"
        style={{
          transform: hydrated && theme === "light" ? "translateX(28px)" : "translateX(0)",
        }}
      />
      <span className="relative z-10 flex-1 grid place-items-center">
        <Moon
          size={14}
          weight="fill"
          className={theme === "dark" ? "text-ink-900" : "text-ink-400"}
        />
      </span>
      <span className="relative z-10 flex-1 grid place-items-center">
        <Sun
          size={14}
          weight="fill"
          className={theme === "light" ? "text-ink-900" : "text-ink-400"}
        />
      </span>
    </button>
  );
}
