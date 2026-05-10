"use client";

import {
  ClockCounterClockwise,
  EnvelopeOpen,
  ListChecks,
  Receipt,
} from "@phosphor-icons/react";
import { TiltCard } from "./TiltCard";

/**
 * "The real problem" pain-points grid.
 *
 * Ported from the Emergent landing-export bundle. Each card is wrapped in
 * a TiltCard so it lifts toward the cursor on hover with a cursor-tracked
 * glare — adds depth without committing to a heavy framer-motion enter
 * animation. Uses Phosphor icons (matches the rest of the app).
 */

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
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute -top-40 -right-20 w-[500px] h-[500px] rounded-full bg-brand/10 blur-3xl pointer-events-none animate-blob" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <div className="max-w-3xl mb-16">
          <div className="t2q-section-label mb-4">{"// the real problem"}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
            The job&apos;s the easy bit. <br />
            <span className="text-brand">Admin&apos;s the killer.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-200 max-w-2xl">
            You didn&apos;t pick up the tools to spend your evenings in spreadsheets. But the
            quote, the follow-up, the invoice — that&apos;s where the money lives or dies.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {POINTS.map(({ slug, icon: Icon, title, body }) => (
            <TiltCard
              key={slug}
              className="bg-ink-800 border border-ink-600 rounded-sm h-full"
              innerClassName="p-6 md:p-7 flex flex-col h-full"
              maxTiltX={5}
              maxTiltY={7}
              liftZ={18}
              testid={`pain-point-${slug}`}
            >
              <Icon size={28} weight="bold" className="text-brand mb-5" />
              <h3 className="font-display text-lg uppercase tracking-tight mb-2 leading-tight">
                {title}
              </h3>
              <p className="text-ink-200 text-sm leading-relaxed">{body}</p>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
