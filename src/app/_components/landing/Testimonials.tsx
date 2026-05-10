"use client";

import { TiltCard } from "./TiltCard";

/**
 * Testimonials grid — three review cards with subtle 3D tilt on hover.
 * Quotes are illustrative for the beta. Replace with real client copy
 * when consent is in hand.
 *
 * Ported from the Emergent landing-export bundle to TSX.
 */

type Review = {
  quote: string;
  name: string;
  trade: string;
};

const REVIEWS: Review[] = [
  {
    quote:
      "Finished a job in Glen Eden, drove to the next site, and had the quote sent before I unloaded the gear. Mental.",
    name: "Riki T.",
    trade: "Builder · Auckland",
  },
  {
    quote:
      "I used to lose every Sunday to quoting. First weekend back with my kids in years.",
    name: "Macca",
    trade: "Plumber · Brisbane",
  },
  {
    quote:
      "Clients are stoked. Looks proper. Looks like I have an office team. I do not.",
    name: "James W.",
    trade: "Sparkie · Manchester",
  },
];

export function Testimonials() {
  return (
    <section
      data-testid="testimonials-section"
      className="relative overflow-hidden border-b border-ink-600 bg-ink-800 py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 t2q-noise opacity-40" />
      <div className="pointer-events-none absolute -top-32 -left-20 h-[500px] w-[500px] rounded-full bg-brand/10 blur-3xl animate-blob" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-14 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">{"// from the site"}</div>
            <h2 className="font-display text-4xl uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
              No suits. <br />
              <span className="text-brand">Just tradies.</span>
            </h2>
          </div>
          <div className="text-lg text-ink-200 lg:col-span-7 lg:pt-4">
            Built by Challis, a qualified builder running STR8 Builders in NZ.
            He built this for himself first. Then his mates wanted it. Then
            the mates of his mates. Now it&apos;s yours.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {REVIEWS.map((r, i) => (
            <TiltCard
              key={i}
              className="rounded-sm border border-ink-600 bg-ink-900"
              innerClassName="flex h-full flex-col p-8 md:p-10"
              maxTiltX={6}
              maxTiltY={8}
              liftZ={24}
              testid={`testimonial-${i}`}
            >
              <div className="mb-4 font-display text-5xl leading-none text-brand">
                &ldquo;
              </div>
              <blockquote className="flex-1 text-lg leading-relaxed text-ink-100">
                {r.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-ink-700 pt-6">
                <div className="font-display text-base uppercase tracking-tight">
                  {r.name}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
                  {r.trade}
                </div>
              </figcaption>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
