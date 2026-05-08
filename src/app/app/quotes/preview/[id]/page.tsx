import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial, QuoteData } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import { QuoteGenerator } from "./_components/QuoteGenerator";
import { QuoteEditor } from "./_components/QuoteEditor";

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
    .select("id, voice_transcript, quote_data, created_at, status")
    .eq("id", id)
    .single();

  if (error || !quote) redirect("/app/quotes/new");

  const quoteData = (quote.quote_data ?? null) as QuoteData | null;
  const headerNumber = quoteNumber(quote.id, quote.created_at);

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
    <div className="min-h-screen bg-ink-900 text-white">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app"
            data-testid="preview-back"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            ← Dashboard
          </Link>
          <span
            data-testid="preview-quote-number"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400"
          >
            {headerNumber}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
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
          <QuoteEditor
            quoteId={quote.id}
            createdAt={quote.created_at}
            initialData={quoteData}
            library={library}
          />
        ) : (
          <QuoteGenerator id={quote.id} />
        )}
      </main>
    </div>
  );
}
