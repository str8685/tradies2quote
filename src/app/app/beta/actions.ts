"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendFeedbackEmail } from "@/lib/email-feedback";

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

  const appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null;

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    what_worked: whatWorked || null,
    what_confusing: whatConfusing || null,
    wrong_number: wrongNumber || null,
    would_pay: wouldPay || null,
    app_version: appVersion,
  });
  if (error) return { ok: false, error: "Could not send feedback. Try again." };

  // Best-effort email notification — the DB row is the source of truth, so a
  // failed/unconfigured email must never fail the user's submission.
  try {
    await sendFeedbackEmail({
      fromTradieEmail: user.email ?? "unknown@tradies2quote.com",
      whatWorked,
      whatConfusing,
      wrongNumber,
      wouldPay,
      appVersion,
    });
  } catch (e) {
    console.error("[beta_feedback] email notify failed", e);
  }

  return { ok: true };
}
