import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarBlank,
  CaretRight,
  Plus,
  House,
  ListBullets,
  Receipt,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Mock v4 — LIQUID METAL
 *
 * Apple Vision Pro / iridescent metallic surfaces. Every card has a
 * conic-gradient border that picks up brand + hi-vis + white as
 * "shimmer", with a glassy fill that simulates light reflecting off
 * brushed metal. Brand orange used very sparingly as point accents.
 *
 * The effect is achieved with two layers per card:
 *   1. outer wrapper, padded 1px, with a conic-gradient background → the
 *      "metallic border"
 *   2. inner div with a vertical highlight-to-shadow gradient → the
 *      "glassy reflective fill"
 * Result is a pure CSS-only iridescent shimmer, no JS, no images.
 */
export const metadata: Metadata = { title: "Liquid metal — Mock v4" };

const SERIF = "var(--font-fraunces), Fraunces, Georgia, serif";

const METAL_BORDER =
  "conic-gradient(from 140deg at 50% 50%, rgba(255,255,255,0.35), rgba(255,95,21,0.55), rgba(255,234,0,0.4), rgba(255,255,255,0.15), rgba(255,95,21,0.45), rgba(255,255,255,0.35))";
const METAL_FILL =
  "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 24%, rgba(255,255,255,0.0) 60%, rgba(255,255,255,0.04) 100%), linear-gradient(180deg, #15151A 0%, #0B0B0E 100%)";

function MetalCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[26px] p-[1.25px] shadow-[0_18px_60px_-18px_rgba(0,0,0,0.7)] ${className}`}
      style={{ background: METAL_BORDER }}
    >
      <div
        className="h-full rounded-[24px] p-5 sm:p-6"
        style={{ background: METAL_FILL }}
      >
        {children}
      </div>
    </div>
  );
}

export default function MockLiquidMetal() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-ink-950 text-white">
      {/* Faint orange + hivis backdrop, much subtler than v2 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute top-0 right-0 h-[300px] w-[300px] rounded-full bg-brand/10 blur-[130px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-hivis/[0.06] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[480px] px-4 pt-10 pb-32 sm:max-w-2xl sm:px-6">
        {/* Header */}
        <header className="mb-7 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-300">
              {"// tuesday · 2 jun"}
            </p>
            <h1
              className="mt-1 text-2xl font-medium leading-tight sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Morning, Challis.
            </h1>
          </div>
          {/* Iridescent avatar ring */}
          <div
            className="rounded-full p-[1.25px]"
            style={{ background: METAL_BORDER }}
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-ink-900 font-semibold text-white">
              C
            </div>
          </div>
        </header>

        {/* HERO metal card */}
        <MetalCard>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-200">
              {"// this month"}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-brand">
              <Sparkle size={10} weight="fill" /> +24%
            </span>
          </div>
          <p
            className="mt-4 text-5xl font-medium tabular-nums leading-none tracking-tight sm:text-6xl"
            style={{ fontFamily: SERIF }}
          >
            $12,480
          </p>
          <p className="mt-3 text-sm text-ink-200">
            Across <span className="text-white">7 quotes</span>. Closed{" "}
            <span className="text-hivis">$8,210</span>.
          </p>

          {/* Glossy progress bar */}
          <div className="mt-5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: "66%",
                  background:
                    "linear-gradient(90deg, #FF5F15 0%, #FFB068 50%, #FFEA00 100%)",
                  boxShadow: "0 0 12px rgba(255,95,21,0.55)",
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
              66% close rate
            </p>
          </div>
        </MetalCard>

        {/* Stat strip */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <MetalCard>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
              Sent
            </p>
            <p
              className="mt-3 text-3xl font-medium tabular-nums sm:text-4xl"
              style={{ fontFamily: SERIF }}
            >
              7
            </p>
          </MetalCard>
          <MetalCard>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-hivis">
              Accepted
            </p>
            <p
              className="mt-3 text-3xl font-medium tabular-nums sm:text-4xl"
              style={{ fontFamily: SERIF }}
            >
              3
            </p>
          </MetalCard>
        </div>

        {/* Up next */}
        <div className="mt-3">
          <MetalCard>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-200">
                <CalendarBlank size={13} weight="bold" /> Up next
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
                Calendar →
              </span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                { date: "Today · 8 am", job: "Kelly Bain deck — frame", dot: "bg-brand" },
                { date: "Wed · 7 am", job: "BM O'Hanlon — concrete pour", dot: "bg-hivis" },
                { date: "Fri · 9 am", job: "Site visit & measure", dot: "bg-ink-300" },
              ].map((row) => (
                <li
                  key={row.date}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
                  }}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{row.job}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
                      {row.date}
                    </p>
                  </div>
                  <CaretRight
                    size={13}
                    weight="bold"
                    className="text-ink-400"
                  />
                </li>
              ))}
            </ul>
          </MetalCard>
        </div>

        {/* Recent quotes */}
        <div className="mt-3">
          <MetalCard>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-200">
              Recent quotes
            </p>
            <ul className="mt-4 divide-y divide-white/5">
              {[
                { code: "Q-2026-CF9F", name: "Kelly Bain", value: "$5,244", tone: "draft" },
                { code: "Q-2026-D8C1", name: "Kelly Bain", value: "$6,957", tone: "sent" },
                { code: "Q-2026-70EF", name: "BM O'Hanlon", value: "$6,039", tone: "accepted" },
                { code: "Q-2026-AEF2", name: "Kelly Bain", value: "$3,869", tone: "sent" },
              ].map((q) => (
                <li
                  key={q.code}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {q.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
                      {q.code} · {q.tone}
                    </p>
                  </div>
                  <p
                    className="shrink-0 text-lg tabular-nums text-white"
                    style={{ fontFamily: SERIF }}
                  >
                    {q.value}
                  </p>
                </li>
              ))}
            </ul>
          </MetalCard>
        </div>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/mocks"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-300 hover:text-brand"
          >
            ← back to mocks
          </Link>
        </div>
      </div>

      {/* Iridescent floating nav */}
      <div
        className="fixed bottom-3 left-3 right-3 z-50 rounded-[26px] p-[1.25px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
        style={{ background: METAL_BORDER }}
      >
        <nav
          className="flex items-center justify-between gap-1 rounded-[24px] px-2 py-2"
          style={{ background: METAL_FILL }}
        >
          <NavTile icon={<House size={20} weight="fill" />} label="Home" active />
          <NavTile icon={<ListBullets size={20} />} label="Quotes" />
          <button
            aria-label="New quote"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-ink-950 shadow-[0_6px_18px_-4px_rgba(255,95,21,0.6)]"
          >
            <Plus size={22} weight="bold" />
          </button>
          <NavTile icon={<Receipt size={20} />} label="Invoices" />
          <NavTile
            icon={
              <div
                className="rounded-full p-[1px]"
                style={{ background: METAL_BORDER }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-[10px] font-semibold text-white">
                  C
                </span>
              </div>
            }
            label="Me"
          />
        </nav>
      </div>
    </main>
  );
}

function NavTile({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-medium ${active ? "text-brand" : "text-ink-300"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
