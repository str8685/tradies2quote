/**
 * Wave 13.2 — the legacy `signOutAction` server action lived here. It
 * was unreliable: `cookies().delete()` inside a server action doesn't
 * always include the `path` attribute the cookie was originally set
 * with, so the delete header could fail to match and the cookie would
 * survive. The middleware would then refresh the session on the next
 * request and silently re-authenticate the user.
 *
 * Sign-out now lives in a dedicated POST route handler at
 * `src/app/auth/signout/route.ts`. The route handler constructs the
 * redirect Response itself and writes explicit Max-Age=0 cookies on
 * it, which the browser always honours.
 *
 * This file is intentionally left empty for now — no `"use server"`
 * exports are needed. Keeping the file (rather than deleting) so the
 * import path stays stable if any future server action lands here.
 */
export {};
