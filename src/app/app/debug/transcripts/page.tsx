import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Info, Microphone } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { quoteNumber } from "@/lib/quote-defaults";
import type { QuoteData } from "@/lib/quote-types";
import {
  summariseTranscriptRows,
  toTranscriptCleanupRows,
} from "@/lib/transcript/debugView";
import { AppHeader } from "../../_components/AppHeader";
import { TranscriptCleanupList } from "./_components/TranscriptCleanupList";

export const metadata: Metadata = {
  title: "Transcript cleanup",
};

export const dynamic = "force-dynamic";

/**
 * Owner-only transcript cleanup inspector.
 *
 * Shows recent quotes' raw vs cleaned transcript, every domain-term correction
 * the cleanup applied (before → after, source, confidence, reason), and any
 * flagged clarifications. Read-only. Non-owners get a 404 (hidden-route
 * pattern). Lets the owner audit correction quality + spot glossary gaps.
 */
export default async function TranscriptDebugPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) notFound();

  const { data: quoteRows } = await supabase
    .from("quotes")
    .select("id, created_at, quote_data")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = toTranscriptCleanupRows(
    (quoteRows ?? []).map((q) => ({
      id: q.id as string,
      created_at: q.created_at as string,
      quote_data: (q.quote_data ?? null) as QuoteData | null,
    })),
  ).map((r) => ({ ...r, number: quoteNumber(r.id, r.createdAt) }));

  const totals = summariseTranscriptRows(rows);

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Transcript cleanup" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// owner"}</div>
          <h1 className="flex items-center gap-3 font-display text-3xl uppercase tracking-tight sm:text-4xl">
            <Microphone size={30} weight="duotone" className="text-brand" />
            Transcript cleanup.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Raw vs cleaned transcripts and every spelling / domain-term
            correction applied. Read-only. The raw transcript is always
            preserved untouched; cleanup never changes numbers or meaning.
          </p>
        </div>

        <section
          data-testid="transcript-status"
          className="t2q-card-pro mb-8 p-5 sm:p-6"
        >
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            <StatusCell label="Quotes" value={String(totals.quotes)} />
            <StatusCell label="Corrections" value={String(totals.corrections)} />
            <StatusCell label="Flagged" value={String(totals.clarifications)} />
          </div>
          <p className="mt-4 inline-flex items-start gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            <Info size={12} weight="bold" className="mt-0.5 shrink-0" />
            Showing the 40 most recent quotes that had a voice / typed transcript.
          </p>
        </section>

        <TranscriptCleanupList rows={rows} />

        <p className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          This page is owner-only. Other accounts get a 404.
        </p>
      </main>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
        {label}
      </dt>
      <dd className="font-mono text-sm text-white">{value}</dd>
    </div>
  );
}
