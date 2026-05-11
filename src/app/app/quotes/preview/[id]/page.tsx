import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial, QuoteData, QuoteStatus } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import type { ComplianceLineItem, ComplianceReview } from "@/lib/compliance";
import { AppHeader } from "../../../_components/AppHeader";
import { QuoteReadinessCheck } from "../../../_components/QuoteReadinessCheck";
import { QuoteGenerator } from "./_components/QuoteGenerator";
import { QuoteEditor } from "./_components/QuoteEditor";
import { CompliancePanel } from "./_components/CompliancePanel";
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
                only; does not block the Send button below. */}
            <QuoteReadinessCheck
              quoteData={quoteData}
              profile={profile ?? null}
              expiresAt={quote.expires_at ?? null}
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
