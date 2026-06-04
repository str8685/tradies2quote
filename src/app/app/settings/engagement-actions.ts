"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewsEnabled, followupsEnabled } from "@/lib/engagement";

export type EngagementSettingsInput = {
  googleReviewUrl: string;
  autoReview: boolean;
  autoFollowup: boolean;
};

/**
 * Upsert the tradie's engagement preferences (Google review link + the
 * auto-review / auto-follow-up toggles). Upsert targets the signed-in user's
 * own feature_settings row; the feature_settings_*_own RLS policies make any
 * other user_id impossible.
 */
export async function saveEngagementSettings(
  input: EngagementSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!reviewsEnabled() && !followupsEnabled()) {
    return { ok: false, error: "Not enabled." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const url = String(input?.googleReviewUrl ?? "").trim() || null;
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Review link must start with http:// or https://" };
  }

  const { error } = await supabase.from("feature_settings").upsert(
    {
      user_id: user.id,
      google_review_url: url,
      auto_review_enabled: Boolean(input?.autoReview),
      auto_followup_enabled: Boolean(input?.autoFollowup),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not save your settings." };

  revalidatePath("/app/settings");
  return { ok: true };
}
