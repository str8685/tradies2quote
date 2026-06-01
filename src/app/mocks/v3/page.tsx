import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "@phosphor-icons/react/dist/ssr";

/**
 * Mock v3 — EDITORIAL SERIF MINIMAL
 *
 * Pure black, magazine-scale Fraunces serif. No card backgrounds —
 * the typography IS the design. Brand orange used as a precision
 * accent: a single dot, a one-character highlight, never decoration.
 * Inspired by Apple Newsroom / Stripe Press / Linear's landing.
 *
 * The point: the dashboard reads as quietly confident. The numbers
 * speak. Whitespace does the heavy lifting.
 */
export const metadata: Metadata = { title: "Editorial serif — Mock v3" };

const SERIF = "var(--font-fraunces), Fraunces, Georgia, serif";

export default function MockEditorial() {
  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto max-w-[480px] px-6 pt-12 pb-32 sm:max-w-2xl sm:px-10 sm:pt-20">
        {/* Eyebrow */}
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-ink-400">
          {"// tuesday · 02.06.2026"}
        </p>

        {/* HERO — gigantic serif number, no card */}
        <p
          className="mt-6 text-[64px] font-medium leading-[0.95] tracking-tight sm:text-[120px]"
          style={{ fontFamily: SERIF }}
        >
          $12,480<span className="text-brand">.</span>
        </p>
        <p
          className="mt-3 text-lg leading-snug text-ink-200 sm:text-xl"
          style={{ fontFamily: SERIF }}
        >
          Quoted this month.
        </p>

        {/* Thin divider */}
        <div className="mt-10 h-px w-full bg-white/10" />

        {/* Three-line summary — pure typography */}
        <dl className="mt-8 space-y-5">
          {[
            { label: "Sent", value: "7", footnote: "quotes out the door." },
            { label: "Accepted", value: "$8,210", footnote: "three signed back." },
            { label: "Conversion", value: "66%", footnote: "above last month." },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
                  {row.label}
                </p>
                <p
                  className="mt-1 text-sm leading-snug text-ink-200"
                  style={{ fontFamily: SERIF }}
                >
                  {row.footnote}
                </p>
              </div>
              <p
                className="shrink-0 text-3xl font-medium tabular-nums sm:text-4xl"
                style={{ fontFamily: SERIF }}
              >
                {row.value}
              </p>
            </div>
          ))}
        </dl>

        <div className="mt-10 h-px w-full bg-white/10" />

        {/* Up next — minimal */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
              {"// up next"}
            </p>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
              calendar
            </span>
          </div>
          <ul className="mt-5 space-y-5">
            {[
              { date: "Today · 8 am", job: "Kelly Bain deck. Start frame." },
              { date: "Wed · 7 am", job: "BM O'Hanlon. Concrete pour." },
              { date: "Fri · 9 am", job: "Site visit, measure." },
            ].map((row, i) => (
              <li
                key={row.date}
                className="flex items-baseline gap-3 border-b border-white/5 pb-5 last:border-0"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500 tabular-nums">
                  0{i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-base leading-snug text-white sm:text-lg"
                    style={{ fontFamily: SERIF }}
                  >
                    {row.job}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
                    {row.date}
                  </p>
                </div>
                {i === 0 && (
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 h-px w-full bg-white/10" />

        {/* Recent quotes — minimal list */}
        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
            {"// recent"}
          </p>
          <ul className="mt-5 space-y-5">
            {[
              { code: "Q-2026-CF9F", name: "Kelly Bain", value: "$5,244", tone: "draft" },
              { code: "Q-2026-D8C1", name: "Kelly Bain", value: "$6,957", tone: "sent" },
              { code: "Q-2026-70EF", name: "BM O'Hanlon", value: "$6,039", tone: "accepted", brand: true },
              { code: "Q-2026-AEF2", name: "Kelly Bain", value: "$3,869", tone: "sent" },
            ].map((q) => (
              <li
                key={q.code}
                className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-5 last:border-0"
              >
                <div className="min-w-0">
                  <p
                    className="text-base leading-snug text-white sm:text-lg"
                    style={{ fontFamily: SERIF }}
                  >
                    {q.name}
                    {q.brand && <span className="text-brand">.</span>}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
                    {q.code} · {q.tone}
                  </p>
                </div>
                <p
                  className="shrink-0 text-xl font-medium tabular-nums sm:text-2xl"
                  style={{ fontFamily: SERIF }}
                >
                  {q.value}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Sign-off line */}
        <p
          className="mt-12 text-center text-sm italic text-ink-400"
          style={{ fontFamily: SERIF }}
        >
          Quietly, the work gets quoted.
        </p>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/mocks"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400 hover:text-brand"
          >
            ← back to mocks
          </Link>
        </div>
      </div>

      {/* Minimal floating nav — single hairline, no glow, no glass */}
      <nav className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black px-2 py-1.5">
        <NavTile label="Home" active />
        <NavTile label="Quotes" />
        <button
          aria-label="New quote"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-ink-950"
        >
          <Plus size={18} weight="bold" />
        </button>
        <NavTile label="Invoices" />
        <NavTile label="Me" />
      </nav>
    </main>
  );
}

function NavTile({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  // Editorial nav: only labels, no icons — the type carries everything.
  return (
    <button
      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] ${active ? "text-brand" : "text-ink-300"}`}
    >
      {label}
    </button>
  );
}
