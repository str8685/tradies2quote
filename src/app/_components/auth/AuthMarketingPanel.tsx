"use client";

import { motion } from "framer-motion";
import {
  Check,
  Lightning,
  Microphone,
  PaperPlaneTilt,
  PencilSimple,
  Receipt,
  ShieldCheck,
  Wrench,
} from "@phosphor-icons/react";

/**
 * Marketing panel rendered on `/login` (right side) and `/signup`
 * (left side) via the existing AuthSplitShell.
 *
 * Wave 12.3 — extended from a single headline + 3 bullets to a real
 * scrollable story panel. Five sections, each fades + slides up as
 * the user scrolls. Framer-motion `whileInView` with `viewport.once`
 * so animations only fire once per visit. `prefers-reduced-motion` is
 * respected (framer-motion does this automatically) so iOS users with
 * Reduce Motion get the static layout.
 *
 * The aside it sits inside has `overflow-y-auto` so on short laptop
 * screens the panel scrolls independently of the form.
 *
 * No imagery, no fake stats, no testimonials. Just what the product
 * actually does in five honest steps.
 */
const TRUST_BULLETS = [
  "Voice in. Quote out. Under 60 seconds.",
  "Built by a builder · Tauranga, NZ.",
  "Cancel by text — we don't lock you in.",
];

const STEPS = [
  {
    icon: Microphone,
    label: "Talk",
    body: "Walk the site, hit record, describe what you'd quote in your head. No forms, no menus.",
  },
  {
    icon: Wrench,
    label: "Takeoff",
    body: "We catch the materials, labour hours, GST, exclusions, and assumptions before you send.",
  },
  {
    icon: PencilSimple,
    label: "Review",
    body: "Tweak any line in the editor. Compliance agent flags risky wording and missing details.",
  },
  {
    icon: PaperPlaneTilt,
    label: "Send",
    body: "Branded PDF emailed to your client. Public quote link they can sign on their phone.",
  },
  {
    icon: Receipt,
    label: "Track + invoice",
    body: "Accepted quotes convert to invoice drafts (coming soon). Follow-up agent reminds you when to chase.",
  },
] as const;

const BUILT_FOR = [
  "Builders + chippies",
  "Sparkies + plumbers",
  "Painters + plasterers",
  "Landscapers + roofers",
] as const;

const SAFE = [
  "Read-only AI agents",
  "No quote sent without you tapping send",
  "No invoice created without your approval",
];

interface Props {
  /** Heading flavour. */
  kind: "signin" | "signup";
}

export function AuthMarketingPanel({ kind }: Props) {
  const headline =
    kind === "signin" ? (
      <>
        Voice in.
        <br />
        <span className="text-brand">Quote out.</span>
        <br />
        Under 60 seconds.
      </>
    ) : (
      <>
        Start free.
        <br />
        <span className="text-brand">7 days.</span>
        <br />
        No card.
      </>
    );

  const subtitle =
    kind === "signin"
      ? "Built by a builder. No drag-and-drop, no menus, no time-suckers — just talk."
      : "90 seconds to set up. Voice your first quote tonight. Send it before knock-off.";

  return (
    <div className="relative flex h-full flex-col">
      {/* Hero — intentional NO motion on this block; it should land at
          first paint so the panel never looks blank. */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-hivis mb-3">
          {"// for the tools"}
        </div>
        <h2 className="font-display text-4xl uppercase tracking-tighter leading-[0.9] sm:text-5xl">
          {headline}
        </h2>
        <p className="mt-6 max-w-md text-ink-200 leading-relaxed">{subtitle}</p>

        <ul className="mt-8 max-w-md space-y-3">
          {TRUST_BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-ink-100">
              <Check
                size={16}
                weight="bold"
                className="mt-0.5 shrink-0 text-brand"
              />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* How it works — fade-up on scroll. */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.5, ease: [0.21, 0.61, 0.27, 1] }}
        className="mt-14 max-w-md"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
          {"// how it works"}
        </div>
        <h3 className="mt-2 font-display text-2xl uppercase tracking-tight text-white">
          Five steps. No paperwork.
        </h3>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{
                duration: 0.45,
                delay: i * 0.07,
                ease: [0.21, 0.61, 0.27, 1],
              }}
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ink-600 bg-ink-900 text-brand"
              >
                <s.icon size={16} weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm uppercase tracking-tight text-white">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-ink-400">
                    {String(i + 1).padStart(2, "0")} ·
                  </span>{" "}
                  {s.label}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-200">
                  {s.body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {/* What you get — small feature strip. */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.5, ease: [0.21, 0.61, 0.27, 1] }}
        className="mt-14 max-w-md"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
          {"// what you get"}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Tile
            icon={<Lightning size={16} weight="bold" />}
            title="Branded PDFs"
            body="Your logo, business details, GST number, signed by the client on their phone."
          />
          <Tile
            icon={<ShieldCheck size={16} weight="bold" />}
            title="Compliance Agent"
            body="Flags missing scope, exclusions, GST, and NZ building notes before you send."
          />
          <Tile
            icon={<Microphone size={16} weight="bold" />}
            title="Voice → quote"
            body="OpenAI Whisper transcription + Claude scope extraction. You stay in the editor."
          />
          <Tile
            icon={<Receipt size={16} weight="bold" />}
            title="Materials library"
            body="Capture supplier prices once. Quotes reuse them instead of AI estimates."
          />
        </div>
      </motion.section>

      {/* Built for which trades */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.5, ease: [0.21, 0.61, 0.27, 1] }}
        className="mt-14 max-w-md"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
          {"// built for"}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {BUILT_FOR.map((t) => (
            <li
              key={t}
              className="rounded-sm border border-ink-600 bg-ink-900/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-200"
            >
              {t}
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Safety promise */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.5, ease: [0.21, 0.61, 0.27, 1] }}
        className="mt-14 max-w-md rounded-sm border border-brand/30 bg-brand/5 p-4"
      >
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
          <ShieldCheck size={12} weight="bold" />
          you stay in control
        </div>
        <ul className="mt-3 space-y-2">
          {SAFE.map((s) => (
            <li
              key={s}
              className="flex items-start gap-2 text-sm leading-relaxed text-ink-100"
            >
              <Check
                size={14}
                weight="bold"
                className="mt-0.5 shrink-0 text-brand"
              />
              {s}
            </li>
          ))}
        </ul>
      </motion.section>

      <div className="h-8" />
    </div>
  );
}

function Tile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-sm border border-ink-700 bg-ink-900/60 p-3">
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand"
      >
        {icon}
      </span>
      <p className="mt-2 font-display text-sm uppercase tracking-tight text-white">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-200">{body}</p>
    </div>
  );
}
