/**
 * Owner-only gate.
 *
 * Single source of truth for "is this caller the project owner?". The
 * owner's email is hard-coded — there is no admin-flag column on
 * `profiles` (intentionally; the MVP has one owner and a small handful
 * of beta tradies, none of whom should see the agents/debug surfaces).
 *
 * Tightened in Wave 13:
 *   - `/app/agents` is now owner-only (previously visible to any
 *      logged-in tradie). Non-owners get `notFound()` so the route's
 *      existence isn't advertised.
 *   - `/app/debug` remains owner-only — its existing check is
 *      refactored to call this helper so we don't drift.
 *   - The dashboard's "AI Agents" card and the `AppHeader` "Agents"
 *      tab both hide for non-owners.
 *
 * Customers on the public quote route (`/quote/[token]`) never reach
 * any `/app/*` surface and so are never tested by this helper — they
 * are gated at the route level by living outside `/app/*` entirely.
 */
export const OWNER_EMAIL = "challis836@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}
