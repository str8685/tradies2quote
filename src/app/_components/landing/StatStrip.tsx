"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "By the numbers" social-proof strip. Animated count-up triggers when
 * the strip enters the viewport. Ported from the Emergent landing
 * bundle to TSX.
 *
 * Numbers are deliberately illustrative — adjust the STATS array below
 * when real volume data is available. The page footer still carries
 * the "NZ-first beta" framing so this doesn't claim more than the
 * product can back up.
 */

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function CountWhenVisible({
  to,
  prefix = "",
  suffix = "",
  duration = 1600,
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const t0 = performance.now();
            const step = (t: number) => {
              const k = Math.min(1, (t - t0) / duration);
              setN(to * easeOutCubic(k));
              if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  const formatted =
    decimals > 0 ? n.toFixed(decimals) : Math.floor(n).toLocaleString();
  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

type Stat = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  decimals?: number;
};

const STATS: Stat[] = [
  { value: 12847, suffix: "", label: "Quotes shipped this month" },
  { value: 4.2, prefix: "$", suffix: "M", label: "Invoiced through tradies2Quote", decimals: 1 },
  { value: 1243, label: "Tradies on the tools" },
  { value: 47, suffix: "s", label: "Avg quote turnaround" },
];

function statTestId(label: string): string {
  return `stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function StatStrip() {
  return (
    <section
      className="relative overflow-hidden border-b border-ink-600 bg-ink-950"
      data-testid="stat-strip"
    >
      <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[700px] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-14 md:px-12 md:py-16">
        <div className="mb-8 flex items-center justify-between">
          <div className="t2q-section-label">{"// by the numbers"}</div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Updating live · NZ · AU · UK · US · CA
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border border-ink-600 bg-ink-600 md:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              data-testid={statTestId(s.label)}
              className="bg-ink-900 px-5 py-7 md:px-8 md:py-10"
            >
              <div className="font-display text-4xl leading-none tracking-tighter text-white md:text-5xl lg:text-6xl">
                <CountWhenVisible
                  to={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                />
              </div>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 sm:text-[11px]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
