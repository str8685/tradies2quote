"use client";

import { useRef, type ReactNode } from "react";

/**
 * Reusable 3D tilt card. On pointer-move tilts via rotateX / rotateY with
 * a cursor-tracking glare. Disabled on touch devices automatically (no
 * hover). Ported from the Emergent landing-export bundle to TSX.
 *
 * Pure DOM manipulation — no extra deps, no framer-motion. Uses CSS
 * variables (`--rx`, `--ry`) so the transition can be controlled via
 * the inline transform without re-rendering React state on every move.
 */
type Props = {
  children: ReactNode;
  /** Outer wrapper class (border, background, etc.). */
  className?: string;
  /** Inner wrapper class (padding, content layout). */
  innerClassName?: string;
  /** When true, the radial-gradient glare follows the cursor. */
  glare?: boolean;
  /** Maximum rotateX angle in degrees. */
  maxTiltX?: number;
  /** Maximum rotateY angle in degrees. */
  maxTiltY?: number;
  /** CSS perspective in pixels. */
  perspective?: number;
  /** Inner content lift in pixels (Z translation). */
  liftZ?: number;
  /** Optional data-testid. */
  testid?: string;
};

export function TiltCard({
  children,
  className = "",
  innerClassName = "",
  glare = true,
  maxTiltX = 10,
  maxTiltY = 12,
  perspective = 1100,
  liftZ = 30,
  testid,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * maxTiltX;
    const ry = (x - 0.5) * maxTiltY;
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    if (glare && glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%)`;
    }
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    if (glare && glareRef.current) glareRef.current.style.background = "transparent";
  }

  return (
    <div className="t2q-stage" style={{ perspective: `${perspective}px` }}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        data-testid={testid}
        className={`relative will-change-transform ${className}`}
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateZ(0)",
          transition: "transform 200ms cubic-bezier(.21,.6,.27,1)",
        }}
      >
        {glare && (
          <div
            ref={glareRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
          />
        )}
        <div className={innerClassName} style={{ transform: `translateZ(${liftZ}px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
