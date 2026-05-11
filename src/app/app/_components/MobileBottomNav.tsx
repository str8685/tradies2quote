import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { MobileBottomNavClient } from "./MobileBottomNavClient";

/**
 * Server wrapper for the mobile bottom nav.
 *
 * Wave 13 — fetches the current user server-side and passes `isOwner`
 * to the client tabs component. Hiding the Agents tile from the server-
 * rendered HTML keeps the route's existence out of non-owner client
 * bundles entirely.
 *
 * Wave 14.4 — also passes the user's email so the new avatar tile can
 * render an initial in the bottom-right corner without a client-side
 * supabase round-trip.
 *
 * Wave 15 — plumbs `avatarUrl` through. The wrapper tolerates the
 * column not existing yet (Wave 15 migration is pending): it issues
 * a single profile read, catches any error from the missing column,
 * and falls back to `null`, which the hub renders as the initials
 * placeholder. Once the migration is applied this just starts
 * returning real URLs.
 */
export async function MobileBottomNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = isOwnerEmail(user?.email);

  let avatarUrl: string | null = null;
  if (user?.id) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data && typeof (data as { avatar_url?: unknown }).avatar_url === "string") {
        avatarUrl = (data as { avatar_url: string }).avatar_url;
      }
    } catch {
      // Column probably doesn't exist yet. Initials fallback is fine
      // — never crash the bottom nav.
    }
  }

  return (
    <MobileBottomNavClient
      isOwner={isOwner}
      userEmail={user?.email ?? null}
      avatarUrl={avatarUrl}
    />
  );
}
