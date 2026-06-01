import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarBlank,
  CaretRight,
  Plus,
  TrendUp,
  ListBullets,
  CheckCircle,
  House,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Mock v1 — BENTO GRID
 *
 * Apple App Store / iPad bento layout: a 6-col grid with cards of
 * varied widths (full-row hero, 3+3 stat tiles, full-row schedule,
 * full-row quote list). Generous gutters, rounded-3xl corners,
 * soft elevation, brand orange used decisively on the hero card.
 */
export const metadata: Metadata = { title: "Bento — Mock v1" };

export default function MockBento() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-ink-950 text-white">
      {/* Subtle aurora behind everything (decorative only) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute -top-32 -right-20 h-[420px] w-[420px] rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-hivis/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[480px] px-4 pt-8 pb-32 sm:max-w-2xl sm:px-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand">
              {"// tuesday · 2 june"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
              Morning, <span className="text-brand">Challis</span>.
            </h1>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-brand font-semibold text-ink-950 shadow-[0_8px_24px_-6px_rgba(255,95,21,0.6)]">
            C
          </div>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-6 gap-3">
          {/* HERO — this month */}
          <article className="col-span-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/30 via-brand/10 to-transparent p-6 shadow-[0_20px_60px_-20px_rgba(255,95,21,0.55)] sm:p-7">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-ink-100">
              <TrendUp size={14} weight="bold" /> This month
            </div>
            <p className="mt-4 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
              $12,480
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-200 sm:text-sm">
              Quoted across <span className="text-white">7 jobs</span>.{" "}
              <span className="text-hivis">$8,210 accepted</span> — 66%
              conversion.
            </p>
          </article>

          {/* Quotes sent */}
          <article className="col-span-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <ListBullets
              size={18}
              weight="bold"
              className="text-brand"
              aria-hidden="true"
            />
            <p className="mt-5 text-3xl font-semibold tabular-nums sm:text-4xl">
              7
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-ink-300">
              Quotes sent
            </p>
          </article>

          {/* Accepted */}
          <article className="col-span-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <CheckCircle
              size={18}
              weight="bold"
              className="text-hivis"
              aria-hidden="true"
            />
            <p className="mt-5 text-3xl font-semibold tabular-nums sm:text-4xl">
              $8.2k
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-ink-300">
              Accepted
            </p>
          </article>

          {/* Today's schedule strip */}
          <article className="col-span-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-ink-300">
                <CalendarBlank size={14} weight="bold" /> Up next
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
                Calendar →
              </span>
            </div>
            <ul className="mt-3 divide-y divide-white/5">
              {[
                { date: "Today · 8:00 am", job: "Kelly Bain deck — frame", dot: "bg-brand" },
                { date: "Wed · 7:00 am", job: "BM O'Hanlon — concrete pour", dot: "bg-hivis" },
                { date: "Fri · 9:00 am", job: "Site visit & measure", dot: "bg-ink-300" },
              ].map((row) => (
                <li key={row.date} className="flex items-center gap-3 py-3">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{row.job}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                      {row.date}
                    </p>
                  </div>
                  <CaretRight size={14} weight="bold" className="text-ink-500" />
                </li>
              ))}
            </ul>
          </article>

          {/* Recent quotes */}
          <article className="col-span-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-300">
                Recent quotes
              </p>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
                7 active
              </span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                { code: "Q-2026-CF9F", name: "Kelly Bain", value: "$5,244.00", tone: "Draft" },
                { code: "Q-2026-D8C1", name: "Kelly Bain", value: "$6,957.27", tone: "Sent" },
                { code: "Q-2026-70EF", name: "BM O'Hanlon", value: "$6,039.29", tone: "Accepted" },
                { code: "Q-2026-AEF2", name: "Kelly Bain", value: "$3,869.52", tone: "Sent" },
              ].map((q) => (
                <li
                  key={q.code}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">
                      {q.code} · {q.tone}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-white">
                      {q.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-white">
                    {q.value}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/mocks"
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400 hover:text-brand"
          >
            ← back to mocks
          </Link>
        </div>
      </div>

      {/* Floating bottom nav (visual only — mirrors the real app pattern) */}
      <nav className="fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between gap-1 rounded-3xl border border-white/10 bg-ink-900/90 px-2 py-2 backdrop-blur-md shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]">
        <NavTile icon={<House size={20} weight="fill" />} label="Home" active />
        <NavTile icon={<ListBullets size={20} weight="regular" />} label="Quotes" />
        <button
          aria-label="New quote"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-ink-950 shadow-[0_8px_24px_-4px_rgba(255,95,21,0.6)]"
        >
          <Plus size={22} weight="bold" />
        </button>
        <NavTile icon={<Receipt size={20} weight="regular" />} label="Invoices" />
        <NavTile
          icon={
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-ink-950">
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
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-medium ${active ? "text-brand" : "text-ink-300"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
