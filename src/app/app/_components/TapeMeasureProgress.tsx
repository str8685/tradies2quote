"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import TapeProgress from "@/app/_components/landing/TapeProgress";

/**
 * Live tape-measure progress for an AI scan wait.
 *
 * Uses the SAME on-brand measuring-tape gauge as the loading screen
 * (`TapeProgress` — yellow tape, black graduations + numbers, orange fill
 * and glowing needle, mm readout), but driven live.
 *
 * The model gives no real progress signal, so this is an HONEST
 * time-estimate, not a fake %: the needle eases out toward ~92% over the
 * typical scan time and HOLDS there if the scan runs long (reads as
 * "almost there", never "stuck"). When `done` flips true it snaps to 100%.
 * Honors prefers-reduced-motion (static partial fill, no animation).
 */
export function TapeMeasureProgress({
  done = false,
  estimateMs = 22000,
  label = "// scanning",
}: {
  done?: boolean;
  estimateMs?: number;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const [animP, setAnimP] = useState(0.02);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Nothing to animate for the static cases — those are derived below.
    if (done || reduce) return;
    const start = performance.now();
    const cap = 0.92; // hold here until the real result lands
    const tick = (t: number) => {
      const lin = Math.min(1, (t - start) / estimateMs);
      const eased = 1 - Math.pow(1 - lin, 3); // easeOutCubic — quick then slow
      setAnimP(Math.max(0.02, eased * cap));
      if (lin < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [done, reduce, estimateMs]);

  const p = done ? 1 : reduce ? 0.65 : animP;

  return <TapeProgress progress={p} width={360} label={label} />;
}
