"use client";

import { useEffect, useRef, useState } from "react";

const SIZE = 640;

export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    setReduced(mq.matches || !fine.matches);
    const onMq = () => setReduced(mq.matches || !fine.matches);
    mq.addEventListener("change", onMq);
    fine.addEventListener("change", onMq);
    return () => {
      mq.removeEventListener("change", onMq);
      fine.removeEventListener("change", onMq);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;

    function tick() {
      current.current.x += (target.current.x - current.current.x) * 0.18;
      current.current.y += (target.current.y - current.current.y) * 0.18;
      const el = ref.current;
      if (el) {
        el.style.transform = `translate3d(${(current.current.x - SIZE / 2).toFixed(1)}px, ${(current.current.y - SIZE / 2).toFixed(1)}px, 0)`;
      }
      raf.current = requestAnimationFrame(tick);
    }

    function onMove(e: PointerEvent) {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (!visible) {
        current.current.x = e.clientX;
        current.current.y = e.clientY;
        setVisible(true);
      }
    }

    function onLeave() {
      setVisible(false);
    }

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [reduced, visible]);

  if (reduced) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-testid="cursor-spotlight"
      className="pointer-events-none fixed top-0 left-0 z-[1] rounded-full transition-opacity duration-300"
      style={{
        width: SIZE,
        height: SIZE,
        opacity: visible ? 1 : 0,
        background:
          "radial-gradient(circle, rgba(255, 95, 21, 0.22) 0%, rgba(255, 95, 21, 0.10) 28%, rgba(255, 234, 0, 0.04) 48%, transparent 65%)",
        filter: "blur(8px)",
        willChange: "transform",
        mixBlendMode: "screen",
      }}
    />
  );
}
