import {
  Microphone,
  Sparkle,
  PaperPlaneTilt,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";

const STEPS = [
  {
    n: "01",
    slug: "talk",
    title: "Record the job",
    body: "Walk the site. Hit record. Describe the job in your own words. No forms, no menus.",
    icon: Microphone,
  },
  {
    n: "02",
    slug: "ai-builds",
    title: "Quote builds itself",
    body: "Line items, materials, labour, GST and terms — laid out the way clients expect.",
    icon: Sparkle,
  },
  {
    n: "03",
    slug: "send",
    title: "Review and send",
    body: "Tweak any line, then send a branded PDF to your client. Nothing leaves until you tap send.",
    icon: PaperPlaneTilt,
  },
  {
    n: "04",
    slug: "invoice",
    title: "Convert to invoice",
    body: "Job done? Turn the quote into an invoice in one tap. GST sorted, payment terms set.",
    icon: Receipt,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      data-testid="section-how-it-works"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="max-w-3xl mb-16">
          <div className="t2q-section-label mb-4">{"// the workflow"}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
            Four steps. <br />
            <span className="text-brand">Zero forms.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-200 max-w-xl">
            Built for tradies, not office workers. No drag-and-drop. No drop-downs. No buried menus.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ n, slug, title, body, icon: Icon }) => (
            <div
              key={n}
              data-testid={`how-step-${slug}`}
              className="group rounded-lg border border-white/10 bg-ink-800/80 p-6 transition-colors hover:border-brand/45 hover:bg-ink-800 md:p-7"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-display text-5xl text-ink-700 transition-colors group-hover:text-brand">
                  {n}
                </span>
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-brand/35 bg-brand/10 transition-colors group-hover:border-brand group-hover:bg-brand">
                  <Icon
                    size={22}
                    weight="bold"
                    className="text-brand transition-colors group-hover:text-ink-900"
                  />
                </div>
              </div>
              <h3 className="font-display text-2xl uppercase tracking-tight mb-3">{title}</h3>
              <p className="text-ink-100 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
