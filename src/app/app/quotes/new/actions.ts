"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createDraftQuote(formData: FormData) {
  const transcript = (formData.get("transcript") as string | null)?.trim() ?? "";
  if (!transcript) {
    redirect("/app/quotes/new?error=missing-transcript");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      voice_transcript: transcript,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createDraftQuote insert failed", error);
    redirect("/app/quotes/new?error=draft-failed");
  }

  redirect(`/app/quotes/preview/${data.id}`);
}
