import { SideMeasureTape } from "../_components/app/SideMeasureTape";
import LoadingScreen from "../_components/landing/LoadingScreen";
import { MobileBottomNav } from "./_components/MobileBottomNav";

/**
 * Visual layout for /app/* routes.
 *
 * Adds a thin decorative measuring-tape rail on the far-left edge at
 * desktop breakpoints (≥lg). Mobile stays unchanged — `SideMeasureTape`
 * is `hidden lg:block`, so it consumes no space and renders no element
 * on small screens. The rail is also `pointer-events: none` via globals.css
 * so it can never block clicks even if its painting changes.
 *
 * Strictly visual. This layout does NOT call `supabase.auth.getUser()`,
 * does NOT redirect, does NOT fetch data. Auth gating is unchanged and
 * still happens in `src/proxy.ts` (session refresh + `/app` gate) and
 * as defense-in-depth at the top of each `/app/*` page's server
 * component (`await supabase.auth.getUser()` → `redirect("/login")`).
 *
 * Wave 9.1 — grid balanced (`24px_1fr_24px`) so the tape rail no longer
 * pushed centered content 12 px off the visual midline.
 *
 * Wave 10 — sticky bottom nav for mobile (`<MobileBottomNav />`) and
 * `pb-[88px] sm:pb-0` on the content track so the nav never covers the
 * last page row. The app grid background (`.t2q-app-grid-bg`) is applied
 * here too so every /app/* page sits on the same subtle surface,
 * matching the landing's visual rhythm.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="t2q-app-grid-bg min-h-screen lg:grid lg:grid-cols-[24px_1fr_24px]">
      {/* Wave 13.2 — same brand splash as the landing, with its own
          session-storage key so it shows once per session on the
          tradie's first dashboard visit (independent of the landing
          splash).
          Wave 14.2 — bumped to a 5s hold so the tape-measure fill
          plays in full before the dashboard renders. Once per session
          (sessionStorage 6h skip window), so it never gets in the
          way of repeat visits in the same browser session. */}
      <LoadingScreen
        storageKey="t2q-app-splash-shown"
        tapeLabel="// loading the tools"
        holdMs={5000}
      />
      <SideMeasureTape />
      <div className="min-w-0 pb-[88px] sm:pb-0">{children}</div>
      <div aria-hidden="true" className="hidden lg:block" />
      <MobileBottomNav />
    </div>
  );
}
