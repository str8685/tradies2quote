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
 * `<div>` and `children` render full-width as before. The 24px
 * tape-rail column is fixed-width; `min-w-0` on the content column
 * prevents children with intrinsic min-content from overflowing the
 * second grid track.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[24px_1fr]">
      <SideMeasureTape />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
