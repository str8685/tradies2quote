import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

/**
 * Single agent card used on `/app/agents`.
 *
 * Wave 10.4 — every card is UI-only. No `<form action={…}>`, no client
 * handler. `cta.href` is optional: when present the card's CTA links to
 * an existing page (e.g. "Open Materials" links to `/app/materials`).
 * When omitted, the CTA renders as a disabled "Coming soon" button so
 * tradies can see the agent exists without being able to fire anything
 * that doesn't work yet.
 *
 * Visual treatment uses the existing `.t2q-card-pro t2q-card-pro-hover` utility so the
 * hub feels like the rest of the app, with a brand-orange status pill in
 * the corner and a Phosphor icon block at the top.
 */
type StatusTone = "preview" | "planned" | "ready" | "linked";

interface AgentCardProps {
  icon: Icon;
  title: string;
  description: string;
  status: string;
  statusTone: StatusTone;
  cta?: { label: string; href: string };
}

const STATUS_CLASSES: Record<StatusTone, string> = {
  ready: "border-brand/40 bg-brand/10 text-brand",
  preview: "border-hivis/40 bg-hivis/10 text-hivis",
  planned: "border-ink-600 bg-ink-800 text-ink-300",
  // Wave 18.1 — honesty — neutral ink tone for "Linked" cards
  // (Materials Agent) so they visually read as navigation shortcuts,
  // not as Live AI agents. Using the brand-orange `ready` tone made
  // the Materials card look identical to the actually-Live cards.
  linked: "border-ink-500/40 bg-ink-700/40 text-ink-200",
};

export function AgentCard({
  icon: IconCmp,
  title,
  description,
  status,
  statusTone,
  cta,
}: AgentCardProps) {
  return (
    <article
      data-testid={`agent-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="t2q-card-pro t2q-card-pro-hover flex h-full flex-col p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-ink-700 bg-ink-900 text-brand"
        >
          <IconCmp size={22} weight="bold" />
        </span>
        <span
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${STATUS_CLASSES[statusTone]}`}
        >
          {status}
        </span>
      </div>

      <h2 className="mt-4 font-display text-lg uppercase tracking-tight text-white sm:text-xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">
        {description}
      </p>

      <div className="mt-auto pt-5">
        {cta ? (
          <Link
            href={cta.href}
            className="t2q-btn-ghost-pro inline-flex h-10 items-center justify-center gap-1.5 px-4"
          >
            {cta.label}
            <ArrowRight size={14} weight="bold" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800/40 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400"
          >
            Coming soon
          </button>
        )}
      </div>
    </article>
  );
}
