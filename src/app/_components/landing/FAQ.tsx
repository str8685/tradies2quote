"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";

/**
 * Common questions accordion. Native `<details>` was working but the
 * snap-open/snap-close felt cheap next to the rest of the page. This
 * version uses framer-motion's AnimatePresence to interpolate height +
 * opacity for a smooth open/close, with a chevron that rotates.
 *
 * Ported from the Emergent landing-export bundle to TSX. Single-open
 * behaviour: clicking an already-open item closes it. Keyboard activated
 * via the surrounding `<button>` so screen readers still announce the
 * expanded state via `aria-expanded`.
 */

const FAQS = [
  {
    slug: "tech-skill",
    q: "Do I need any tech skill to use T2Q?",
    a: "Nope. Open the app, hit the big orange button, talk for 60 seconds, hit send. That's it.",
  },
  {
    slug: "regions",
    q: "What if I'm in NZ / AU / UK / US / CA?",
    a: "NZ today — that's where we've launched, with GST 15% baked in and NZ supplier integrations on the way (ITM, Mitre 10, Bunnings). AU, UK, US and CA are queued; drop your country at signup and we'll email you the day it switches on in your region.",
  },
  {
    slug: "edit-quote",
    q: "Can I edit a quote after it's generated?",
    a: "Yeah. Tweak any line item, change the price, add a note. The PDF re-renders in a click.",
  },
  {
    slug: "data-safety",
    q: "Is my data safe?",
    a: "Your client list is yours. We never sell it, never share it, and you can export the whole lot to a CSV any time. Encrypted in transit and at rest, hosted on Supabase.",
  },
  {
    slug: "replaces-jms",
    q: "Will it replace my job-management software?",
    a: "No, and that's the point. We do quoting fast. Pair us with whatever you already use for invoicing or scheduling.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section
      id="faq"
      data-testid="section-faq"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32"
    >
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <div className="text-center mb-12">
          <div className="t2q-section-label mb-4 inline-block">{"// straight talk"}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase">
            Common <span className="text-brand">questions.</span>
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item) => {
            const isOpen = open === item.slug;
            return (
              <div
                key={item.slug}
                data-testid={`faq-item-${item.slug}`}
                className={`border bg-ink-800 rounded-sm px-5 transition-colors ${
                  isOpen ? "border-brand" : "border-ink-600"
                }`}
              >
                <button
                  type="button"
                  data-testid={`faq-toggle-${item.slug}`}
                  onClick={() => setOpen(isOpen ? null : item.slug)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-left font-display text-lg sm:text-xl uppercase tracking-tight py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
                >
                  <span>{item.q}</span>
                  <CaretDown
                    size={20}
                    weight="bold"
                    className={`shrink-0 text-brand transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p
                        data-testid={`faq-answer-${item.slug}`}
                        className="text-ink-300 text-base leading-relaxed pb-5"
                      >
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
