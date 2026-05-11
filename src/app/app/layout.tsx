import { SideMeasureTape } from "../_components/app/SideMeasureTape";
import { MobileBottomNav } from "./_components/MobileBottomNav";

/**
 * Visual layout for /app/* routes.
 *
 * Wave 15 — refresh:
 *   - Background swapped from `.t2q-app-grid-bg` (visible tiled grid)
 *     to `.t2q-app-canvas` (smooth dark gradient, no squares).
 *   - Removed the 5-second tape-measure `<LoadingScreen>` entry splash.
 *     Replaced by Next.js's route-level `app/app/loading.tsx`, which
 *     is server-rendered with zero JS and shown BEFORE the dashboard
 *     markup ever ships to the browser. That fixes the "dashboard
 *     flashes briefly before the splash" bug — there's nothing to
 *     flash, because the dashboard doesn't render until its data is
 *     ready, and the route loader covers the gap.
 *   - Safe-area inset top is now applied to the wrapper div in a way
 *     that doesn't insert a tall black band: just `pt-[env(...)]`
 *     and no opaque background on the inset itself, since the canvas
 *     paints continuously underneath.
 *   - Bottom inset still honoured via the mobile bottom nav's own
 *     `pb-[calc(env(safe-area-inset-bottom,0)+...)]`; nothing to do
 *     here.
 *
 * Auth gating is unchanged. This layout does NOT call
 * `supabase.auth.getUser()`, does NOT redirect, does NOT fetch data.
 * Auth still happens in `src/proxy.ts` (session refresh + `/app`
 * gate) and as defense-in-depth at the top of each `/app/*` page's
 * server component.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="t2q-app-canvas min-h-screen overflow-x-hidden lg:grid lg:grid-cols-[24px_1fr_24px]">
      <SideMeasureTape />
      {/* Wave 14.3: AppHeader is `hidden sm:block`, so the mobile
          shell picks up the safe-area-top inset HERE. Without it,
          page content would start under the iPhone notch / Android
          camera cutout. No coloured band — the canvas paints behind
          the inset so it just adds breathing room. */}
      <div className="min-w-0 pt-[env(safe-area-inset-top)] pb-[88px] sm:pt-0 sm:pb-0">
        {children}
      </div>
      <div aria-hidden="true" className="hidden lg:block" />
      <MobileBottomNav />
    </div>
  );
}
