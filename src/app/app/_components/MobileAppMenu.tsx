import { getCachedAuthUser } from "@/lib/supabase/auth";
import { getCachedAvatarUrl } from "@/lib/supabase/profile";
import { isOwnerEmail } from "@/lib/owner";
import { MobileAppMenuClient } from "./MobileAppMenuClient";

/**
 * Server wrapper for the mobile app menu.
 *
 * Wave 13 — fetches the current user server-side and passes `isOwner`
 * to the client menu component so AccountHub can keep owner-only
 * shortcuts gated.
 *
 * Wave 14.4 — also passes the user's email so the avatar/account sheet
 * can render without a client-side Supabase round-trip.
 *
 * Wave 15 — plumbs `avatarUrl` through. The wrapper tolerates the
 * column not existing yet (Wave 15 migration is pending): it issues
 * a single profile read, catches any error from the missing column,
 * and falls back to `null`, which the hub renders as the initials
 * placeholder. Once the migration is applied this just starts
 * returning real URLs.
 */
export async function MobileAppMenu() {
  // Wave 18.1/42 — perf — see AppHeader for the rationale. Auth and
  // avatar reads are shared per server render.
  const { user } = await getCachedAuthUser();
  const isOwner = isOwnerEmail(user?.email);
  const avatarUrl = user?.id ? await getCachedAvatarUrl(user.id) : null;

  return (
    <MobileAppMenuClient
      isOwner={isOwner}
      userEmail={user?.email ?? null}
      avatarUrl={avatarUrl}
    />
  );
}
