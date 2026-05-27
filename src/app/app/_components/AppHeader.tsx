import { getCachedAuthUser } from "@/lib/supabase/auth";
import { getCachedAvatarUrl } from "@/lib/supabase/profile";
import { isOwnerEmail } from "@/lib/owner";
import { AppHeaderClient } from "./AppHeaderClient";

/**
 * Server wrapper for the shared `/app/*` header.
 *
 * Wave 13 — owner-only tab gating. Fetches the current user server-
 * side and passes `isOwner` to the client tabs component so the
 * Agents tab is hidden from non-owner tradies without leaking its
 * existence to the client bundle.
 *
 * Wave 15 — also plumbs `userEmail` + `avatarUrl` through so the
 * client header can render the avatar trigger that opens the new
 * account hub. The profile read tolerates the `avatar_url` column
 * not existing yet (Wave 15 migration is pending): wrapped in
 * try/catch, falls back to `null` for the initials placeholder.
 *
 * Every existing call site (e.g. `<AppHeader context="Quotes" />`)
 * keeps working — this server component just renders the client
 * child with the resolved flags.
 */
interface Props {
  /** Optional page label shown next to the logo on desktop only. */
  context?: string;
}

export async function AppHeader({ context }: Props) {
  // Wave 18.1/42 — perf — auth and avatar reads are cached per render,
  // so this header shares the same user/profile work with
  // `<MobileBottomNav>` and the page instead of issuing duplicate
  // Supabase round trips.
  const { user } = await getCachedAuthUser();
  const isOwner = isOwnerEmail(user?.email);
  const avatarUrl = user?.id ? await getCachedAvatarUrl(user.id) : null;

  return (
    <AppHeaderClient
      context={context}
      isOwner={isOwner}
      userEmail={user?.email ?? null}
      avatarUrl={avatarUrl}
    />
  );
}
