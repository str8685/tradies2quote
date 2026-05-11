"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle,
  Info,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import {
  orchestrate,
  type AgentName,
} from "@/lib/lifecycle/orchestrator";
import {
  sendQuote,
  acceptQuote,
  declineQuote,
  scheduleJob,
  markInProgress,
  markComplete,
  type LifecycleResult,
} from "../actions";

/**
 * Wave 13 — Lifecycle card.
 *
 * Renders the orchestrator output at the top of the quote preview page:
 *   - Current stage pill
 *   - Dashboard message (the one-line summary that also shows in /app)
 *   - "Missing for next step" checklist (when blocked)
 *   - Primary "next step" action button (when one is recommended)
 *   - Secondary "decline" button at draft / sent / viewed stages
 *   - Owner-only "Open <Agent>" shortcut link
 *
 * **Scope guarantees:**
 *   - Mounted only on `/app/quotes/preview/[id]` (an owner-app page).
 *     Never on `/quote/[token]` (the customer public page).
 *   - The "Open <Agent>" shortcut is rendered only when the caller is
 *     the project owner. Non-owner tradies see the lifecycle card but
 *     not the agent link.
 *   - Customers on the public route never reach this component because
 *     `/quote/[token]` lives outside the `/app/*` tree.
 *   - No automatic transitions, no background timers, no scheduled
 *     work. Every state change requires the owner clicking a button.
 */
interface Props {
  quoteId: string;
  status: QuoteStatus;
  quoteData: QuoteData | null;
  expiresAt: string | null;
  /** True only when the signed-in user matches `OWNER_EMAIL`. */
  isOwner: boolean;
}

/**
 * Wave 13.1 — agent shortcut now scrolls to the on-page panel that
 * contains the agent's UI. The previous version navigated to
 * `/app/agents` (a directory), which is confusing when the actual
 * agent UI is already rendered further down the same page. The
 * matching IDs are set on the `<details>` wrappers in `page.tsx`.
 */
const AGENT_TARGET_ID: Record<AgentName, string> = {
  "Quote Review": "agent-quote-review",
  Compliance: "agent-compliance",
  "Voice Cleanup": "agent-voice-cleanup",
  "Follow-up": "agent-followup",
};

function openAgentSection(targetId: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(targetId);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LifecycleCard({
  quoteId,
  status,
  quoteData,
  expiresAt,
  isOwner,
}: Props) {
  const out = orchestrate({ status, quoteData, expiresAt });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<LifecycleResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) setError(res.error);
    });
  }

  // The decline button shows alongside accept/send so the owner can
  // close out a dead quote without a separate page.
  const canDecline =
    status === "draft" || status === "sent" || status === "viewed";

  return (
    <section
      data-testid="lifecycle-card"
      data-stage={status}
      aria-labelledby="lifecycle-card-heading"
      className="t2q-premium-card-static mb-6 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="t2q-section-label">{"// lifecycle"}</span>
        <span
          data-testid="lifecycle-stage-pill"
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${stagePillStyle(status)}`}
        >
          {out.stageLabel}
        </span>
      </div>

      <h2
        id="lifecycle-card-heading"
        className="mt-3 font-display text-xl uppercase tracking-tight text-white sm:text-2xl"
      >
        {out.dashboardMessage}
      </h2>

      {out.missing.length > 0 ? (
        <ul
          data-testid="lifecycle-missing"
          className="mt-4 space-y-2 rounded-sm border border-hivis/30 bg-hivis/5 p-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
            {"// finish these first"}
          </p>
          {out.missing.map((m) => (
            <li
              key={m.field}
              className="flex items-start gap-2 text-sm text-ink-100"
            >
              <Warning
                size={14}
                weight="fill"
                className="mt-0.5 shrink-0 text-hivis"
                aria-hidden="true"
              />
              <span>
                <span className="text-white">{m.todo}</span>
                <span className="block text-xs text-ink-300">{m.why}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Primary + secondary action row. The orchestrator gives us the
          primary; decline is rendered as a quieter secondary when the
          current stage allows it. */}
      {(out.nextAction || canDecline) ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {out.nextAction ? (
            <button
              type="button"
              data-testid={`lifecycle-action-${out.nextAction.action}`}
              disabled={pending}
              onClick={() => run(() => actionFor(out.nextAction!.action)(quoteId))}
              className="t2q-btn-primary inline-flex h-11 items-center gap-2 px-5"
            >
              {pending ? "Working…" : out.nextAction.buttonLabel}
              {!pending ? <ArrowRight size={16} weight="bold" /> : null}
            </button>
          ) : null}

          {canDecline ? (
            <button
              type="button"
              data-testid="lifecycle-action-declineQuote"
              disabled={pending}
              onClick={() => run(() => declineQuote(quoteId))}
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-red-500/40 bg-red-500/5 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-red-300 transition-colors hover:border-red-500/70 hover:text-red-200"
            >
              <XCircle size={14} weight="bold" />
              Decline
            </button>
          ) : null}

          {out.nextAction ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200">
              {out.nextAction.description}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200">
          <CheckCircle size={12} weight="fill" className="text-brand" />
          End of the workflow — nothing more to do here.
        </p>
      )}

      {/* Wave 13.1 — owner-only agent shortcut. Now scrolls to the
          relevant on-page section (the agents are already rendered
          further down) instead of navigating away. Non-owner tradies
          and customers never see this; the agent shortcut stays gated
          on `isOwner` per the Wave 13 contract. */}
      {isOwner && out.agentToTrigger ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-sm border border-ink-700 bg-ink-900/60 p-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
              {"// suggested agent"}
            </p>
            <p className="mt-1 font-display text-sm uppercase tracking-tight text-white">
              {out.agentToTrigger} Agent
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              openAgentSection(AGENT_TARGET_ID[out.agentToTrigger!])
            }
            data-testid="lifecycle-agent-link"
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-900 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
          >
            Open
            <ArrowRight size={12} weight="bold" />
          </button>
        </div>
      ) : null}

      {/* Audit hint — tiny line letting the owner know every transition
          is logged to quote_events. Wave 13.1 — brighter (ink-300) so
          it's actually readable in dark mode. */}
      <p className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        <Info size={12} weight="bold" />
        Every change writes an audit row to quote_events. No background sends.
      </p>

      {error ? (
        <p
          data-testid="lifecycle-error"
          role="alert"
          className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

type ActionFn = (id: string) => Promise<LifecycleResult>;

function actionFor(name: string): ActionFn {
  switch (name) {
    case "sendQuote": return sendQuote;
    case "acceptQuote": return acceptQuote;
    case "declineQuote": return declineQuote;
    case "scheduleJob": return scheduleJob;
    case "markInProgress": return markInProgress;
    case "markComplete": return markComplete;
    default:
      throw new Error(`Unknown lifecycle action: ${name}`);
  }
}

function stagePillStyle(s: QuoteStatus): string {
  switch (s) {
    case "draft": return "border-ink-600 bg-ink-800 text-ink-300";
    case "sent": return "border-blue-500/40 bg-blue-500/10 text-blue-300";
    case "viewed": return "border-hivis/40 bg-hivis/10 text-hivis";
    case "accepted": return "border-brand/40 bg-brand/10 text-brand";
    case "scheduled": return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
    case "in_progress": return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "completed": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "declined": return "border-red-500/40 bg-red-500/10 text-red-300";
    case "expired": return "border-ink-600 bg-ink-800 text-ink-400";
  }
}
