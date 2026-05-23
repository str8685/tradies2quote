"use client";

import { motion } from "framer-motion";
import {
  Microphone,
  Sparkle,
  Ruler,
  Receipt,
  Check,
  Warning,
  CheckCircle,
  type Icon,
} from "@phosphor-icons/react";
import { TiltCard } from "./TiltCard";
import { AppShowcase } from "./AppShowcase";

/**
 * Describe → AI Review → Takeoff → Quote — the four-step workflow that
 * turns a voice memo into a branded quote. Visual / marketing only:
 *
 *   - 100% demo data hard-coded in this file
 *   - No imports from src/lib/quote*, src/lib/material*, or any API
 *   - No reads from Supabase, no writes anywhere
 *
 * Each step is a glass card (`t2q-glass-card`) wrapped in TiltCard for
 * cursor-tracked 3D depth. The outer wrapper uses framer-motion
 * `whileInView` so the cards stagger into view as the user scrolls down.
 *
 * Sits between Pain and HowItWorks in the page render order — Pain sets
 * up the problem, this section walks through the solution end-to-end,
 * HowItWorks zooms back out into a 4-step summary.
 */

type Step = {
  n: string;
  slug: "describe" | "review" | "takeoff" | "quote";
  eyebrow: string;
  title: string;
  blurb: string;
  icon: Icon;
};

const STEPS: Step[] = [
  {
    n: "01",
    slug: "describe",
    eyebrow: "// describe",
    title: "Talk through the job",
    blurb:
      "Walk the site, hit record, describe what you'd quote in your head. No forms.",
    icon: Microphone,
  },
  {
    n: "02",
    slug: "review",
    eyebrow: "// ai review",
    title: "We catch the stuff you'd miss",
    blurb:
      "Labour, materials, waste, access, finish, GST — every line flagged before send.",
    icon: Sparkle,
  },
  {
    n: "03",
    slug: "takeoff",
    eyebrow: "// takeoff",
    title: "Auto-priced quantities",
    blurb:
      "Sheet counts, lineal metres, m² — costed against your supplier rates.",
    icon: Ruler,
  },
  {
    n: "04",
    slug: "quote",
    eyebrow: "// quote",
    title: "Branded PDF, ready to send",
    blurb:
      "GST split, terms baked in. One tap and it's in your client's inbox.",
    icon: Receipt,
  },
];

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
              In four steps.
            </h2>
          </div>
          <div className="text-lg leading-relaxed text-ink-200 lg:col-span-7 lg:pt-4">
            Talk through the job — same way you&apos;d explain it to your
            apprentice. T2Q builds the takeoff, surfaces what to double-check,
            and renders a branded quote PDF you can send before you&apos;ve packed
            up the ute. <span className="text-white">Demo data shown.</span>
          </div>
        </div>

        {/* Animated in-app tour — full width under the headline row. */}
        <div className="mb-16">
          <AppShowcase />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                delay: i * 0.08,
                duration: 0.5,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              <TiltCard
                className="t2q-glass-card h-full"
                innerClassName="flex h-full flex-col p-6 md:p-7"
                maxTiltX={5}
                maxTiltY={7}
                liftZ={20}
                testid={`workflow-step-${step.slug}`}
              >
                <Header step={step} />
                <div className="mt-6 mb-6 flex-1">
                  <StepBody slug={step.slug} />
                </div>
                <div className="border-t border-ink-700/70 pt-4">
                  <h3 className="font-display text-base uppercase leading-tight tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
                    {step.blurb}
                  </p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Header({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center border border-ink-600 bg-ink-900 text-brand">
          <Icon size={20} weight="bold" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
          {step.eyebrow}
        </div>
      </div>
      <span className="font-display text-3xl leading-none tracking-tighter text-ink-700">
        {step.n}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Step bodies — pure-presentation, demo data only.
   ────────────────────────────────────────────────────────────────────── */

function StepBody({ slug }: { slug: Step["slug"] }) {
  if (slug === "describe") return <DescribeBody />;
  if (slug === "review") return <ReviewBody />;
  if (slug === "takeoff") return <TakeoffBody />;
  return <QuoteBody />;
}

const WAVE_HEIGHTS = [
  35, 60, 80, 50, 90, 72, 55, 82, 40, 68, 88, 50, 78, 58, 72, 48, 64, 82,
];

function DescribeBody() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="relative grid h-9 w-9 place-items-center bg-brand text-ink-900 rounded-sm">
          <Microphone size={16} weight="bold" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
        </span>
        <div>
          <div className="font-display text-xs uppercase tracking-tight text-white">
            Recording
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            00:47 · auto-saving
          </div>
        </div>
      </div>

      <div
        className="flex items-end gap-1 h-12"
        aria-hidden="true"
        data-testid="workflow-waveform"
      >
        {WAVE_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="t2q-wave-bar animate-wave"
            style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>

      <blockquote className="rounded-sm border border-ink-700 bg-ink-900/70 p-3 font-mono text-[11px] leading-relaxed text-ink-200">
        <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-brand mb-1.5">
          {"// transcript"}
        </span>
        &ldquo;Replace 12 GIB sheets, add H3.2 framing, insulation, and
        repaint.&rdquo;
      </blockquote>

      <div className="flex flex-wrap gap-1.5">
        {["Bedroom · 4×3 m", "Standard finish", "Auckland · access OK"].map(
          (chip) => (
            <span
              key={chip}
              className="border border-ink-600 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-200"
            >
              {chip}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

type ReviewItem = { label: string; status: "ok" | "warn"; note: string };
const REVIEW_ITEMS: ReviewItem[] = [
  { label: "Labour hours", status: "ok", note: "12.5 hrs" },
  { label: "Material prices", status: "ok", note: "Bunnings · live" },
  { label: "Waste allowance", status: "warn", note: "Bumped 8% → 12%" },
  { label: "Site access", status: "ok", note: "Driveway OK" },
  { label: "Finish level", status: "warn", note: "Standard?" },
  { label: "GST 15%", status: "ok", note: "Applied" },
];

function ReviewBody() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-sm border border-brand/40 bg-brand/10 p-3">
        <Warning
          size={16}
          weight="fill"
          className="shrink-0 mt-0.5 text-brand"
        />
        <div>
          <div className="font-display text-xs uppercase tracking-tight text-white">
            Review before sending
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            6 line items · 2 to confirm
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5">
        {REVIEW_ITEMS.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between gap-2 rounded-sm border border-ink-700 bg-ink-900/60 px-2.5 py-1.5"
          >
            <span className="flex items-center gap-2">
              {it.status === "ok" ? (
                <CheckCircle
                  size={14}
                  weight="fill"
                  className="text-green-400"
                />
              ) : (
                <Warning size={14} weight="fill" className="text-hivis" />
              )}
              <span className="font-display text-[11px] uppercase tracking-tight text-white">
                {it.label}
              </span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300">
              {it.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Material = { d: string; q: string; v: string };
const MATERIALS: Material[] = [
  { d: "GIB Standard 10mm · 2400×1200", q: "×12", v: "$189" },
  { d: "H3.2 90×45 framing", q: "24 lm", v: "$312" },
  { d: "Pink Batts R2.6 · wall", q: "8 m²", v: "$245" },
  { d: "Paint + prep + sundries", q: "kit", v: "$180" },
];

function TakeoffBody() {
  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {MATERIALS.map((m) => (
          <li
            key={m.d}
            className="flex items-center justify-between gap-2 rounded-sm border border-ink-700 bg-ink-900/70 px-2.5 py-2 text-[11px]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Check size={12} weight="bold" className="shrink-0 text-brand" />
              <span className="truncate text-ink-100">{m.d}</span>
            </span>
            <span className="flex items-baseline gap-2 shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">
                {m.q}
              </span>
              <span className="font-mono text-ink-100">{m.v}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-ink-700/70 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
          Materials subtotal
        </span>
        <span className="font-display text-xl text-brand leading-none">
          $926
        </span>
      </div>
    </div>
  );
}

const QUOTE_ROWS: Array<[string, string]> = [
  ["Materials", "$926"],
  ["Labour · 12.5 hrs", "$1,840"],
  ["Markup · 18%", "$554"],
  ["GST · 15%", "$498"],
];

function QuoteBody() {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border-2 border-ink-700 bg-white p-3 t2q-shadow-brutal">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-brand">
              {"// quote · q-202605-12"}
            </div>
            <div className="mt-0.5 font-display text-[11px] uppercase tracking-tighter leading-tight text-ink-900">
              Bedroom reline + repaint
            </div>
            <div className="mt-0.5 text-[9px] text-ink-500 leading-snug">
              For Sarah K · Auckland · 30 days
            </div>
          </div>
          <span className="px-1.5 py-0.5 bg-hivis text-ink-900 font-display text-[8px] uppercase tracking-tight rounded-sm shrink-0">
            GST inc.
          </span>
        </div>

        <ul className="mt-3 divide-y divide-ink-100">
          {QUOTE_ROWS.map(([label, value]) => (
            <li
              key={label}
              className="flex items-center justify-between py-1 text-[10px]"
            >
              <span className="text-ink-500 font-mono uppercase tracking-[0.15em]">
                {label}
              </span>
              <span className="font-mono text-ink-900">{value}</span>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-end justify-between border-t-2 border-ink-200 pt-2">
          <span className="font-display text-[10px] uppercase tracking-tight text-ink-900">
            Total NZD
          </span>
          <span className="font-display text-2xl leading-none text-brand">
            $3,818
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-ink-700 bg-ink-900/60 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-200">
          Ready to send
        </span>
        <span className="font-display text-[10px] uppercase tracking-tight text-brand">
          tap →
        </span>
      </div>
    </div>
  );
}
