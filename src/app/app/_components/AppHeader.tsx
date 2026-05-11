import { createClient } from "@/lib/supabase/server";
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
      if (
        !error &&
        data &&
        typeof (data as { avatar_url?: unknown }).avatar_url === "string"
      ) {
        avatarUrl = (data as { avatar_url: string }).avatar_url;
      }
    } catch {
      // Column not present yet — initials fallback is fine.
    }
  }

  return (
    <AppHeaderClient
      context={context}
      isOwner={isOwner}
      userEmail={user?.email ?? null}
      avatarUrl={avatarUrl}
    />
  );
}
