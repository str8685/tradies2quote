"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Tape-measure progress for an AI scan wait.
 *
 * The model gives no real progress signal, so this is an HONEST
 * time-estimate, not a fake %: the tape eases out toward ~90% over the
 * typical scan time and HOLDS there if the scan runs long (reads as
 * "almost there", never "stuck" or "frozen at 100%"). When `done` flips
 * true it snaps to 100% with a quick spring — the satisfying click.
 *
 * Purely decorative: screen readers get the status from the caller's
 * existing aria-live text, so the bar is aria-hidden. Honors
 * prefers-reduced-motion (renders a static partial bar, no animation).
 */
export function TapeMeasureProgress({
  done = false,
  estimateMs = 22000,
}: {
  done?: boolean;
  estimateMs?: number;
}) {
  const reduce = useReducedMotion();
  const restWidth = reduce ? "65%" : "90%";

  return (
    <div className="w-full max-w-md" aria-hidden="true">
      <div className="relative h-7 w-full overflow-hidden rounded-sm border border-ink-700 bg-ink-950">
        <motion.div
          className="relative h-full bg-hivis"
          style={{
            // Black tape graduations: minor ticks every 8px, majors every 40px.
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.85) 0 1px, transparent 1px 8px)," +
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.9) 0 2px, transparent 2px 40px)",
          }}
          initial={{ width: reduce ? restWidth : "4%" }}
          animate={{ width: done ? "100%" : restWidth }}
          transition={
            done
              ? { type: "spring", stiffness: 240, damping: 20 }
              : reduce
                ? { duration: 0 }
                : { duration: estimateMs / 1000, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {/* Leading edge — the tape's measuring point. */}
          <span className="absolute inset-y-0 right-0 w-[3px] bg-ink-950/80" />
        </motion.div>
      </div>
    </div>
  );
}
