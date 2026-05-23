"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import type { QuoteData } from "@/lib/quote-types";

type AckResult = { ok: true } | { error: string };

/**
 * Owner-only — mark a flagged supplier extraction as handled.
 *
 * Stamps `supplier_source.extraction_reviewed_at` (so it drops out of the
 * default review queue) plus correction provenance. Does NOT re-run
 * extraction and does NOT touch the original `extraction_status` — the
 * provenance of WHY it was flagged is preserved for the record.
 */
export async function acknowledgeExtraction(
  quoteId: string,
): Promise<AckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) {
    return { error: "Not authorised." };
  }

  const { data: row } = await supabase
    .from("quotes")
    .select("quote_data, user_id")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row || !row.quote_data) {
    return { error: "Quote not found." };
  }

  const quoteData = row.quote_data as QuoteData;
  const ss = quoteData.supplier_source ?? null;
  if (!ss) {
    return { error: "This quote isn't a supplier import." };
  }

  const now = new Date().toISOString();
  const next: QuoteData = {
    ...quoteData,
    supplier_source: {
      ...ss,
      extraction_reviewed_at: now,
      // Handling a flagged extraction counts as the human resolving it.
      extraction_corrected: true,
      corrected_by: ss.corrected_by ?? user.id,
      corrected_at: ss.corrected_at ?? now,
    },
  };

  const { error } = await supabase
    .from("quotes")
    .update({ quote_data: next })
    .eq("id", quoteId)
    .eq("user_id", user.id);
  if (error) {
    console.error("acknowledgeExtraction update failed", error);
    return { error: "Could not mark as handled." };
  }

  revalidatePath("/app/debug/extraction");
  return { ok: true };
}
