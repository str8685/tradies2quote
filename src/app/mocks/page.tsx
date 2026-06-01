import Link from "next/link";
import type { Metadata } from "next";

/**
 * Mock-dashboard index — four "premium Apple Store" design directions
 * for the launch dashboard. Each one keeps the same palette (orange
 * #FF5F15, hi-vis #FFEA00, ink) but takes a different visual approach.
 *
 * This route is OUTSIDE /app/* on purpose: no auth gate, easy to share
 * a link, easy to delete the whole `mocks/` directory after launch.
 */
export const metadata: Metadata = {
  title: "Design mocks — Tradies2Quote",
};

const VARIANTS = [
  {
    href: "/mocks/v1",
    name: "Bento grid",
    description:
      "Apple App Store / iPad bento layout. Varied cards, soft elevation, generous gutters.",
    accent: "bg-brand/15 text-brand",
  },
  {
    href: "/mocks/v2",
    name: "Dark glass + vivid",
    description:
      "Frosted glass cards, orange and hi-vis halo glows behind big serif numbers.",
    accent: "bg-hivis/15 text-hivis",
  },
  {
    href: "/mocks/v3",
    name: "Editorial serif",
    description:
      "Magazine-scale Fraunces serif on pure black. Brand orange as a precision accent only.",
    accent: "bg-white/10 text-white",
  },
  {
    href: "/mocks/v4",
    name: "Liquid metal",
    description:
      "Iridescent gradient borders, glassy reflective fills. Brand colours used sparingly as highlights.",
    accent: "bg-brand/15 text-brand",
  },
] as const;

export default function MocksIndex() {
  return (
    <main className="min-h-[100dvh] bg-ink-950 text-white">
      <div className="mx-auto max-w-[480px] px-5 pt-12 pb-16 sm:max-w-2xl sm:px-8 sm:pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand">
          {"// design mocks"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Pick the one that <span className="text-brand">sings.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300 sm:text-base">
          Four premium directions for the launch dashboard. Same palette
          throughout — orange, hi-vis, ink. Tap each card to view the
          mock full-screen on your phone, then tell me which one to roll
          out across the app before Friday.
        </p>

        <ul className="mt-8 space-y-3">
          {VARIANTS.map((v, i) => (
            <li key={v.href}>
              <Link
                href={v.href}
                className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/40 hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white sm:text-xl">
                    <span className="mr-2 inline-block w-6 text-ink-400 tabular-nums">
                      0{i + 1}
                    </span>
                    {v.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${v.accent}`}
                  >
                    {v.href}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  {v.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
          {"// palette · #ff5f15 · #ffea00 · ink"}
        </p>
      </div>
    </main>
  );
}
