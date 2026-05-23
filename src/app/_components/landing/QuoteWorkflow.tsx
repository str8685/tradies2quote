import { AppShowcase } from "./AppShowcase";

/**
 * "From voice to quote" workflow section — the headline row plus the animated
 * in-app AppShowcase tour. Visual / marketing only:
 *
 *   - No imports from src/lib/quote*, src/lib/material*, or any API
 *   - No reads from Supabase, no writes anywhere
 *
 * The original four demo step-cards (Describe / AI Review / Takeoff / Quote)
 * were removed once the AppShowcase tour replaced them — the showcase walks
 * the same story end-to-end with real app screens.
 *
 * Sits between Pain and HowItWorks in the page render order.
 */
export function QuoteWorkflow() {
  return (
    <section
      id="workflow"
      data-testid="section-quote-workflow"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32 overflow-hidden"
    >
      {/* Backdrop layers — match the rest of the page's atmosphere */}
      <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-30" />
      <div className="pointer-events-none absolute inset-0 t2q-noise opacity-30" />
      <div className="pointer-events-none absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-brand/15 blur-3xl animate-blob-slow" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 w-[460px] h-[460px] rounded-full bg-hivis/10 blur-3xl animate-blob" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-14 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">
              {"// from voice to paid"}
            </div>
            <h2 className="font-display text-4xl uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
              From voice <br />
              <span className="text-brand">to quote.</span>
              <br />
              Start to finish.
            </h2>
          </div>
          <div className="text-lg leading-relaxed text-ink-200 lg:col-span-7 lg:pt-4">
            Talk through the job — same way you&apos;d explain it to your
            apprentice. T2Q builds the takeoff, surfaces what to double-check,
            and renders a branded quote PDF you can send before you&apos;ve packed
            up the ute. <span className="text-white">Demo data shown.</span>
          </div>
        </div>

        {/* Animated in-app tour */}
        <AppShowcase />
      </div>
    </section>
  );
}
