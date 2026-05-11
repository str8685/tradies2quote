import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial, QuoteData, QuoteStatus } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import type { ComplianceLineItem, ComplianceReview } from "@/lib/compliance";
import { isOwnerEmail } from "@/lib/owner";
import { AppHeader } from "../../../_components/AppHeader";
import { QuoteReadinessCheck } from "../../../_components/QuoteReadinessCheck";
import { ComplianceAgent } from "../../../_components/agents/ComplianceAgent";
import { FollowupAgent } from "../../../_components/agents/FollowupAgent";
import { VoiceCleanupAgent } from "../../../_components/agents/VoiceCleanupAgent";
import { QuoteGenerator } from "./_components/QuoteGenerator";
import { QuoteEditor } from "./_components/QuoteEditor";
import { CompliancePanel } from "./_components/CompliancePanel";
import { LifecycleCard } from "./_components/LifecycleCard";
import {
  TranscriptPanel,
  type TranscriptPanelData,
} from "./_components/TranscriptPanel";

export const metadata: Metadata = {
  title: "Quote preview",
};

type Params = { id: string };

export default async function QuotePreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, voice_transcript, quote_data, created_at, status, public_token, pdf_path, sent_at, viewed_at, accepted_at, expires_at",
    )
    .eq("id", id)
    .single();

  if (error || !quote) redirect("/app/quotes/new");

  const quoteData = (quote.quote_data ?? null) as QuoteData | null;
  const headerNumber = quoteNumber(quote.id, quote.created_at);

  // Wave 11 — load the user's business profile for the readiness check
  // panel below. Same RLS pattern Settings already uses; same fields
  // the readiness function asks for. Safe to fail silently here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, email, phone, address")
    .eq("id", user.id)
    .maybeSingle();

  const { data: libraryRows } = await supabase
    .from("materials")
    .select(
      "id, name, unit, default_unit_price, supplier, supplier_url, notes, usage_count, is_ai_estimated, last_used_at",
    )
    .eq("user_id", user.id);
  const library: LibraryMaterial[] = (libraryRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    default_unit_price:
      r.default_unit_price !== null ? Number(r.default_unit_price) : null,
    supplier: r.supplier,
    supplier_url: r.supplier_url,
    notes: r.notes,
    usage_count: Number(r.usage_count) || 0,
    is_ai_estimated: !!r.is_ai_estimated,
    last_used_at: r.last_used_at,
  }));

  return (
    <div className="min-h-screen text-white">
      <AppHeader context={headerNumber} />

      <main
        data-preview-quote-number={headerNumber}
        className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
      >
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// step 2 of 3"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Review your <span className="text-brand">quote.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Tweak any line, fix the client name, edit the terms — your changes save when you hit save.
          </p>
        </div>

        {quoteData ? (
          <>
            {/* Wave 13 — lifecycle card at the top of the page. Renders
                the orchestrator's current stage, dashboard message,
                missing-field checklist, and the next-action buttons.
                Owner-only agent shortcut is gated via `isOwner`. */}
            <LifecycleCard
              quoteId={quote.id}
              status={(quote.status ?? "draft") as QuoteStatus}
              quoteData={quoteData}
              expiresAt={quote.expires_at ?? null}
              isOwner={isOwnerEmail(user.email)}
            />

            {/* Stage 6 — transcript panel (raw / cleaned / summary).
                Renders only when the generator wrote a transcript object
                onto quote_data (i.e. Stage 6 onwards). Quotes from
                before this commit have `transcript === undefined` and
                the panel renders nothing. */}
            {(() => {
              const t = (quoteData.transcript ?? null) as
                | TranscriptPanelData
                | null;
              if (!t) return null;
              return (
                <div className="mb-6">
                  <TranscriptPanel quoteId={quote.id} transcript={t} />
                </div>
              );
            })()}
            {/* Compliance review panel — renders nothing when the
                engine was off (production today) or the quote was
                generated before Stage 5 landed. */}
            {(() => {
              const review = (quoteData.compliance_review ?? null) as
                | ComplianceReview
                | null;
              if (!review) return null;
              return (
                <div className="mb-6">
                  <CompliancePanel
                    quoteId={quote.id}
                    review={review}
                    items={quoteData.line_items as ComplianceLineItem[]}
                  />
                </div>
              );
            })()}
            {/* Wave 11 — readiness panel above the editor. Soft-warn
                only; does not block the Send button below.
                Wave 12 calls this the "Quote Review Agent" in the agent
                hub. */}
            <QuoteReadinessCheck
              quoteData={quoteData}
              profile={profile ?? null}
              expiresAt={quote.expires_at ?? null}
            />

            {/* Wave 12 — Compliance Agent. Read-only. Renders flags +
                suggested clauses the user can copy. Mounted right
                under the readiness check so both pre-send checks live
                together. */}
            <ComplianceAgent quoteData={quoteData} />

            {/* Wave 12 — Voice Cleanup Agent. Only renders when the
                quote has a stored voice transcript; cleanup is pure
                client-side rule-based, no AI call. */}
            <VoiceCleanupAgent transcript={quote.voice_transcript ?? null} />

            {/* Wave 12 — Follow-up Agent. Hides templates that don't
                apply (e.g. "friendly reminder" hidden until the quote
                is actually sent). Never sends — copy to clipboard
                only. */}
            <FollowupAgent
              quoteNumber={headerNumber}
              clientName={quoteData.client?.name ?? null}
              total={quoteData.total ?? 0}
              currency={quoteData.currency || "NZD"}
              status={(quote.status ?? "draft") as QuoteStatus}
              sentAtIso={quote.sent_at ?? null}
              businessName={profile?.business_name ?? null}
            />

            <QuoteEditor
              quoteId={quote.id}
              createdAt={quote.created_at}
              initialData={quoteData}
              library={library}
              quoteStatus={(quote.status ?? "draft") as QuoteStatus}
              publicToken={quote.public_token ?? null}
              hasPdf={quote.pdf_path !== null && quote.pdf_path !== undefined}
            />
          </>
        ) : (
          <QuoteGenerator id={quote.id} />
        )}
      </main>
    </div>
  );
}
