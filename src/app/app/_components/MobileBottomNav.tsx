import { getCachedAuthUser } from "@/lib/supabase/auth";
import { getCachedAvatarUrl } from "@/lib/supabase/profile";
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
  // Wave 18.1/42 — perf — see AppHeader for the rationale. Auth and
  // avatar reads are shared per server render.
  const { user } = await getCachedAuthUser();
  const isOwner = isOwnerEmail(user?.email);
  const avatarUrl = user?.id ? await getCachedAvatarUrl(user.id) : null;

  return (
    <MobileBottomNavClient
      isOwner={isOwner}
      userEmail={user?.email ?? null}
      avatarUrl={avatarUrl}
    />
  );
}
