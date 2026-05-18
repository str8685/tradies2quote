"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin top-of-screen progress bar shown during /app/* tab navigations.
 *
 * Mobile networks make the gap between "user taps a tab" and "new page
 * actually paints" feel like dead air — anywhere from 100ms on a warm
 * function to 700ms+ on a cold serverless start. Without feedback the
 * old page just sits there and the operator wonders if their tap
 * registered.
 *
 * This component listens for pathname changes via `usePathname()` and
 * animates a 2px brand-orange line across the top of the viewport for
 * roughly 700ms after each route change. Pairs with the `:active`
 * state on `.t2q-bottomnav-tile` (instant tile flash on touch) so the
 * full chain — tap flash → bar slides → new page lands — leaves no
 * visible dead frame.
 *
 * Implementation notes:
 *   - Anchored to `top: env(safe-area-inset-top)` so the bar sits just
 *     below the iOS notch rather than disappearing into it.
 *   - First render is skipped via a ref-guard so the bar doesn't fire
 *     on initial /app entry (when there's a real splash playing).
 *   - All `setState` calls inside the effect are deferred via
 *     setTimeout(…, 0) to satisfy React 19's effect-purity lint rule.
 *   - Zero JS dependency — no nprogress library, pure
 *     React + CSS transitions. Adds ~600 bytes to the layout bundle.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Defer the state writes so they don't run synchronously inside
    // the effect body (React 19's react-hooks/set-state-in-effect).
    const tStart = setTimeout(() => {
      setVisible(true);
      setProgress(15);
    }, 0);
    const t1 = setTimeout(() => setProgress(60), 90);
    const t2 = setTimeout(() => setProgress(92), 320);
    const t3 = setTimeout(() => setProgress(100), 580);
    const tHide = setTimeout(() => {
      setVisible(false);
    }, 720);
    const tReset = setTimeout(() => {
      setProgress(0);
    }, 920);

    return () => {
      clearTimeout(tStart);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tHide);
      clearTimeout(tReset);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      data-testid="top-progress-bar"
      className="pointer-events-none fixed inset-x-0 z-[60] h-[2px]"
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <div
        className="h-full bg-brand shadow-[0_0_6px_rgba(255,95,21,0.7)] transition-[width,opacity] ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionDuration: visible ? "260ms" : "200ms",
        }}
      />
    </div>
  );
}
