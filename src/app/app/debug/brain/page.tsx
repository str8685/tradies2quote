import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Info, Brain } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { readMemories } from "@/lib/tradieBrain/store";
import { tradieBrainEnabledFromEnv } from "@/lib/tradieBrain";
import { AppHeader } from "../../_components/AppHeader";
import { MemoryList } from "./_components/MemoryList";

export const metadata: Metadata = {
  title: "Tradie Brain",
};

export const dynamic = "force-dynamic";

/**
 * Owner-only Tradie Brain inspector.
 *
 * Shows the memories the app has silently collected for the owner from their
 * own quote activity — what each one learned, where it came from, how strong
 * it is, and when it was last used. Read-only. Non-owners get a 404 (the
 * standard hidden-route pattern), so the route's existence isn't advertised.
 *
 * v1 is OBSERVE-ONLY: collection runs (owner-gated) but no memory is fed to
 * any AI. The TRADIE_BRAIN_ENABLED flag — surfaced below — gates that future
 * consumption step; while it's off, this data influences nothing.
 */
export default async function TradieBrainDebugPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) notFound();

  const memories = await readMemories(supabase, user.id, { status: "active" });
  const consumptionOn = tradieBrainEnabledFromEnv();

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Tradie Brain" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// owner"}</div>
          <h1 className="flex items-center gap-3 font-display text-3xl uppercase tracking-tight sm:text-4xl">
            <Brain size={30} weight="duotone" className="text-brand" />
            Tradie Brain.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Private memory learned from your own quotes. Advisory only — it
            never changes your numbers, never sends anything, and never
            overrides the calculator or any send gate.
          </p>
        </div>

        {/* Status — proves consumption is OFF while the flag is unset */}
        <section
          data-testid="brain-status"
          className="t2q-card-pro mb-8 p-5 sm:p-6"
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <StatusCell label="Active memories" value={String(memories.length)} />
            <StatusCell label="Ingestion" value="on (owner-only)" />
            <StatusCell
              label="AI consumption"
              value={consumptionOn ? "ON" : "off"}
              tone={consumptionOn ? "brand" : "muted"}
            />
          </div>
          <p className="mt-4 inline-flex items-start gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            <Info size={12} weight="bold" className="mt-0.5 shrink-0" />
            {consumptionOn
              ? "Consumption is enabled: relevant memories may be offered to AI surfaces as advisory context."
              : "Observe-only: memories are collected but never fed to any AI. Set TRADIE_BRAIN_ENABLED=true to turn on consumption later."}
          </p>
        </section>

        <MemoryList memories={memories} />

        <p className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          This page is owner-only. Other accounts get a 404.
        </p>
      </main>
    </div>
  );
}

function StatusCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "muted";
}) {
  const valueClass =
    tone === "brand"
      ? "text-brand"
      : tone === "muted"
        ? "text-ink-300"
        : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
        {label}
      </dt>
      <dd className={`font-mono text-sm ${valueClass}`}>{value}</dd>
    </div>
  );
}
