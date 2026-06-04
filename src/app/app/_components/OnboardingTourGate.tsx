"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * Wave 17 — perf — defers the OnboardingTour heavy chunk so returning
 * users never pay for it.
 *
 * The tour itself (`./OnboardingTour`) ships the Driver.js coachmarks
 * and first-run copy. It's shown ONCE per device on the dashboard —
 * after the first visit, `localStorage["t2q-tour-done"]` is set and
 * the tour never renders again. Pre-Wave-17, the tour was imported
 * eagerly at the top of `app/layout.tsx`, so every /app/* page paid
 * for that JS forever.
 *
 * This gate runs an effect on mount, reads localStorage in a 0-ms
 * timer (so the setState lives in a subscribed callback for React 19),
 * and only triggers the dynamic import if the tour hasn't been
 * dismissed yet. For returning users this means:
 *   - The OnboardingTour JS chunk is NEVER fetched
 *   - The OnboardingTour effect (which reads its own localStorage
 *     gate) never runs
 *
 * If a first-time user lands on a deep /app route first, we wait until
 * they reach `/app` before starting so the tour can point at the real
 * dashboard targets instead of marking itself done with missing anchors.
 * `/app?tour=1` forces a replay from Settings.
 *
 * Server-renders to null so it doesn't add to the HTML payload.
 */
const OnboardingTour = dynamic(
  () => import("./OnboardingTour").then((m) => m.OnboardingTour),
  { ssr: false, loading: () => null },
);

const STORAGE_KEY = "t2q-tour-done";
const REPLAY_PARAM = "tour";

function hasReplayParam() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(REPLAY_PARAM) === "1";
}

function clearReplayParam() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(REPLAY_PARAM)) return;
  url.searchParams.delete(REPLAY_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function OnboardingTourGate() {
  const pathname = usePathname() ?? "";
  const [tourRun, setTourRun] = useState<number | null>(null);
  const attemptedWithoutStorageRef = useRef(false);
  const finishTour = useCallback(() => setTourRun(null), []);

  useEffect(() => {
    // 0-ms timer keeps the setState in a subscribed callback (the same
    // pattern `OnboardingTour.tsx` itself uses for React 19 linting).
    const t = setTimeout(() => {
      const replay = hasReplayParam();
      if (!replay && pathname !== "/app") return;
      if (replay) clearReplayParam();

      try {
        if (replay) {
          localStorage.removeItem(STORAGE_KEY);
        }
        if (replay || !localStorage.getItem(STORAGE_KEY)) {
          setTourRun(Date.now());
        }
      } catch {
        // localStorage unavailable (private mode, exotic CSP). Run at
        // most once per layout lifetime so the user still gets help
        // without being trapped in a repeating tour.
        if (!attemptedWithoutStorageRef.current) {
          attemptedWithoutStorageRef.current = true;
          setTourRun(Date.now());
        }
      }
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  if (tourRun === null) return null;
  return (
    <OnboardingTour
      key={tourRun}
      onFinished={finishTour}
    />
  );
}
