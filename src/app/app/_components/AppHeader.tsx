import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { AppHeaderClient } from "./AppHeaderClient";

/**
 * Server wrapper for the shared `/app/*` header.
 *
 * Wave 13 — owner-only tab gating. The header now fetches the current
 * user server-side and passes `isOwner` to the client tabs component
 * so the Agents tab is hidden from non-owner tradies without leaking
 * its existence to the client bundle.
 *
 * Every existing call site (e.g. `<AppHeader context="Quotes" />`)
 * keeps working: this server component renders the client child with
 * the resolved `isOwner` flag — callers don't need to plumb it
 * through.
 */
interface Props {
  /** Optional page label shown next to the logo on desktop only. */
  context?: string;
}

export async function AppHeader({ context }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = isOwnerEmail(user?.email);
  return <AppHeaderClient context={context} isOwner={isOwner} />;
}
