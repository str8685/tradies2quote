/**
 * Route-level loading state for every `/app/*` page.
 *
 * Why this exists: Next.js renders this server-side while the matching
 * `page.tsx` (and anything it `await`s — session refresh, profile
 * fetch, quote loads, RPCs) is resolving. Because it's server-rendered
 * with zero JS, the user sees a brand-matching splash IMMEDIATELY,
 * before any protected dashboard markup is even fetched. This is what
 * eliminates the "dashboard flashes briefly before the loading screen"
 * problem the user reported — the dashboard literally doesn't render
 * until its data is ready, and this loader holds the screen until then.
 *
 * Wave 15:
 *   - Was the auto-skeleton with placeholder cards. Reworked to a
 *     brand splash that matches the new `.t2q-app-canvas` so the
 *     transition into the real page is invisible.
 *   - Static, no framer-motion, no animation library. A single tiny
 *     CSS keyframe on the caption keeps it feeling alive without
 *     paying the cost of a JS animation runtime.
 *   - Safe: no Supabase calls, no cookie reads, no agent-monitor
 *     imports.
 */
export default function AppLoading() {
  return (
    <div
      data-testid="app-route-loading"
      aria-busy="true"
      aria-live="polite"
      // Painted with the same canvas gradient the layout below uses,
      // so when the page resolves the only visible change is the
      // dashboard fading IN — nothing about the background shifts.
      className="t2q-app-canvas fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        // Respect the iPhone notch + Android cutout so the centered
        // brand mark stays optically centered.
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.png"
          alt="Tradies2Quote"
          width={160}
          height={136}
          className="block h-16 w-auto rounded-2xl bg-white p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_48px_-12px_rgba(255,95,21,0.35)] sm:h-20"
        />
        <p className="font-display text-lg uppercase tracking-tight text-white sm:text-2xl">
          Loading your <span className="text-brand">tools.</span>
        </p>
        <p className="t2q-loading-caption font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
          {"// resolving session"}
        </p>
      </div>
    </div>
  );
}
