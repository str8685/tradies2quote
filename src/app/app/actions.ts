"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out flow.
 *
 * Wave 13.1 — hardened. The previous version called `signOut()` and
 * redirected, but the middleware (`src/proxy.ts` → `updateSession`)
 * runs on every request and re-issues a fresh session cookie if a
 * refresh token is still in the request — so users were getting
 * silently "re-signed-in" right after the redirect.
 *
 * Defence in depth:
 *   1. `signOut({ scope: "global" })` — invalidates the refresh token
 *      server-side so even if a cookie leaks, it can't be refreshed.
 *   2. Explicit cookie sweep — delete every `sb-*` cookie the request
 *      carries, in case `signOut()` missed any.
 *   3. `revalidatePath("/", "layout")` — invalidates the cached
 *      layout state that holds the session-bound nav.
 *   4. Redirect to `/login` instead of `/` so the user lands on a
 *      page where the middleware won't try to refresh.
 */
export async function signOutAction() {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Network error against the auth API is fine — we'll still clear
    // local cookies below.
  }

  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith("sb-")) {
      try {
        cookieStore.delete(name);
      } catch {
        /* server-component invocation — proxy picks it up */
      }
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
