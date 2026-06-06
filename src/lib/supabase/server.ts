import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Wave 18.1 — perf — wrapped in React `cache()` so multiple
 * `await createClient()` calls within a single server render share one
 * client instance. Without this, `<AppHeader>` (which calls getUser +
 * a profile read), the page component (which calls getUser + data
 * queries), and `<MobileAppMenu>` (getUser + profile read) each
 * created a fresh Supabase client and made a fresh network roundtrip
 * to verify the JWT — three sequential ~100ms auth calls per /app/*
 * page render. With `cache()` the work is deduped per render; the
 * proxy / middleware still runs separately (different runtime).
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookie writes will be picked up
            // by the proxy on the next request, so this is safe to ignore.
          }
        },
      },
    },
  );
});
