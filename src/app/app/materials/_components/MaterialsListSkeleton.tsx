/**
 * Materials list skeleton — Wave 17 — perf.
 *
 * Mirrors the action row (// X items saved + Import CSV + Add material
 * buttons) and the search input + 5 list rows that follow, so when
 * the Supabase query lands the swap-in has zero layout shift.
 *
 * Server-renderable, zero JS, GPU-only `animate-pulse`.
 */
export function MaterialsListSkeleton() {
  return (
    <div
      data-testid="materials-list-skeleton"
      aria-hidden="true"
      className="animate-pulse"
    >
      {/* Action row placeholder — // X items saved label on the left,
          Import CSV + Add material buttons on the right. Layout
          matches the real action row in `materials/page.tsx`. */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-3 w-32 rounded-sm bg-ink-700" />
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-sm bg-ink-700" />
          <div className="h-10 w-36 rounded-sm bg-brand/50" />
        </div>
      </div>

      {/* Search input placeholder — matches `MaterialsList.tsx`'s
          input height (py-2.5 ≈ 42px) + border styling. */}
      <div className="mt-6">
        <div className="h-11 rounded-sm border border-ink-700 bg-ink-800" />

        {/* 5 row placeholders — matches the average tradie library's
            first-page count. */}
        <ul className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="rounded-sm border border-ink-700 bg-ink-800 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded-sm bg-ink-700" />
                  <div className="h-3 w-1/3 rounded-sm bg-ink-700" />
                </div>
                <div className="h-9 w-9 rounded-sm bg-ink-700" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
