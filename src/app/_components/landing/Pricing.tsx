"use client";

import Link from "next/link";
import { Check, Lightning } from "@phosphor-icons/react";
import { TiltCard } from "./TiltCard";
import { Magnetic } from "./Magnetic";

/**
 * Pricing tiers — three TiltCards. The middle "Most popular" tier gets a
 * brand border + brutal shadow + a hi-vis ribbon tab anchored to the top.
 *
 * Ported from the Emergent landing-export bundle. Wrapping each CTA in
 * Magnetic gives the card a satisfying pull-to-cursor moment when the
 * tradie is reaching for the button. TiltCards (with extra depth on this
 * section, liftZ 40) make the whole tier feel like it's lifting off the
 * page on hover.
 */

const TIERS = [
  {
    name: "Solo",
    slug: "solo",
    tag: "For 1-man bands",
    price: 29,
    highlight: false,
    features: [
      "Unlimited quotes & invoices",
      "1 user account",
      "Branded PDF + email",
      "Client list",
      "Email support",
    ],
  },
  {
    name: "Crew",
    slug: "crew",
    tag: "Most tradies pick this",
    price: 79,
    highlight: true,
    features: [
      "Everything in Solo",
      "Up to 5 users",
      "Shared client list",
      "Photo attachments",
      "Priority support",
    ],
  },
  {
    name: "Builder",
    slug: "builder",
    tag: "Small crews + GCs",
    price: 199,
    highlight: false,
    features: [
      "Everything in Crew",
      "Up to 20 users",
      "Custom terms templates",
      "Dedicated success mate",
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      data-testid="section-pricing"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-brand/10 blur-3xl pointer-events-none animate-blob-slow" />
      <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] rounded-full bg-hivis/8 blur-3xl pointer-events-none animate-blob" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="t2q-section-label mb-4 mx-auto inline-block">{"// pricing"}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
            Less than a box of screws. <br />
            <span className="text-brand">Saves your Sundays.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-200">
            7-day free trial. No credit card. Cancel by text if you want.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-hivis">
            {"// beta tradies pay $0 until launch — these rates lock when we go live"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((t) => (
            <TiltCard
              key={t.slug}
              className={`border-2 ${
                t.highlight
                  ? "border-brand bg-ink-800 t2q-shadow-brutal"
                  : "border-ink-600 bg-ink-800/70"
              } rounded-sm`}
              innerClassName="p-8 md:p-10 flex flex-col h-full relative"
              maxTiltX={8}
              maxTiltY={10}
              liftZ={36}
              testid={`pricing-tier-${t.slug}`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-6 bg-hivis text-ink-900 font-display text-xs px-3 py-1 uppercase tracking-tight flex items-center gap-1.5 z-10">
                  <Lightning size={12} weight="fill" /> Most popular
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-3xl uppercase tracking-tight">{t.name}</h3>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-300">
                  {t.tag}
                </span>
              </div>
              <div className="mt-6 flex items-end gap-1">
                <span className="font-display text-6xl text-white">${t.price}</span>
                <span className="text-ink-300 mb-2">/mo</span>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check size={20} weight="bold" className="text-brand shrink-0 mt-0.5" />
                    <span className="text-ink-100">{f}</span>
                  </li>
                ))}
              </ul>
              <Magnetic strength={0.18} className="mt-8 w-full">
                <Link
                  href="/signup"
                  data-testid={`pricing-cta-${t.slug}`}
                  className={`${t.highlight ? "t2q-btn-primary" : "t2q-btn-ghost"} w-full`}
                >
                  Join the beta
                </Link>
              </Magnetic>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
