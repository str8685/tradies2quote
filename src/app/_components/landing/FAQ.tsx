import { Plus, Minus } from "@phosphor-icons/react/dist/ssr";

const FAQS = [
  {
    slug: "tech-skill",
    q: "Do I need to know AI or tech?",
    a: "Nope. Open the app, hit the big orange button, talk for 60 seconds, hit send. That's it.",
  },
  {
    slug: "regions",
    q: "What if I'm in NZ / AU / UK / US / CA?",
    a: "We auto-handle GST, VAT, sales tax — set your country in settings and it just works.",
  },
  {
    slug: "edit-quote",
    q: "Can I edit a quote after it's generated?",
    a: "Yeah. Tweak any line item, change the price, add a note. The PDF re-renders in a click.",
  },
  {
    slug: "data-safety",
    q: "Is my data safe?",
    a: "Encrypted in transit and at rest. We never share your client list. Cancel anytime and export everything.",
  },
  {
    slug: "replaces-jms",
    q: "Will it replace my job-management software?",
    a: "No, and that's the point. We do quoting fast. Pair us with whatever you already use for invoicing or scheduling.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      data-testid="section-faq"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32"
    >
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <div className="text-center mb-12">
          <div className="t2q-section-label mb-4 inline-block">// straight talk</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase">
            Common <span className="text-brand">questions.</span>
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.slug}
              data-testid={`faq-item-${item.slug}`}
              className="group border border-ink-600 bg-ink-800 rounded-sm px-5 transition-colors open:border-brand"
            >
              <summary
                data-testid={`faq-toggle-${item.slug}`}
                className="list-none cursor-pointer w-full text-left font-display text-lg sm:text-xl uppercase tracking-tight py-5 flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm [&::-webkit-details-marker]:hidden"
              >
                <span>{item.q}</span>
                <span className="text-brand shrink-0" aria-hidden="true">
                  <Plus size={20} weight="bold" className="block group-open:hidden" />
                  <Minus size={20} weight="bold" className="hidden group-open:block" />
                </span>
              </summary>
              <div
                data-testid={`faq-answer-${item.slug}`}
                className="text-ink-300 text-base leading-relaxed pb-5"
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
