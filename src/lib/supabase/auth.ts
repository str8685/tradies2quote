import "server-only";
import { cache } from "react";
import { createClient } from "./server";

/**
 * Wave 18.1 — perf — request-scoped cache around `supabase.auth.getUser()`.
 *
 * Every /app/* render today calls `getUser()` from at least three
 * places: the `<AppHeader>` server wrapper, the `<MobileAppMenu>`
 * server wrapper, and the page component itself (defense-in-depth).
 * Each call is a fresh network roundtrip to Supabase's auth API to
 * verify the JWT — three sequential ~100 ms calls per render on a
 * cold edge. Wrapping in React's `cache()` collapses them into ONE
 * call shared across the whole tree of the same request. The proxy
 * middleware runs in a separate runtime and is not affected.
 *
 * Returns the same shape as `auth.getUser()` so call sites stay
 * familiar (`const { user, error } = await getCachedAuthUser()`).
 *
 * This is purely server-side. Never imported into client components
 * (the `server-only` guard at the top throws if a client bundle ever
 * pulls it in).
 */
export const getCachedAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
});
