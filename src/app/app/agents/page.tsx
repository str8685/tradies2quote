import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle,
  ClipboardText,
  Files,
  GearSix,
  Lifebuoy,
  Microphone,
  ShieldCheck,
  Stack,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { getCachedAuthUser } from "@/lib/supabase/auth";
import { isOwnerEmail } from "@/lib/owner";
import { AppHeader } from "../_components/AppHeader";
import { AgentCard } from "./_components/AgentCard";

export const metadata: Metadata = {
  title: "Agents",
};

export const dynamic = "force-dynamic";

/**
 * `/app/agents` — Wave 10.4 AI Agents control-centre.
 *
 * UI shell only. Renders 6 agent cards, a safety panel, and a roadmap
 * panel. No client handlers, no `useEffect`, no API calls, no DB writes.
 * Auth gate is the standard `auth.getUser()` + redirect — same pattern
 * every other `/app/*` page uses.
 *
 * One CTA actually navigates: "Materials Agent" → `/app/materials`, since
 * the materials capture flow already exists. Every other card renders a
 * disabled "Coming soon" button so the UI can never claim work it can't
 * deliver.
 */
export default async function AgentsPage() {
  // Wave 18.1 — perf — cached. Agents page is owner-only and renders
  // no per-user data, so the only Supabase work needed is the auth
  // check (deduped via React `cache()` with `<AppHeader>` /
  // `<MobileBottomNav>`).
  const { user } = await getCachedAuthUser();
  if (!user) redirect("/login");

  // Wave 13 — owner-only. Non-owner tradies get a 404 so the route's
  // existence isn't advertised. Mirrors the /app/debug gate.
  if (!isOwnerEmail(user.email)) notFound();

  // Wave 14 — the inline Admin Agent panel that used to live on this
  // page is gone. The same checklist now renders on /app/settings via
  // <AdminChecklistPanel> so every tradie sees their setup gaps, not
  // just the owner. The /app/agents page keeps the agent directory +
  // status board.

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Agents" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <section className="mb-10">
          <div className="t2q-section-label mb-3">{"// agents directory"}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
              AI <span className="text-brand">Agents.</span>
            </h1>
            <span
              data-testid="agents-preview-pill"
              className="inline-flex items-center rounded-sm border border-hivis/40 bg-hivis/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis"
            >
              Owner-only
            </span>
          </div>
          {/* Wave 14 — copy retightened. Previously this hero pitched
              "Automate quoting / follow-ups" and called itself an
              "automation hub" — neither is true; every agent is
              approval-only and runs synchronously on a button click.
              No background work, no cron, no auto-send. */}
          <p className="mt-3 max-w-2xl text-sm text-ink-300 sm:text-base">
            Directory of every agent that helps with quotes, follow-ups, and
            setup. Every action is owner-driven — nothing runs in the
            background, nothing sends without you tapping the button.
          </p>
          <p className="mt-2 max-w-2xl font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {
              "// each panel renders on the quote preview where the data lives. open a quote to use the agent."
            }
          </p>
        </section>

        {/* Agent cards */}
        <section
          aria-labelledby="agents-cards-heading"
          data-testid="agents-grid"
          className="mb-12"
        >
          <h2 id="agents-cards-heading" className="sr-only">
            Available agents
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Wave 12 — the five named agents from the brief, in the
                same order. Each card explains what the agent does and
                links to where the user runs it. The deeper UI (the
                actual flag list, suggested clauses, follow-up
                templates, cleaned transcript) renders on the quote
                preview page where the data lives. */}
            <AgentCard
              icon={ClipboardText}
              title="Quote Review Agent"
              description="Reads quote_data only. Flags missing client name, address, scope, totals, GST, assumptions, exclusions, and payment terms. Suggests fixes — never auto-saves."
              status="Live"
              statusTone="ready"
              cta={{
                label: "Open in a quote",
                href: "/app/quotes",
              }}
            />
            <AgentCard
              icon={ShieldCheck}
              title="Compliance Agent"
              description="Flags risky wording (guarantee, certified). Suggests exclusions, assumptions, site-access notes, weather delays, variation terms, payment terms. NZ-builder focused — not legal advice."
              status="Live"
              statusTone="ready"
              cta={{
                label: "Open in a quote",
                href: "/app/quotes",
              }}
            />
            <AgentCard
              icon={Microphone}
              title="Voice Cleanup Agent"
              description="Takes a voice transcript. Produces a clean trade scope. The original transcript stays. You click Apply before anything gets used."
              status="Live"
              statusTone="ready"
              cta={{
                label: "Open in a quote",
                href: "/app/quotes",
              }}
            />
            <AgentCard
              icon={Lifebuoy}
              title="Follow-up Agent"
              description="Generates follow-up messages for draft/sent quotes — friendly reminder, price clarification, acceptance nudge, missing-info request. Copy to clipboard only; never sends."
              status="Live"
              statusTone="ready"
              cta={{
                label: "Open in a quote",
                href: "/app/quotes?status=sent",
              }}
            />
            {/* Wave 14 — Admin Agent moved to /app/settings so every
                tradie sees it, not just the owner. CTA links to the
                checklist's new home. */}
            <AgentCard
              icon={GearSix}
              title="Admin Agent"
              description="Checks your profile and client details. Flags missing business name, phone, GST number, default rates. Links you to the right setting — never edits anything itself."
              status="Live"
              statusTone="ready"
              cta={{ label: "Open Settings", href: "/app/settings" }}
            />
            {/* Materials Agent stays as a useful adjacent helper, even
                though it isn't one of the five "core" Wave 12 agents. */}
            {/* Wave 14 — Materials Agent relabelled "Linked" so it
                doesn't claim agent behaviour it doesn't have. It's a
                jump-link to the manual materials UI; calling it
                "Live" implied automation we never built. */}
            {/* Wave 18.1 — honesty — statusTone moved from "ready"
                (orange, identical to Live agents) to "linked" (neutral
                ink). Materials is a navigation shortcut, not an
                automated agent — the badge colour now matches the
                "Linked" label. */}
            <AgentCard
              icon={Stack}
              title="Materials Agent"
              description="Jumps to the manual materials capture UI — supplier items, prices, SKUs, sizes, timber treatment. Not an automated agent — just a shortcut."
              status="Linked"
              statusTone="linked"
              cta={{ label: "Open Materials", href: "/app/materials" }}
            />
            {/* Wave 14 — Invoice Agent foundation. Status is "Draft
                only" (not "Live") because only the draft-creation
                slice works — no email send, no PDF route, no payment
                state, no overdue tracking. Per the Wave 14 audit
                guardrail: status labels must match what the backend
                actually does. */}
            <AgentCard
              icon={Files}
              title="Invoice Agent"
              description="Creates a draft invoice from a completed quote. Owner-clicks; nothing sends. Draft-only — no email, no PDF, no payment tracking."
              status="Draft only"
              statusTone="preview"
              cta={{
                label: "Open in a completed quote",
                href: "/app/quotes?stage=completed",
              }}
            />
          </div>
        </section>

        {/* Safety panel */}
        <section
          aria-labelledby="agents-safety-heading"
          data-testid="agents-safety"
          className="t2q-premium-card-static mb-10 p-5 sm:p-7"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand"
            >
              <ShieldCheck size={20} weight="bold" />
            </span>
            <h2
              id="agents-safety-heading"
              className="font-display text-lg uppercase tracking-tight text-white sm:text-xl"
            >
              You stay in control.
            </h2>
          </div>
          <ul className="mt-5 space-y-2.5">
            {[
              "Agents will draft, not send.",
              "No quote gets emailed without approval.",
              "No invoice gets created without approval.",
              "No supplier item gets saved without approval.",
              "No client data gets changed without approval.",
            ].map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-sm text-ink-200"
              >
                <CheckCircle
                  size={16}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Wave 14 — honest 2-column status board. The previous
            "Needs setup" column claimed photo-extraction + auto
            follow-ups were one-wiring-step away from working. They're
            not — there's no backend code for either. Both moved to
            "Coming later". Invoice draft assistant moved up to "Live"
            (shipped in Wave 14). */}
        <section
          aria-labelledby="agents-roadmap-heading"
          data-testid="agents-status-board"
          className="t2q-premium-card-static p-5 sm:p-7"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-ink-700 bg-ink-900 text-brand"
            >
              <ClipboardText size={20} weight="bold" />
            </span>
            <h2
              id="agents-roadmap-heading"
              className="font-display text-lg uppercase tracking-tight text-white sm:text-xl"
            >
              Status board.
            </h2>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <StatusColumn
              tone="live"
              label="Live"
              icon={<CheckCircle size={14} weight="fill" />}
              items={[
                "Quote Builder (voice → quote AI pipeline)",
                "Quote Review Agent",
                "Compliance Agent",
                "Voice Cleanup Agent",
                "Follow-up Agent",
                "Admin Agent (on /app/settings)",
                "Materials linker",
                "Invoice draft (Wave 14)",
              ]}
            />
            <StatusColumn
              tone="later"
              label="Coming later"
              icon={<ClipboardText size={14} weight="bold" />}
              items={[
                "Invoice email send (Wave 15)",
                "Overdue invoice reminders (Wave 15 cron)",
                "Payment reminder agent (Wave 15)",
                "Photo + plan reading agent (Wave 16 vision AI)",
                "Variation agent (Wave 16)",
              ]}
            />
          </div>
        </section>

        {/* Mobile-friendly tail navigation — Clients + Settings live here
            since they were removed from the bottom nav to make room for
            the new Agents tab. */}
        <nav
          data-testid="agents-tail-links"
          aria-label="Secondary"
          className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-ink-700/60 pt-6"
        >
          <a
            href="/app/clients"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-brand"
          >
            <UsersThree size={14} weight="bold" />
            Clients
          </a>
          <a
            href="/app/settings"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-brand"
          >
            <GearSix size={14} weight="bold" />
            Settings
          </a>
        </nav>
      </main>
    </div>
  );
}

type StatusTone = "live" | "setup" | "later";

const STATUS_COLUMN_STYLES: Record<StatusTone, string> = {
  live: "border-brand/40 bg-brand/10",
  setup: "border-hivis/40 bg-hivis/10",
  later: "border-ink-600 bg-ink-800/60",
};

const STATUS_LABEL_STYLES: Record<StatusTone, string> = {
  live: "text-brand",
  setup: "text-hivis",
  later: "text-ink-300",
};

function StatusColumn({
  tone,
  label,
  icon,
  items,
}: {
  tone: StatusTone;
  label: string;
  icon: React.ReactNode;
  items: ReadonlyArray<string>;
}) {
  return (
    <div
      data-testid={`agents-status-${tone}`}
      className={`flex flex-col gap-3 rounded-sm border p-4 ${STATUS_COLUMN_STYLES[tone]}`}
    >
      <p
        className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] ${STATUS_LABEL_STYLES[tone]}`}
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-sm leading-snug text-ink-100"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
