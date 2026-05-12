/**
 * Dashboard skeleton — Wave 17 — perf.
 *
 * Mirrors the layout of the dashboard's data-driven sections (pipeline
 * stats card + recent quotes list) so the page paints instantly when
 * the Supabase queries are still in flight. Uses the same card
 * borders + ink-800 backgrounds as the real components so there's no
 * visual jump when the real data swaps in.
 *
 * Server-renderable, zero state, zero JS — Tailwind's built-in
 * `animate-pulse` (subtle opacity oscillation) provides the only
 * lifesign so the user knows something is loading without a spinning
 * logo or splash flash.
 */
export function DashboardSkeleton() {
  return (
    <div
      data-testid="dashboard-skeleton"
      aria-hidden="true"
      className="animate-pulse"
    >
      {/* Pipeline stats card. Mirrors the real card's padding +
          border so we don't get a 4px shift when data lands. */}
      <section className="t2q-premium-card-static mb-6 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-24 rounded-sm bg-ink-700" />
        </div>
        {/* 7 stage tiles — 3-col on phones, 7-col on lg per the real
            card. Each tile is a hollow ink rectangle. */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:grid-cols-4 sm:gap-2 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[64px] flex-col justify-end rounded-sm border border-ink-800 bg-ink-900/30 px-2.5 py-2 sm:h-[88px] sm:px-3 sm:py-3"
            >
              <div className="h-5 w-6 rounded-sm bg-ink-700 sm:h-7 sm:w-8" />
              <div className="mt-1 h-2 w-12 rounded-sm bg-ink-700" />
            </div>
          ))}
        </div>
        {/* Secondary KPI strip — 2 columns. */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-700/60 pt-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-3 py-3"
            >
              <div className="h-5 w-16 rounded-sm bg-ink-700" />
              <div className="mt-2 h-2 w-24 rounded-sm bg-ink-700" />
            </div>
          ))}
        </div>
      </section>

      {/* Action row (// X recent quotes label + Materials/New quote
          buttons). The action row is part of the data section because
          the count depends on data, so we placeholder it here. */}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-3 w-32 rounded-sm bg-ink-700" />
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-sm bg-ink-700" />
          <div className="h-10 w-32 rounded-sm bg-brand/50" />
        </div>
      </div>

      {/* Recent quotes — 3 placeholder rows. Matches the real list's
          card padding so the swap-in has zero shift. */}
      <section className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm border border-ink-700 bg-ink-800 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-sm bg-ink-700" />
                <div className="h-3 w-1/2 rounded-sm bg-ink-700" />
              </div>
              <div className="h-6 w-16 rounded-sm bg-ink-700" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
