import {
  ClockCounterClockwise,
  EnvelopeOpen,
  ListChecks,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";

const POINTS = [
  {
    slug: "weekend-admin",
    icon: ClockCounterClockwise,
    title: "Quoting eats your weekend",
    body: "You're back at the laptop on Sunday night, copy-pasting line items from the last job and second-guessing the numbers.",
  },
  {
    slug: "slow-followup",
    icon: EnvelopeOpen,
    title: "Slow quotes lose jobs",
    body: "By the time you've typed it up, the next sparky already sent theirs. Fast quote out = job won.",
  },
  {
    slug: "patchy-detail",
    icon: ListChecks,
    title: "Vague quotes start arguments",
    body: "\"Did you include the bracing?\" If labour and materials aren't broken out, you wear the difference.",
  },
  {
    slug: "invoice-drag",
    icon: Receipt,
    title: "Invoicing happens too late",
    body: "Job's done weeks ago, the invoice is still sitting in drafts, and your bank balance feels it.",
  },
];

export function Pain() {
  return (
    <section
      id="pain"
      data-testid="section-pain"
      className="relative border-b border-ink-600 bg-ink-950 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute inset-0 t2q-grid-bg opacity-30 pointer-events-none" />
      <div className="absolute -top-32 right-0 w-[480px] h-[480px] rounded-full bg-brand/10 blur-3xl pointer-events-none animate-blob" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">// the real problem</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
              The job&apos;s the easy bit. <br />
              <span className="text-brand">Admin&apos;s the killer.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-4 text-lg text-ink-300 leading-relaxed">
            You didn&apos;t pick up the tools to spend your evenings in spreadsheets. But the
            quote, the follow-up, the invoice — that&apos;s where the money lives or dies.
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-ink-600 border border-ink-600">
          {POINTS.map(({ slug, icon: Icon, title, body }) => (
            <div
              key={slug}
              data-testid={`pain-point-${slug}`}
              className="bg-ink-900 p-8 md:p-10 group hover:bg-ink-800 transition-colors"
            >
              <Icon
                size={28}
                weight="bold"
                className="text-brand mb-6 group-hover:text-hivis transition-colors"
              />
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight mb-2">
                {title}
              </h3>
              <p className="text-ink-300 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
