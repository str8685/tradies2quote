/**
 * Default loading skeleton for every `/app/*` page.
 *
 * Wave 11 — Next 16's app-router loading.tsx convention. Whenever a
 * /app page is fetching its server-side data, the user sees this
 * skeleton instead of a blank white screen.
 *
 * Per-route loading.tsx files can override this where a tighter layout
 * makes sense.
 *
 * Static, server-rendered, no client-side JS. Reuses `.t2q-premium-card-static`
 * for visual consistency with the real pages it stands in for.
 */
export default function AppLoading() {
  return (
    <div className="min-h-screen text-white">
      <main
        data-testid="app-loading-skeleton"
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
      >
        {/* Eyebrow + heading skeleton */}
        <div className="mb-8">
          <div className="h-3 w-24 rounded-sm bg-ink-700/70" />
          <div className="mt-3 h-9 w-2/3 rounded-sm bg-ink-700/70 sm:h-10" />
          <div className="mt-3 h-4 w-3/4 rounded-sm bg-ink-700/50" />
        </div>

        {/* Card row skeleton */}
        <div className="t2q-premium-card-static p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </div>
        </div>

        {/* List skeleton */}
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="t2q-premium-card-static flex items-center justify-between gap-3 p-4"
            >
              <div className="flex-1">
                <div className="h-3 w-20 rounded-sm bg-ink-700/70" />
                <div className="mt-2 h-4 w-3/4 rounded-sm bg-ink-700/50" />
                <div className="mt-1.5 h-3 w-1/2 rounded-sm bg-ink-700/40" />
              </div>
              <div className="h-5 w-24 rounded-sm bg-ink-700/70" />
            </div>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
          {"// loading the tools"}
        </p>
      </main>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="rounded-sm border border-ink-700/60 bg-ink-900/40 p-3">
      <div className="h-6 w-16 rounded-sm bg-ink-700/70" />
      <div className="mt-3 h-3 w-24 rounded-sm bg-ink-700/50" />
    </div>
  );
}
