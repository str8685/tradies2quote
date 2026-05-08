"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/quote-defaults";
import type { QuoteData } from "@/lib/quote-types";

type SaveResult = { ok: true } | { error: string };

export async function saveQuoteChanges(
  id: string,
  data: QuoteData,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let materials_subtotal = 0;
  let labour_subtotal = 0;
  const items = (data.line_items ?? []).map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const line_total = round2(qty * price);
    if (it.type === "labour") labour_subtotal += line_total;
    else materials_subtotal += line_total;
    return { ...it, quantity: qty, unit_price: price, line_total };
  });
  const markup_pct = Number(data.markup_pct) || 0;
  const tax_rate = Number(data.tax_rate) || 0;
  const markup_amount = round2(materials_subtotal * (markup_pct / 100));
  const subtotal_before_tax = round2(
    materials_subtotal + markup_amount + labour_subtotal,
  );
  const tax_amount = round2(subtotal_before_tax * (tax_rate / 100));
  const total = round2(subtotal_before_tax + tax_amount);

  const next: QuoteData = {
    ...data,
    line_items: items,
    materials_subtotal: round2(materials_subtotal),
    labour_subtotal: round2(labour_subtotal),
    markup_pct,
    markup_amount,
    subtotal_before_tax,
    tax_amount,
    total,
  };

  const { error: uErr } = await supabase
    .from("quotes")
    .update({
      quote_data: next,
      total_amount: total,
      currency: next.currency,
    })
    .eq("id", id);
  if (uErr) {
    console.error("saveQuoteChanges update failed", uErr);
    return { error: "Could not save changes." };
  }

  const { error: dErr } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", id);
  if (dErr) {
    console.error("saveQuoteChanges delete items failed", dErr);
    return { error: "Could not refresh line items." };
  }

  if (items.length > 0) {
    const { error: iErr } = await supabase.from("quote_items").insert(
      items.map((it) => ({
        quote_id: id,
        type: it.type,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
    );
    if (iErr) {
      console.error("saveQuoteChanges insert items failed", iErr);
      return { error: "Could not write line items." };
    }
  }

  return { ok: true };
}
