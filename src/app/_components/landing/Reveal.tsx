"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper for landing sections. Pure CSS transition driven by
 * one IntersectionObserver — no animation library. Children stay server-
 * rendered (passed through as RSC payload); content is ALWAYS in the DOM and
 * visible without JS (the hidden state is only applied once JS mounts), so
 * SEO and no-JS readers see everything.
 *
 * Respects prefers-reduced-motion via the CSS in globals.css.
 */
export function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  /** Stagger delay in ms, applied as transition-delay. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return; // never hide without IO
    // Apply the hidden state only after mount so no-JS visitors see content.
    node.classList.add("t2q-reveal");
    const reveal = () => node.classList.add("is-revealed");
    // A healthy IntersectionObserver ALWAYS fires an initial callback (even
    // with isIntersecting=false). If it stays silent, the environment is
    // degenerate (zero-size viewport, broken polyfill) — fail open so the
    // content can never be stuck hidden. A callback cancels the failsafe.
    const failOpen = setTimeout(reveal, 3000);
    const io = new IntersectionObserver(
      (entries) => {
        clearTimeout(failOpen);
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      clearTimeout(failOpen);
    };
  }, []);

  return (
    <div ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
