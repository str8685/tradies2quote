import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Files,
  GearSix,
  Lifebuoy,
  Microphone,
  ShieldCheck,
  Stack,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../_components/AppHeader";
import { AdminAgent } from "../_components/agents/AdminAgent";
import type {
  AdminClientSnapshot,
  AdminProfileSnapshot,
} from "@/lib/agents/admin";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Wave 12 — Admin Agent context. Loads the user's profile + a
  // lightweight count of clients-without-contact so the admin panel
  // can flag missing setup. Both queries are RLS-scoped + read-only.
  const [{ data: profileRow }, { data: clientsRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "business_name, email, phone, address, gst_number, country, currency, tax_rate, default_labour_rate, default_markup_pct",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, email, phone")
      .eq("user_id", user.id),
  ]);

  const adminProfile: AdminProfileSnapshot | null = profileRow ?? null;
  const adminClients: AdminClientSnapshot = {
    count: clientsRows?.length ?? 0,
    countWithoutContact: (clientsRows ?? []).filter(
      (c) =>
        !(typeof c.email === "string" && c.email.trim().length > 0) &&
        !(typeof c.phone === "string" && c.phone.trim().length > 0),
    ).length,
  };

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
            <AgentCard
              icon={GearSix}
              title="Admin Agent"
              description="Checks your profile and client details. Flags missing business name, phone, GST number, default rates. Links you to the right setting — never edits anything itself."
              status="Live"
              statusTone="ready"
              cta={{ label: "See findings below", href: "#admin-agent" }}
            />
            {/* Materials Agent stays as a useful adjacent helper, even
                though it isn't one of the five "core" Wave 12 agents. */}
            <AgentCard
              icon={Stack}
              title="Materials Agent"
              description="Helps capture supplier items, prices, SKUs, sizes, and timber treatment into your materials list."
              status="Live"
              statusTone="ready"
              cta={{ label: "Open Materials", href: "/app/materials" }}
            />
            <AgentCard
              icon={Files}
              title="Invoice Agent"
              description="Prepares invoice drafts from accepted quotes and timesheets."
              status="Coming later"
              statusTone="planned"
            />
          </div>
        </section>

        {/* Wave 12 — Admin Agent panel runs inline on the hub since it
            checks profile + clients, which aren't tied to any single
            quote. */}
        <section id="admin-agent" className="mb-12 scroll-mt-24">
          <AdminAgent profile={adminProfile} clients={adminClients} />
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

        {/* Wave 10.5 — replaced the "Phase 1 / 2 / 3 …" roadmap with an
            honest 3-column status board. Items only count as "Live" if
            an actual route already exists; "Needs setup" is for things
            blocked on a one-time wiring step (e.g. a future Anthropic
            review prompt); "Coming later" is everything genuinely
            unbuilt. No fake "shipped" claims. */}
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

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <StatusColumn
              tone="live"
              label="Live"
              icon={<CheckCircle size={14} weight="fill" />}
              items={[
                "Quote Builder",
                "Voice Agent",
                "Materials Agent",
                "Follow-up Agent",
                "Compliance Agent",
                "Admin Agent",
              ]}
            />
            <StatusColumn
              tone="setup"
              label="Needs setup"
              icon={<CircleNotch size={14} weight="bold" />}
              items={[
                "Photo material extraction (camera upload)",
                "Sent-quote follow-up reminders (email schedule)",
              ]}
            />
            <StatusColumn
              tone="later"
              label="Coming later"
              icon={<ClipboardText size={14} weight="bold" />}
              items={["Invoice draft assistant", "Timesheet-to-invoice agent"]}
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
