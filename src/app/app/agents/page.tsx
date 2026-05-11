import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CheckCircle,
  ClipboardText,
  Files,
  GearSix,
  Lifebuoy,
  Robot,
  ShieldCheck,
  Stack,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../_components/AppHeader";
import { AgentCard } from "./_components/AgentCard";

export const metadata: Metadata = {
  title: "AI Agents",
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Agents" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <section className="mb-10">
          <div className="t2q-section-label mb-3">{"// automation hub"}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
              AI <span className="text-brand">Agents.</span>
            </h1>
            <span
              data-testid="agents-preview-pill"
              className="inline-flex items-center rounded-sm border border-hivis/40 bg-hivis/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis"
            >
              Preview mode
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-ink-300 sm:text-base">
            Automate quoting, materials, follow-ups, and admin without losing
            control.
          </p>
          <p className="mt-2 max-w-2xl font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {
              "// agents are not running yet. this page is the control centre for upcoming automations."
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
            <AgentCard
              icon={Robot}
              title="Quote Builder Agent"
              description="Turns job notes, voice transcripts, and photos into a quote draft."
              status="Connected to quote flow soon"
              statusTone="planned"
            />
            <AgentCard
              icon={Stack}
              title="Materials Agent"
              description="Helps capture supplier items, prices, SKUs, and timber details into your materials list."
              status="UI ready"
              statusTone="ready"
              cta={{ label: "Open Materials", href: "/app/materials" }}
            />
            <AgentCard
              icon={Lifebuoy}
              title="Follow-up Agent"
              description="Tracks sent quotes and reminds you when to follow up."
              status="Planned"
              statusTone="planned"
            />
            <AgentCard
              icon={Files}
              title="Invoice Agent"
              description="Prepares invoice drafts from accepted quotes and timesheets."
              status="Planned"
              statusTone="planned"
            />
            <AgentCard
              icon={ShieldCheck}
              title="Compliance Agent"
              description="Flags missing scope, exclusions, assumptions, GST, and NZ building notes before sending."
              status="Planned"
              statusTone="planned"
            />
            <AgentCard
              icon={GearSix}
              title="Admin Agent"
              description="Keeps settings, client details, and quote folders tidy."
              status="Planned"
              statusTone="planned"
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

        {/* Roadmap */}
        <section
          aria-labelledby="agents-roadmap-heading"
          data-testid="agents-roadmap"
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
              Roadmap.
            </h2>
          </div>
          <ol className="mt-5 space-y-3">
            {[
              { phase: "Phase 1", title: "Agent dashboard shell", done: true },
              { phase: "Phase 2", title: "Materials capture helper", done: false },
              { phase: "Phase 3", title: "Quote review assistant", done: false },
              { phase: "Phase 4", title: "Follow-up reminders", done: false },
              { phase: "Phase 5", title: "Invoice draft assistant", done: false },
            ].map(({ phase, title, done }) => (
              <li
                key={phase}
                className="flex items-center justify-between gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-brand bg-brand text-ink-900" : "border-ink-600 bg-ink-800 text-ink-500"}`}
                  >
                    {done ? (
                      <CheckCircle size={14} weight="fill" />
                    ) : (
                      <span className="font-mono text-[9px]">…</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
                      {phase}
                    </p>
                    <p className="truncate text-sm text-white">{title}</p>
                  </div>
                </div>
                <span
                  className={`hidden font-mono text-[10px] uppercase tracking-[0.2em] sm:inline ${done ? "text-brand" : "text-ink-500"}`}
                >
                  {done ? "shipped" : "upcoming"}
                </span>
              </li>
            ))}
          </ol>
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
