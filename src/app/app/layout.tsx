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
      {/* Wave 15.1: NO safe-area-top here. The new mobile-visible
          AppHeader owns its own `pt-[env(safe-area-inset-top)]`, so
          adding it on the wrapper as well stacked the inset twice —
          which was the "thick black top border" the user saw. Pages
          that don't render AppHeader (3 materials editor pages) now
          apply the inset on their own root.
          `pb-[88px]` on mobile keeps the floating bottom nav clear
          of the last page row. */}
      <div className="min-w-0 pb-[88px] sm:pb-0">
        {children}
      </div>
      <div aria-hidden="true" className="hidden lg:block" />
      <MobileBottomNav />
    </div>
  );
}
