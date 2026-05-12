"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Wave 17 — perf — defers the OnboardingTour heavy chunk so returning
 * users never pay for it.
 *
 * The tour itself (`./OnboardingTour`) ships 200+ lines of JSX, 7
 * Phosphor icons, and the 5-step copy. It's shown ONCE per device —
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
 * For first-time visitors it adds one render cycle of latency
 * (~16ms) before the tour appears, which is invisible alongside the
 * tape-measure entry splash that's already playing on top.
 *
 * Server-renders to null so it doesn't add to the HTML payload.
 */
const OnboardingTour = dynamic(
  () => import("./OnboardingTour").then((m) => m.OnboardingTour),
  { ssr: false, loading: () => null },
);

const STORAGE_KEY = "t2q-tour-done";

export function OnboardingTourGate() {
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    // 0-ms timer keeps the setState in a subscribed callback (the
    // same pattern `OnboardingTour.tsx` itself uses for the same
    // React 19 lint rule). Cheap belt-and-braces.
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setShouldRender(true);
      } catch {
        // localStorage unavailable (private mode, exotic CSP) — skip
        // the tour silently rather than crashing the layout.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!shouldRender) return null;
  return <OnboardingTour />;
}
