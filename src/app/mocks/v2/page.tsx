import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarBlank,
  CaretRight,
  Plus,
  House,
  ListBullets,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Mock v2 — DARK GLASS + VIVID
 *
 * Frosted glass cards on a deep ink backdrop with big orange/hivis halo
 * glows behind huge serif numbers. Vision Pro / Apple Music adjacent.
 * Every surface is translucent: `bg-white/[0.04] backdrop-blur-xl
 * border-white/10`. The hero number is the show — Fraunces serif at
 * display scale, set against a brand-orange radial halo.
 */
export const metadata: Metadata = { title: "Dark glass + vivid — Mock v2" };

export default function MockGlass() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-ink-950 text-white">
      {/* Vivid background — two large blurred halos. The brand-orange one
          sits behind the hero number so it reads as a glow on the glass. */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand/35 blur-[140px]" />
        <div className="absolute top-[40%] -right-20 h-[360px] w-[360px] rounded-full bg-hivis/15 blur-[120px]" />
        <div className="absolute bottom-0 -left-24 h-[420px] w-[420px] rounded-full bg-brand/20 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[480px] px-5 pt-10 pb-32 sm:max-w-2xl sm:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-100">
            {"// tuesday · 2 jun"}
          </p>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] font-semibold text-white backdrop-blur-md">
            C
          </div>
        </header>

        {/* HERO glass card */}
        <section className="relative">
          <div
            className="overflow-hidden rounded-[28px] border border-white/15 p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-100">
              {"// this month"}
            </p>
            <p
              className="mt-4 text-6xl font-medium tabular-nums tracking-tight text-white sm:text-7xl"
              style={{
                fontFamily:
                  "var(--font-fraunces), Fraunces, Georgia, serif",
              }}
            >
              $12,480
            </p>
            <p className="mt-3 text-sm text-ink-100">
              <span className="text-hivis">$8,210 accepted</span> · 7 quotes
              sent · 66% close rate
            </p>

            {/* Tiny inline sparkline-ish chips */}
            <div className="mt-6 flex items-center gap-2">
              {[0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.8].map((h, i) => (
                <span
                  key={i}
                  className="block w-2 rounded-full bg-gradient-to-t from-brand to-hivis"
                  style={{ height: `${h * 36}px` }}
                />
              ))}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-200">
                7-day flow
              </span>
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Sent", value: "7", tone: "text-white" },
            { label: "Accepted", value: "3", tone: "text-hivis" },
            { label: "Drafts", value: "4", tone: "text-brand" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
            >
              <p
                className={`text-2xl font-medium tabular-nums sm:text-3xl ${s.tone}`}
                style={{
                  fontFamily:
                    "var(--font-fraunces), Fraunces, Georgia, serif",
                }}
              >
                {s.value}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-ink-200">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Schedule glass card */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-ink-100">
              <CalendarBlank size={14} weight="bold" /> Up next
            </p>
            <span className="rounded-full bg-brand/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
              3 jobs
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {[
              { date: "Today · 8 am", job: "Kelly Bain deck — frame" },
              { date: "Wed · 7 am", job: "BM O'Hanlon — concrete pour" },
              { date: "Fri · 9 am", job: "Site visit & measure" },
            ].map((row) => (
              <li
                key={row.date}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-ink-900/30 px-4 py-3 backdrop-blur"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand shadow-[0_0_12px_2px_rgba(255,95,21,0.7)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{row.job}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-200">
                    {row.date}
                  </p>
                </div>
                <CaretRight size={14} weight="bold" className="text-ink-300" />
              </li>
            ))}
          </ul>
        </section>

        {/* Recent quotes — glass list */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-100">
              Recent quotes
            </p>
          </div>
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
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-200">
                    {q.code} · {q.tone}
                  </p>
                </div>
                <p
                  className="shrink-0 text-lg font-medium tabular-nums text-white"
                  style={{
                    fontFamily:
                      "var(--font-fraunces), Fraunces, Georgia, serif",
                  }}
                >
                  {q.value}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/mocks"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-200 hover:text-brand"
          >
            ← back to mocks
          </Link>
        </div>
      </div>

      {/* Floating bottom nav (matching the real app) */}
      <nav className="fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between gap-1 rounded-3xl border border-white/15 bg-ink-900/70 px-2 py-2 backdrop-blur-2xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]">
        <NavTile icon={<House size={20} weight="fill" />} label="Home" active />
        <NavTile icon={<ListBullets size={20} />} label="Quotes" />
        <button
          aria-label="New quote"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-ink-950 shadow-[0_0_24px_4px_rgba(255,95,21,0.5)]"
        >
          <Plus size={22} weight="bold" />
        </button>
        <NavTile icon={<Receipt size={20} />} label="Invoices" />
        <NavTile
          icon={
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-white/[0.08] text-xs font-semibold text-white backdrop-blur">
              C
            </span>
          }
          label="Me"
        />
      </nav>
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
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-medium ${active ? "text-brand" : "text-ink-200"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
