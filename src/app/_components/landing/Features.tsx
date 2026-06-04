"use client";

import Image from "next/image";
import {
  Hammer,
  Wrench,
  PaintRoller,
  Plug,
  Tree,
  HardHat,
  SealCheck,
  Money,
  DeviceMobile,
  Receipt,
} from "@phosphor-icons/react";
import { TiltCard } from "./TiltCard";

/**
 * "What's in the toolbox" bento + trades marquee.
 *
 * Ported from the Emergent landing-export bundle. The four feature cards
 * sit in a 3-column bento (two cards span 2 columns each) and use TiltCard
 * for cursor-tracked depth. The trades marquee is now framed by the
 * `t2q-tape-strip` utility (animated metallic measuring-tape) instead of
 * the previous flat caution-stripe band — that's the most visible polish
 * upgrade in the section.
 *
 * The visual band uses real in-app screenshots instead of stock imagery so
 * the section sells the product itself.
 */

const FEATURES = [
  {
    slug: "voice-first",
    title: "Voice-first, thumb-friendly",
    body: "Big buttons designed for muddy fingers and bright sunlight. Tap, talk, done.",
    icon: DeviceMobile,
    image: "/screens/screen-4.jpg",
    imageAlt: "Tradies2Quote voice recording screen with large quote input controls",
    span: "md:col-span-2",
  },
  {
    slug: "branded-pdf",
    title: "Branded quote PDFs",
    body: "Your logo, ABN/NZBN, terms — auto-stamped on every quote.",
    icon: SealCheck,
    image: "/screens/screen-8.jpg",
    imageAlt: "Tradies2Quote branded quote preview ready to send",
  },
  {
    slug: "tax-built-in",
    title: "GST/Tax built in",
    body: "NZ 15%, AU 10%, UK 20%. Set once, applied everywhere.",
    icon: Receipt,
    image: "/screens/screen-6.jpg",
    imageAlt: "Tradies2Quote quote total with GST and line items",
  },
  {
    slug: "materials-labour",
    title: "Materials + Labour breakdown",
    body: "Materials and labour split out clearly — the way clients actually want to read them.",
    icon: Money,
    image: "/screens/screen-5.jpg",
    imageAlt: "Tradies2Quote materials library and supplier capture screen",
    span: "md:col-span-2",
  },
];

const TRADES = [
  { label: "Builders", icon: Hammer },
  { label: "Plumbers", icon: Wrench },
  { label: "Sparkies", icon: Plug },
  { label: "Painters", icon: PaintRoller },
  { label: "Landscapers", icon: Tree },
  { label: "Roofers", icon: HardHat },
];

const FEATURE_BAND_SCREENS = [
  {
    src: "/screens/screen-4.jpg",
    alt: "Voice input screen for building a quote from a site walkthrough",
  },
  {
    src: "/screens/screen-6.jpg",
    alt: "Quote editor showing materials, labour, GST and total",
  },
  {
    src: "/screens/screen-9.jpg",
    alt: "Invoice and payment workflow screen inside Tradies2Quote",
  },
];

export function Features() {
  return (
    <section
      id="features"
      data-testid="section-features"
      className="relative border-b border-ink-600 bg-ink-800 py-24 md:py-32"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">{"// what's in the toolbox"}</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
              Less app.
              <br />
              <span className="text-hivis">More tool.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-4">
            <p className="text-lg text-ink-200 leading-relaxed">
              Tradify, Fergus, simPRO — they&apos;re powerful job-management systems that can take
              serious setup time. tradies2Quote does{" "}
              <span className="text-white font-semibold">one thing</span>: quotes done fast by
              voice. That&apos;s the focus.
            </p>
          </div>
        </div>

        {/* Visual band — product proof, not stock imagery. */}
        <div
          data-testid="features-visual-band"
          className="relative mb-10 overflow-hidden rounded-lg border border-white/10 bg-ink-950"
        >
          <div className="absolute inset-0 t2q-grid-bg opacity-30 pointer-events-none" />
          <div className="relative grid gap-8 p-6 md:grid-cols-[0.85fr_1.15fr] md:items-center md:p-8 lg:p-10">
            <div className="max-w-lg">
              <div className="t2q-section-label mb-2">{"// reality check"}</div>
              <p className="font-display text-2xl md:text-3xl uppercase tracking-tighter leading-[0.95] text-white">
                Stop losing your weekends to quotes.
              </p>
              <p className="mt-4 text-sm md:text-base leading-relaxed text-ink-200">
                The cards below now show the actual workflow: talk through the job, check the
                numbers, send the quote, then turn it into an invoice.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {FEATURE_BAND_SCREENS.map((screen, index) => (
                <div
                  key={screen.src}
                  className={`relative aspect-[9/14] overflow-hidden rounded-lg border border-white/10 bg-ink-900 shadow-2xl ${
                    index === 1 ? "translate-y-3" : ""
                  }`}
                >
                  <Image
                    src={screen.src}
                    alt={screen.alt}
                    fill
                    sizes="(min-width: 1024px) 240px, 30vw"
                    className="object-cover object-top"
                    priority={false}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/85 to-transparent" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bento — TiltCards for hover depth */}
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ slug, title, body, icon: Icon, image, imageAlt, span }) => (
            <TiltCard
              key={slug}
              className={`${span ?? ""} rounded-lg border border-white/10 bg-ink-900/95 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.9)]`}
              innerClassName="p-5 md:p-6 group h-full"
              maxTiltX={6}
              maxTiltY={8}
              liftZ={20}
              testid={`feature-card-${slug}`}
            >
              <div className="relative mb-5 h-36 overflow-hidden rounded-lg border border-white/10 bg-ink-950 md:h-40">
                <Image
                  src={image}
                  alt={imageAlt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover object-top opacity-95 transition-transform duration-500 group-hover:scale-[1.03]"
                  priority={false}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/90 to-transparent" />
              </div>
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10">
                  <Icon
                    size={24}
                    weight="bold"
                    className="text-brand group-hover:text-hivis transition-colors"
                  />
                </div>
                <div>
                  <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight mb-2">
                    {title}
                  </h3>
                  <p className="text-ink-100 leading-relaxed">{body}</p>
                </div>
              </div>
            </TiltCard>
          ))}
        </div>

        {/* Trades marquee — framed top + bottom by animated tape strips, pause on hover */}
        <div className="relative mt-16 -mx-6 md:-mx-12 group">
          <div className="t2q-tape-strip border-y-2 border-ink-900" style={{ height: "16px" }} />
          <div className="overflow-hidden no-scrollbar bg-ink-900 border-x-0">
            <div className="flex animate-marquee whitespace-nowrap py-6 group-hover:[animation-play-state:paused]">
              {[...TRADES, ...TRADES, ...TRADES].map(({ label, icon: Icon }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-10 text-ink-200 hover:text-white transition-colors"
                >
                  <Icon size={24} weight="bold" className="text-brand" />
                  <span className="font-display text-2xl uppercase tracking-tight">{label}</span>
                  <span className="w-2 h-2 bg-ink-600 ml-6" />
                </div>
              ))}
            </div>
          </div>
          <div
            className="t2q-tape-strip t2q-tape-strip-reverse border-y-2 border-ink-900"
            style={{ height: "16px" }}
          />
        </div>
      </div>
    </section>
  );
}
