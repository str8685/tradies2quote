/**
 * Fast loading state for `/app/quotes/new`.
 *
 * Kept route-local so tapping "New quote" from the dashboard gets an
 * immediate, useful loading screen while the auth/subscription gate resolves,
 * without bringing the heavier app splash back between every /app tab.
 */
export default function NewQuoteLoading() {
  return (
    <div className="min-h-screen text-white">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// step 1 of 3"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Getting the <span className="text-brand">recorder</span> ready.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-ink-300 sm:text-base">
            Checking access and warming up the quote flow.
          </p>
        </div>

        <section
          data-testid="new-quote-loading"
          role="status"
          aria-live="polite"
          className="t2q-card-pro p-6 sm:p-8"
        >
          <div className="flex flex-col items-center text-center">
            <div
              aria-hidden="true"
              className="relative grid h-28 w-28 place-items-center rounded-full border-2 border-brand bg-ink-900 text-brand"
            >
              <span className="absolute inset-0 rounded-full border-2 border-brand animate-pulse-ring" />
              <span className="h-10 w-10 rounded-full border-4 border-brand/40 border-t-brand animate-spin" />
            </div>

            <p className="t2q-loading-caption mt-6 font-mono text-xs uppercase tracking-[0.22em] text-ink-300">
              {"// loading new quote"}
            </p>

            <div className="mt-6 w-full max-w-sm space-y-3 animate-pulse">
              <div className="h-3 rounded-sm bg-ink-700" />
              <div className="mx-auto h-3 w-2/3 rounded-sm bg-ink-700" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
