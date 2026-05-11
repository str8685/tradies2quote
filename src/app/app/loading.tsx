/**
 * Route-level loading state for `/app/*`.
 *
 * Wave 15.2 — the brand splash that this file used to render has been
 * removed. The operator found it appearing between every tab nav
 * (Dashboard → Quotes, Quotes → Materials, etc.) too disruptive on
 * mobile.
 *
 * Returning `null` tells Next.js "no visible loader during route
 * transitions on this subtree" — the previous page stays put until
 * the new page's server-compute finishes, then the new page renders
 * directly. This is the same behaviour as having no loading.tsx at
 * all; the file is kept (just empty) so the convention is documented
 * and easy to re-enable later if needed.
 *
 * The one-per-session brand splash on app entry now lives in
 * `app/layout.tsx` (the tape-measure `<LoadingScreen holdMs={5000}>`),
 * which only runs on the first /app entry per browsing session, not
 * between tabs.
 */
export default function AppLoading() {
  return null;
}
