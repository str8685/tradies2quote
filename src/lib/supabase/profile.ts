import "server-only";
import { cache } from "react";
import { createClient } from "./server";

/**
 * Request-scoped profile reads used by the app shell.
 *
 * The desktop header and mobile bottom nav both need the same avatar URL.
 * Caching keeps that to one profile query per server render, while still
 * tolerating installs where the optional `avatar_url` column has not landed.
 */
export const getCachedAvatarUrl = cache(async (userId: string) => {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (
      !error &&
      data &&
      typeof (data as { avatar_url?: unknown }).avatar_url === "string"
    ) {
      return (data as { avatar_url: string }).avatar_url;
    }
  } catch {
    // Column not present yet — initials fallback is fine.
  }

  return null;
});
