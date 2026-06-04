"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BetaFeedbackInput = {
  whatWorked: string;
  whatConfusing: string;
  wrongNumber: string;
  wouldPay: string;
};

/**
 * Save a tradie's beta feedback to their own `beta_feedback` row. RLS
 * (beta_feedback_insert_own) guarantees the row is scoped to the signed-in
 * user — we never trust a client-supplied user id. At least one field must be
 * filled so we don't store empty submissions.
 */
export async function submitBetaFeedback(
  input: BetaFeedbackInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trim = (s: unknown) => String(s ?? "").trim().slice(0, 4000);
  const whatWorked = trim(input?.whatWorked);
  const whatConfusing = trim(input?.whatConfusing);
  const wrongNumber = trim(input?.wrongNumber);
  const wouldPay = trim(input?.wouldPay);

  if (!whatWorked && !whatConfusing && !wrongNumber && !wouldPay) {
    return { ok: false, error: "Add a note in at least one box before sending." };
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    what_worked: whatWorked || null,
    what_confusing: whatConfusing || null,
    wrong_number: wrongNumber || null,
    would_pay: wouldPay || null,
    app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
  });
  if (error) return { ok: false, error: "Could not send feedback. Try again." };

  return { ok: true };
}
