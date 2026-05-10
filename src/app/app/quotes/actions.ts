"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Quote-management server actions used by the dashboard and the
 * `/app/quotes` route — archive, restore-from-archive, and soft-delete.
 *
 * Wave 10 — backed by the new `archived_at` / `deleted_at` columns on
 * `public.quotes` (see migration `20260511_wave10_quotes_and_profile_fields`).
 *
 * Security model (every action):
 *   - `auth.getUser()` on the server. No client-supplied user id is
 *     trusted; if no session, redirect to `/login`.
 *   - Update is gated by `.eq("user_id", user.id)` as defense-in-depth
 *     on top of the `quotes_update_own` RLS policy.
 *   - Soft-delete sets `deleted_at = now()`. Hard delete is intentionally
 *     not exposed.
 *
 * Each action revalidates both `/app` (dashboard recent-quotes) and
 * `/app/quotes` (full management hub) so the row disappears or reappears
 * the moment the user dismisses the confirm dialog.
 */
export type QuoteActionResult = { ok: true } | { error: string };

async function getAuthed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

function revalidateQuoteLists() {
  revalidatePath("/app");
  revalidatePath("/app/quotes");
}

/** Set `archived_at = now()`. Caller must own the row (RLS-enforced). */
export async function archiveQuote(id: string): Promise<QuoteActionResult> {
  if (!id || typeof id !== "string") {
    return { error: "Missing quote id." };
  }
  const { supabase, user } = await getAuthed();

  const { error } = await supabase
    .from("quotes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("archiveQuote failed", error);
    return { error: "Couldn't archive this quote." };
  }

  revalidateQuoteLists();
  return { ok: true };
}

/** Clear `archived_at`. Restores an archived quote to the active list. */
export async function unarchiveQuote(id: string): Promise<QuoteActionResult> {
  if (!id || typeof id !== "string") {
    return { error: "Missing quote id." };
  }
  const { supabase, user } = await getAuthed();

  const { error } = await supabase
    .from("quotes")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("unarchiveQuote failed", error);
    return { error: "Couldn't restore this quote." };
  }

  revalidateQuoteLists();
  return { ok: true };
}

/**
 * Soft-delete: set `deleted_at = now()` so the quote disappears from
 * every UI list. Row stays in the DB so the PDF / public quote URL
 * remain intact for any clients who already have the link.
 */
export async function softDeleteQuote(id: string): Promise<QuoteActionResult> {
  if (!id || typeof id !== "string") {
    return { error: "Missing quote id." };
  }
  const { supabase, user } = await getAuthed();

  const { error } = await supabase
    .from("quotes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("softDeleteQuote failed", error);
    return { error: "Couldn't delete this quote." };
  }

  revalidateQuoteLists();
  return { ok: true };
}
