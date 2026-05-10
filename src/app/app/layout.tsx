import { SideMeasureTape } from "../_components/app/SideMeasureTape";

/**
 * Visual layout for /app/* routes.
 *
 * Adds a thin decorative measuring-tape rail on the far-left edge at
 * desktop breakpoints (≥lg). Mobile stays unchanged — `SideMeasureTape`
 * is `hidden lg:block`, so it consumes no space and renders no element
 * on small screens.
 *
 * Strictly visual. This layout does NOT call `supabase.auth.getUser()`,
 * does NOT redirect, does NOT fetch data. Auth gating is unchanged and
 * still happens in `src/proxy.ts` (session refresh + `/app` gate) and
 * as defense-in-depth at the top of each `/app/*` page's server
 * component (`await supabase.auth.getUser()` → `redirect("/login")`).
 *
 * The grid kicks in at `lg`. Below `lg`, the wrapper is a plain block
 * `<div>` and `children` render full-width as before.
 *
 * Wave 9.1 — added a mirror 24px spacer column on the right so the
 * tape rail no longer pushes the centered content track 12px off the
 * visual midline. Without the spacer the grid was `24px_1fr`, which
 * meant `mx-auto` inside the content track centered around (viewport−24)/2,
 * not viewport/2. With `24px_1fr_24px`, the content track is symmetric.
 *
 * `min-w-0` on the content column prevents children with intrinsic
 * min-content from overflowing the middle grid track.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[24px_1fr_24px]">
      <SideMeasureTape />
      <div className="min-w-0">{children}</div>
      <div aria-hidden="true" className="hidden lg:block" />
    </div>
  );
}
