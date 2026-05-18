"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Bulk soft-delete invoices by id.
 *
 * Matches the existing pattern at /app/invoices/page.tsx where every
 * read query filters `.is("deleted_at", null)` — so setting deleted_at
 * removes the row from every list without losing the underlying
 * record (and the linked quote.invoice_data snapshot is unaffected).
 *
 * RLS-safe by construction: the query is scoped to `user_id = auth.uid()`
 * server-side, so passing another user's invoice id is a no-op rather
 * than a leak. Anonymous callers are bounced via redirect("/login").
 *
 * Returns { deleted } so the client can render a toast like
 * "Deleted 3 invoices." Errors are logged server-side and surfaced as
 * a short user-facing string.
 */

export type BulkDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function bulkDeleteInvoices(
  ids: string[],
): Promise<BulkDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Nothing selected." };
  }

  // Cap so a malicious payload can't try to delete the whole table.
  // The /app/invoices page caps queries at 200 rows, so the UI never
  // surfaces more than that at a time anyway.
  if (ids.length > 200) {
    return { ok: false, error: "Too many invoices selected at once." };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("id", ids)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("bulkDeleteInvoices failed", error);
    return { ok: false, error: "Could not delete invoices. Try again." };
  }

  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { ok: true, deleted: data?.length ?? 0 };
}
