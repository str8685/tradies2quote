"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CalendarNoteResult =
  | { ok: true; id: string }
  | { error: string };

export type DeleteNoteResult = { ok: true } | { error: string };

const MAX_BODY = 500;

/**
 * Add a personal calendar note pinned to a day (YYYY-MM-DD). Owner-scoped:
 * user_id comes from the session, never the client, and RLS enforces it
 * server-side as defence-in-depth.
 */
export async function addCalendarNote(
  noteDate: string,
  body: string,
): Promise<CalendarNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = body.trim().slice(0, MAX_BODY);
  if (!trimmed) return { error: "Write something first." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
    return { error: "Invalid date." };
  }

  const { data, error } = await supabase
    .from("calendar_notes")
    .insert({ user_id: user.id, note_date: noteDate, body: trimmed })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addCalendarNote failed", error);
    return { error: "Could not save the note." };
  }

  revalidatePath("/app");
  return { ok: true, id: data.id };
}

/** Edit the body of one of the caller's own calendar notes. */
export async function updateCalendarNote(
  id: string,
  body: string,
): Promise<CalendarNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = body.trim().slice(0, MAX_BODY);
  if (!trimmed) return { error: "Write something first." };

  const { data, error } = await supabase
    .from("calendar_notes")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("updateCalendarNote failed", error);
    return { error: "Could not update the note." };
  }

  revalidatePath("/app");
  return { ok: true, id: data.id };
}

/** Delete one of the caller's own calendar notes. */
export async function deleteCalendarNote(
  id: string,
): Promise<DeleteNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("calendar_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteCalendarNote failed", error);
    return { error: "Could not delete the note." };
  }

  revalidatePath("/app");
  return { ok: true };
}
