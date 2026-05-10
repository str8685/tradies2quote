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
            Three steps. <br />
            <span className="text-brand">Zero forms.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-300 max-w-xl">
            Built for tradies, not office workers. No drag-and-drop. No drop-downs. No bloody menus.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-ink-600 border border-ink-600">
          {STEPS.map(({ n, slug, title, body, icon: Icon }) => (
            <div
              key={n}
              data-testid={`how-step-${slug}`}
              className="bg-ink-900 p-8 md:p-10 group hover:bg-ink-800 transition-colors"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-display text-5xl text-ink-700 group-hover:text-brand transition-colors">
                  {n}
                </span>
                <div className="w-12 h-12 grid place-items-center bg-ink-800 border border-ink-600 group-hover:bg-brand group-hover:border-brand transition-colors">
                  <Icon
                    size={20}
                    weight="bold"
                    className="text-brand group-hover:text-ink-900 transition-colors"
                  />
                </div>
              </div>
              <h3 className="font-display text-2xl uppercase tracking-tight mb-3">{title}</h3>
              <p className="text-ink-300 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
