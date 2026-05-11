import { SideMeasureTape } from "../_components/app/SideMeasureTape";
import LoadingScreen from "../_components/landing/LoadingScreen";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { OnboardingTour } from "./_components/OnboardingTour";

/**
 * Visual layout for /app/* routes.
 *
 * Wave 15.2 — restoration of the tape-measure entry splash:
 *   - `<LoadingScreen>` is mounted back at the top of the tree. It's
 *     gated by sessionStorage (6h skip window) so it only plays on the
 *     first /app entry per browsing session, not on every navigation.
 *   - The same component used to render with `useState(false)` and
 *     fade in after mount, which caused the dashboard to flash for a
 *     moment before the splash appeared. Wave 15.2 flips its initial
 *     state to `true` so the splash is in the server-rendered HTML —
 *     no protected UI is ever painted before it.
 *   - The mobile header (logo + avatar + black strip) is hidden again
 *     via `hidden sm:block` in <AppHeaderClient>. Mobile uses only the
 *     bottom nav (which includes the avatar tile for the AccountHub).
 *   - Because the mobile header is gone again, the wrapper restores
 *     its own `pt-[env(safe-area-inset-top)] sm:pt-0` so phone
 *     content still sits below the notch.
 *
 * The route-level `loading.tsx` next to this file now returns null —
 * no more brand splash between tabs.
 *
 * Auth gating is unchanged. This layout does NOT call
 * `supabase.auth.getUser()`, does NOT redirect, does NOT fetch data.
 * Auth still happens in `src/proxy.ts` and as defense-in-depth at the
 * top of each `/app/*` page's server component.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="t2q-app-canvas min-h-screen overflow-x-hidden lg:grid lg:grid-cols-[24px_1fr_24px]">
      {/* Tape-measure brand splash. Renders once per session — the
          sessionStorage check inside the component decides whether to
          play or skip on each /app entry. Server-rendered visible so
          there's no flash of dashboard before it appears. */}
      <LoadingScreen
        storageKey="t2q-app-splash-shown"
        tapeLabel="// loading the tools"
        holdMs={5000}
      />
      <SideMeasureTape />
      {/* Mobile-only safe-area-top. AppHeader is `hidden sm:block`
          again so the wrapper picks up the iPhone notch / Android
          cutout inset on phones. Desktop gets the inset from the
          header itself. */}
      <div className="min-w-0 pt-[env(safe-area-inset-top)] pb-[88px] sm:pt-0 sm:pb-0">
        {children}
      </div>
      <div aria-hidden="true" className="hidden lg:block" />
      <MobileBottomNav />
      {/* First-run onboarding tour. Self-gates via localStorage so it
          renders nothing on repeat visits and never blocks people who
          already know the app. */}
      <OnboardingTour />
    </div>
  );
}
