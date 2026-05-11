import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial, QuoteData, QuoteStatus } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import type { ComplianceLineItem, ComplianceReview } from "@/lib/compliance";
import { isOwnerEmail } from "@/lib/owner";
import type { InvoiceSummary, InvoiceStatus } from "@/lib/types/invoice";
import { AppHeader } from "../../../_components/AppHeader";
import { QuoteReadinessCheck } from "../../../_components/QuoteReadinessCheck";
import { ComplianceAgent } from "../../../_components/agents/ComplianceAgent";
import { FollowupAgent } from "../../../_components/agents/FollowupAgent";
import { VoiceCleanupAgent } from "../../../_components/agents/VoiceCleanupAgent";
import { QuoteGenerator } from "./_components/QuoteGenerator";
import { QuoteEditor } from "./_components/QuoteEditor";
import { CompliancePanel } from "./_components/CompliancePanel";
import { LifecycleCard } from "./_components/LifecycleCard";
import { CollapsibleSection } from "./_components/CollapsibleSection";
import { InvoiceDraftCard } from "./_components/InvoiceDraftCard";
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

  // Wave 14 — load the existing non-deleted, non-cancelled invoice
  // for this quote if one exists. Drives both the LifecycleCard's
  // suggestion suppression and the InvoiceDraftCard's existing-state
  // branch. RLS already scopes to this user; we further filter by
  // quote_id + deleted_at IS NULL + status <> 'cancelled'.
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount, currency, due_date, created_at")
    .eq("quote_id", id)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .maybeSingle();
  const existingInvoice: InvoiceSummary | null = invoiceRow
    ? {
        id: invoiceRow.id,
        invoice_number: invoiceRow.invoice_number,
        status: invoiceRow.status as InvoiceStatus,
        total_amount: Number(invoiceRow.total_amount) || 0,
        currency: invoiceRow.currency ?? "NZD",
        due_date: invoiceRow.due_date,
        created_at: invoiceRow.created_at,
      }
    : null;

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
            {/* Wave 13 — lifecycle card at the top of the page.
                Wave 14 — also fed voiceTranscript + invoiceExists so
                the orchestrator can suggest Voice Cleanup on draft
                and Invoice on completed (when no invoice yet). */}
            <LifecycleCard
              quoteId={quote.id}
              status={(quote.status ?? "draft") as QuoteStatus}
              quoteData={quoteData}
              expiresAt={quote.expires_at ?? null}
              isOwner={isOwnerEmail(user.email)}
              voiceTranscript={quote.voice_transcript ?? null}
              invoiceExists={existingInvoice !== null}
            />

            {/* Wave 13.1 — the editor is the primary work surface and
                now sits second so it's above the fold once the user
                scrolls past the lifecycle status. Everything below is
                a review tool tucked behind collapsibles. */}
            <QuoteEditor
              quoteId={quote.id}
              createdAt={quote.created_at}
              initialData={quoteData}
              library={library}
              quoteStatus={(quote.status ?? "draft") as QuoteStatus}
              publicToken={quote.public_token ?? null}
              hasPdf={quote.pdf_path !== null && quote.pdf_path !== undefined}
            />

            {/* Wave 14 — Invoice draft card. Self-hides unless the
                quote is `completed`. The card's id="agent-invoice"
                is what the lifecycle suggestion scrolls to. */}
            <InvoiceDraftCard
              quoteId={quote.id}
              status={(quote.status ?? "draft") as QuoteStatus}
              quoteData={quoteData}
              existingInvoice={existingInvoice}
            />

            {/* Wave 13.1 — review tools group. All collapsibles default
                closed; the lifecycle agent shortcut programmatically
                opens whichever one matches the suggested agent. The
                ids here (agent-quote-review, agent-compliance, …)
                match LifecycleCard's AGENT_TARGET_ID map. */}
            <div className="mt-8 space-y-3">
              <p className="t2q-section-label">{"// review tools"}</p>

              <CollapsibleSection
                id="agent-quote-review"
                title="Quote Review Agent"
              >
                <QuoteReadinessCheck
                  quoteData={quoteData}
                  profile={profile ?? null}
                  expiresAt={quote.expires_at ?? null}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="agent-compliance"
                title="Compliance Agent"
              >
                <ComplianceAgent quoteData={quoteData} />
              </CollapsibleSection>

              {quote.voice_transcript ? (
                <CollapsibleSection
                  id="agent-voice-cleanup"
                  title="Voice Cleanup Agent"
                >
                  <VoiceCleanupAgent
                    transcript={quote.voice_transcript ?? null}
                  />
                </CollapsibleSection>
              ) : null}

              <CollapsibleSection
                id="agent-followup"
                title="Follow-up Agent"
              >
                <FollowupAgent
                  quoteNumber={headerNumber}
                  clientName={quoteData.client?.name ?? null}
                  total={quoteData.total ?? 0}
                  currency={quoteData.currency || "NZD"}
                  status={(quote.status ?? "draft") as QuoteStatus}
                  sentAtIso={quote.sent_at ?? null}
                  businessName={profile?.business_name ?? null}
                />
              </CollapsibleSection>

              {/* Stage 6 transcript panel — only when the generator wrote
                  a transcript object onto quote_data. */}
              {(() => {
                const t = (quoteData.transcript ?? null) as
                  | TranscriptPanelData
                  | null;
                if (!t) return null;
                return (
                  <CollapsibleSection
                    id="agent-transcript"
                    title="Transcript"
                  >
                    <TranscriptPanel quoteId={quote.id} transcript={t} />
                  </CollapsibleSection>
                );
              })()}

              {/* Stage 5 compliance review panel — only when there's a
                  server-side review attached. */}
              {(() => {
                const review = (quoteData.compliance_review ?? null) as
                  | ComplianceReview
                  | null;
                if (!review) return null;
                return (
                  <CollapsibleSection
                    id="agent-compliance-review"
                    title="Compliance Review"
                  >
                    <CompliancePanel
                      quoteId={quote.id}
                      review={review}
                      items={quoteData.line_items as ComplianceLineItem[]}
                    />
                  </CollapsibleSection>
                );
              })()}
            </div>
          </>
        ) : (
          <QuoteGenerator id={quote.id} />
        )}
      </main>
    </div>
  );
}
