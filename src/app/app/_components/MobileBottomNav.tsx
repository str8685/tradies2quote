import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { MobileBottomNavClient } from "./MobileBottomNavClient";

/**
 * Server wrapper for the mobile bottom nav.
 *
 * Wave 13 — fetches the current user server-side and passes `isOwner`
 * to the client tabs component. Same pattern as `AppHeader`. Hiding
 * the Agents tile from the server-rendered HTML keeps the route's
 * existence out of non-owner client bundles entirely.
 */
export async function MobileBottomNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = isOwnerEmail(user?.email);
  return <MobileBottomNavClient isOwner={isOwner} />;
}
